// openrouter.js — cliente da API. Saldo sincroniza sozinho (sem botão).

const API = 'https://openrouter.ai/api/v1';

export class OpenRouter {
  constructor({ apiKey = '', managementKey = '' } = {}) {
    this.apiKey = apiKey;
    this.managementKey = managementKey;
    this._models = null;
    this._balance = null;
    this._balanceAt = 0;
    this.onBalance = null; // callback(saldo)
  }

  setKeys({ apiKey, managementKey }) {
    if (apiKey !== undefined) this.apiKey = apiKey;
    if (managementKey !== undefined) this.managementKey = managementKey;
    this._balance = null; this._balanceAt = 0; this._models = null;
  }

  _h(mgmt = false) {
    return {
      Authorization: `Bearer ${mgmt && this.managementKey ? this.managementKey : this.apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': location.origin,
      'X-Title': 'Mesa RPG IA',
    };
  }

  // Saldo com cache curto; chamado automaticamente no boot, a cada 2 min e após cada sessão.
  async balance({ force = false } = {}) {
    if (!force && this._balance && Date.now() - this._balanceAt < 120000) return this._balance;
    const r = await fetch(`${API}/credits`, { headers: this._h(true) });
    if (!r.ok) throw new Error(`Saldo indisponível (${r.status}). Confira as chaves.`);
    const d = (await r.json()).data || {};
    const total = Number(d.total_credits ?? 0), used = Number(d.total_usage ?? 0);
    this._balance = { total, used, available: total - used };
    this._balanceAt = Date.now();
    if (this.onBalance) this.onBalance(this._balance);
    return this._balance;
  }

  startAutoSync(intervalMs = 120000) {
    this.balance({ force: true }).catch(() => {});
    if (this._timer) clearInterval(this._timer);
    this._timer = setInterval(() => this.balance({ force: true }).catch(() => {}), intervalMs);
  }

  async models() {
    if (this._models) return this._models;
    const r = await fetch(`${API}/models`, { headers: this._h() });
    if (!r.ok) throw new Error(`Modelos indisponíveis (${r.status}).`);
    this._models = ((await r.json()).data || []).map(m => ({
      id: m.id,
      name: m.name || m.id,
      ctx: m.context_length,
      pricing: m.pricing || {},
      modality: m.architecture?.modality || 'text->text',
      inPrice: Number(m.pricing?.prompt || 0),
      outPrice: Number(m.pricing?.completion || 0),
    }));
    return this._models;
  }

  async textModels() {
    return (await this.models())
      .filter(m => !m.modality.includes('->image'))
      .sort((a, b) => (a.inPrice + a.outPrice) - (b.inPrice + b.outPrice));
  }

  async imageModels() {
    return (await this.models())
      .filter(m => m.modality.includes('->image'))
      .sort((a, b) => (a.inPrice + a.outPrice) - (b.inPrice + b.outPrice));
  }

  priceOf(modelId) {
    return (this._models || []).find(m => m.id === modelId) || null;
  }

  async chat(messages, { model, maxTokens = 500, temperature = 0.85, json = false } = {}) {
    const body = { model, messages, max_tokens: maxTokens, temperature, reasoning: { effort: 'low' } };
    if (json) body.response_format = { type: 'json_object' };
    const r = await fetch(`${API}/chat/completions`, { method: 'POST', headers: this._h(), body: JSON.stringify(body) });
    if (!r.ok) throw new Error(`IA falhou (${r.status}): ${(await r.text().catch(() => '')).slice(0, 200)}`);
    const d = await r.json();
    const u = d.usage || {};
    const m = this.priceOf(model);
    const cost = m ? (m.inPrice * (u.prompt_tokens || 0) + m.outPrice * (u.completion_tokens || 0)) : 0;
    return {
      text: d.choices?.[0]?.message?.content ?? '',
      inTokens: u.prompt_tokens || 0,
      outTokens: u.completion_tokens || 0,
      cost,
      model,
    };
  }

  async image(prompt, { model } = {}) {
    const r = await fetch(`${API}/chat/completions`, {
      method: 'POST', headers: this._h(),
      body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], modalities: ['image', 'text'] }),
    });
    if (!r.ok) throw new Error(`Imagem falhou (${r.status}).`);
    const d = await r.json();
    const msg = d.choices?.[0]?.message || {};
    const imgs = (msg.images || []).map(i => i.image_url?.url).filter(Boolean);
    const u = d.usage || {};
    const m = this.priceOf(model);
    const cost = m ? (m.inPrice * (u.prompt_tokens || 0) + m.outPrice * (u.completion_tokens || 0)) : 0;
    return { url: imgs[0] || null, cost };
  }
}
