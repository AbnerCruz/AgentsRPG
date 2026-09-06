// openrouter.js — toda comunicação com a API OpenRouter.
// Nunca guarda as chaves em disco fora do IndexedDB local do próprio navegador do usuário.

const API_BASE = 'https://openrouter.ai/api/v1';

export class OpenRouterClient {
  constructor({ apiKey, managementKey } = {}) {
    this.apiKey = apiKey || '';
    this.managementKey = managementKey || '';
  }

  setKeys({ apiKey, managementKey }) {
    if (apiKey !== undefined) this.apiKey = apiKey;
    if (managementKey !== undefined) this.managementKey = managementKey;
  }

  _headers(useManagement = false) {
    const key = useManagement ? (this.managementKey || this.apiKey) : this.apiKey;
    return {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': location.href,
      'X-Title': 'Mesa RPG IA',
    };
  }

  // Saldo real da conta OpenRouter (usa management key se disponível, senão api key)
  async getCredits() {
    const res = await fetch(`${API_BASE}/credits`, { headers: this._headers(true) });
    if (!res.ok) throw new Error(`Falha ao consultar saldo (${res.status}). Verifique as chaves.`);
    const data = await res.json();
    // formato: { data: { total_credits, total_usage } }
    const d = data.data || {};
    const totalCredits = Number(d.total_credits ?? 0);
    const totalUsage = Number(d.total_usage ?? 0);
    return { totalCredits, totalUsage, available: totalCredits - totalUsage };
  }

  async listModels() {
    const res = await fetch(`${API_BASE}/models`, { headers: this._headers(false) });
    if (!res.ok) throw new Error(`Falha ao listar modelos (${res.status}).`);
    const data = await res.json();
    return (data.data || []).map(m => ({
      id: m.id,
      name: m.name || m.id,
      contextLength: m.context_length,
      pricing: m.pricing, // { prompt, completion, image, ... } por token, string USD
      modality: m.architecture?.modality || 'text->text',
    }));
  }

  // Chamada de chat padrão. messages: [{role, content}]
  // opts: { model, maxTokens, temperature, reasoningEffort }
  async chat(messages, opts = {}) {
    const body = {
      model: opts.model,
      messages,
      max_tokens: opts.maxTokens ?? 700,
      temperature: opts.temperature ?? 0.8,
    };
    // Suporte a "esforço de raciocínio" reduzido quando o modelo aceita (economia de tokens de pensamento)
    if (opts.reasoningEffort) {
      body.reasoning = { effort: opts.reasoningEffort }; // "low" | "medium" | "high"
    }
    const t0 = performance.now();
    const res = await fetch(`${API_BASE}/chat/completions`, {
      method: 'POST',
      headers: this._headers(false),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Erro na chamada de IA (${res.status}): ${errText}`);
    }
    const data = await res.json();
    const usage = data.usage || {};
    return {
      text: data.choices?.[0]?.message?.content ?? '',
      promptTokens: usage.prompt_tokens ?? 0,
      completionTokens: usage.completion_tokens ?? 0,
      totalTokens: usage.total_tokens ?? 0,
      model: data.model || opts.model,
      latencyMs: Math.round(performance.now() - t0),
      raw: data,
    };
  }

  // Geração de imagem via modelo de imagem da OpenRouter (ex: modelos com modality image)
  async generateImage(prompt, opts = {}) {
    const body = {
      model: opts.model,
      messages: [{ role: 'user', content: prompt }],
      modalities: ['image', 'text'],
    };
    const res = await fetch(`${API_BASE}/chat/completions`, {
      method: 'POST',
      headers: this._headers(false),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Erro na geração de imagem (${res.status}): ${errText}`);
    }
    const data = await res.json();
    const msg = data.choices?.[0]?.message || {};
    // imagens retornam em msg.images[] como data URL (formato OpenRouter multimodal)
    const images = (msg.images || []).map(img => img.image_url?.url).filter(Boolean);
    return { images, usage: data.usage || {}, raw: data };
  }

  // Estima custo de uma chamada dado o pricing do modelo (USD por token) e tokens usados
  static estimateCostUSD(pricing, promptTokens, completionTokens) {
    if (!pricing) return 0;
    const p = Number(pricing.prompt || 0) * promptTokens;
    const c = Number(pricing.completion || 0) * completionTokens;
    return p + c;
  }
}
