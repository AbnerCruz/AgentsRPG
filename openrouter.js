// openrouter.js — cliente da API. Saldo automático, catálogo de modelos classificado.

const API = 'https://openrouter.ai/api/v1';

// Rede de segurança: nomes conhecidos de modelos que GERAM imagem, caso a classificação
// por modalidade venha incompleta na resposta da API.
const IMAGE_HINTS = /image|flux|sdxl|stable-diffusion|imagen|dall-e/i;

export class OpenRouter {
  constructor({ apiKey = '', managementKey = '' } = {}) {
    this.apiKey = apiKey;
    this.managementKey = managementKey;
    this._models = null;
    this._balance = null;
    this._balanceAt = 0;
    this._noJson = new Set(); // modelos que rejeitaram response_format
    this.onBalance = null;
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

  async balance({ force = false } = {}) {
    if (!force && this._balance && Date.now() - this._balanceAt < 120000) return this._balance;
    const r = await fetch(`${API}/credits`, { headers: this._h(true) });
    if (!r.ok) throw new Error(`Saldo indisponível (${r.status}). Confira as chaves.`);
    const d = (await r.json()).data || {};
    const total = Number(d.total_credits ?? 0), used = Number(d.total_usage ?? 0);
    this._balance = { total, used, available: total - used };
    this._balanceAt = Date.now();
    this.onBalance?.(this._balance);
    return this._balance;
  }

  startAutoSync(ms = 120000) {
    this.balance({ force: true }).catch(() => {});
    clearInterval(this._timer);
    this._timer = setInterval(() => this.balance({ force: true }).catch(() => {}), ms);
  }

  async models() {
    if (this._models) return this._models;
    const r = await fetch(`${API}/models`, { headers: this._h() });
    if (!r.ok) throw new Error(`Modelos indisponíveis (${r.status}).`);
    this._models = ((await r.json()).data || []).map(m => {
      const modality = m.architecture?.modality || 'text->text';
      const out = String(modality).split('->')[1] || 'text';
      const inPrice = Number(m.pricing?.prompt || 0);
      const outPrice = Number(m.pricing?.completion || 0);
      const imgPrice = Number(m.pricing?.image || 0);
      return {
        id: m.id,
        name: m.name || m.id,
        ctx: m.context_length || 0,
        modality,
        // GERA imagem = a saída inclui imagem. Não confundir com modelos que apenas LEEM imagem
        // (modalidade "text+image->text"), que era o erro da versão anterior.
        makesImages: out.includes('image') || (IMAGE_HINTS.test(m.id) && !out.includes('text')),
        inPrice, outPrice, imgPrice,
        free: inPrice === 0 && outPrice === 0,
        total: inPrice + outPrice,
      };
    });
    return this._models;
  }

  // Texto, separado em pagos e gratuitos. Os gratuitos são reais (a OpenRouter mantém modelos
  // com custo zero, geralmente com limite de requisições e fila compartilhada) — servem para
  // testar, não para sustentar uma sessão longa.
  async textModels() {
    const txt = (await this.models()).filter(m => !m.makesImages);
    return {
      pagos: txt.filter(m => !m.free).sort((a, b) => a.total - b.total),
      gratis: txt.filter(m => m.free).sort((a, b) => b.ctx - a.ctx),
    };
  }

  async imageModels() {
    let imgs = (await this.models()).filter(m => m.makesImages);
    if (!imgs.length) imgs = (await this.models()).filter(m => IMAGE_HINTS.test(m.id));
    return imgs.sort((a, b) => (a.imgPrice || a.total) - (b.imgPrice || b.total));
  }

  // Sugestão padrão: barato, mas não gratuito (gratuito costuma falhar em sessão longa).
  async suggest() {
    const { pagos, gratis } = await this.textModels();
    const imgs = await this.imageModels();
    const usable = pagos.filter(m => m.ctx >= 16000);
    const byFrag = (f) => pagos.find(m => m.id.includes(f));
    return {
      agentes: (byFrag('gpt-oss-20b') || usable[0] || pagos[0] || gratis[0])?.id || '',
      mestre: (byFrag('gpt-oss-120b') || usable[3] || usable[0] || pagos[0])?.id || '',
      imagem: (imgs.find(m => !m.free) || imgs[0])?.id || '',
    };
  }

  priceOf(id) { return (this._models || []).find(m => m.id === id) || null; }

  async chat(messages, { model, maxTokens = 500, temperature = 0.85, json = false } = {}) {
    const build = (useJson) => {
      const b = { model, messages, max_tokens: maxTokens, temperature, reasoning: { effort: 'low' } };
      if (useJson) b.response_format = { type: 'json_object' };
      return b;
    };

    const useJson = json && !this._noJson.has(model);
    let r = await fetch(`${API}/chat/completions`, { method: 'POST', headers: this._h(), body: JSON.stringify(build(useJson)) });

    // Nem todo modelo aceita response_format. Recusando, repete sem — o prompt já pede JSON.
    if (!r.ok && useJson && (r.status === 400 || r.status === 422)) {
      this._noJson.add(model);
      r = await fetch(`${API}/chat/completions`, { method: 'POST', headers: this._h(), body: JSON.stringify(build(false)) });
    }
    if (!r.ok) throw new Error(`${model}: HTTP ${r.status} — ${(await r.text().catch(() => '')).slice(0, 160)}`);

    const d = await r.json();
    if (d.error) throw new Error(`${model}: ${d.error.message || 'erro do provedor'}`);
    const u = d.usage || {};
    const m = this.priceOf(model);
    return {
      text: d.choices?.[0]?.message?.content ?? '',
      inTokens: u.prompt_tokens || 0,
      outTokens: u.completion_tokens || 0,
      cost: m ? m.inPrice * (u.prompt_tokens || 0) + m.outPrice * (u.completion_tokens || 0) : 0,
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
    const imgs = (d.choices?.[0]?.message?.images || []).map(i => i.image_url?.url).filter(Boolean);
    const u = d.usage || {}, m = this.priceOf(model);
    return { url: imgs[0] || null, cost: m ? m.inPrice * (u.prompt_tokens || 0) + m.outPrice * (u.completion_tokens || 0) : 0 };
  }
}
