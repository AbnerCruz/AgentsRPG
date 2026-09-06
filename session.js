// session.js — controla o "caixa" do site (lastreado, sem reset), o limite artificial por
// sessão, e o encerramento com resumo obrigatório antes de zerar.
//
// Regras confirmadas com o jogador:
// - O caixa do site é <= saldo real da OpenRouter, e é consumido de forma permanente
//   (não há reset semanal: consumiu, consumiu; saldo extra de uma sessão vai pra próxima).
// - O limite POR SESSÃO = caixa restante ÷ sessões restantes previstas (recalculado a cada sessão,
//   já que o saldo vai mudando).
// - Nunca corta uma chamada de IA no meio. Quando o consumo acumulado da sessão atinge o limite
//   artificial de encerramento (calculado dinamicamente, não um % fixo arbitrário), a PRÓXIMA ação
//   do mestre é obrigatoriamente gerar o resumo de fechamento da cena, e então a sessão encerra.
// - O saldo que sobrar (o limite da sessão menos o efetivamente gasto) volta pro caixa comum.

import { put, get, getAll, uid } from './db.js';

export class SessionController {
  constructor({ config }) {
    this.config = config; // { caixaTotalUSD, sessoesPorSemana, ... }
    this.current = null; // sessão ativa
  }

  static async loadConfig() {
    return (await get('config', 'main')) || defaultConfig();
  }

  static async saveConfig(cfg) {
    await put('config', { id: 'main', ...cfg });
    return cfg;
  }

  // Estima o custo de um "resumo de fechamento" com base no modelo do mestre, para saber
  // com quanta antecedência precisamos parar de abrir novas cenas dentro do limite da sessão.
  static estimateClosingReserveUSD(masterModelPricing, avgClosingOutputTokens = 400) {
    if (!masterModelPricing) return 0;
    return Number(masterModelPricing.completion || 0) * avgClosingOutputTokens * 1.3; // margem de 30%
  }

  async startSession({ caixaRestanteUSD, sessoesRestantes, masterModelPricing }) {
    const limiteSessaoUSD = sessoesRestantes > 0 ? caixaRestanteUSD / sessoesRestantes : caixaRestanteUSD;
    const reservaFechamentoUSD = SessionController.estimateClosingReserveUSD(masterModelPricing);
    const limiteArtificialUSD = Math.max(0, limiteSessaoUSD - reservaFechamentoUSD);

    this.current = {
      id: uid('session'),
      startedAt: Date.now(),
      endedAt: null,
      limiteSessaoUSD,
      reservaFechamentoUSD,
      limiteArtificialUSD,
      gastoAcumuladoUSD: 0,
      status: 'ativa', // 'ativa' | 'encerrando' | 'encerrada'
      chamadas: [], // { agentId, modelId, promptTokens, completionTokens, custoUSD, ts }
    };
    await put('sessions', this.current);
    return this.current;
  }

  // Registra o custo de UMA chamada de IA já concluída (nunca antes — a chamada sempre termina).
  async registerCall({ agentId, modelId, promptTokens, completionTokens, custoUSD }) {
    if (!this.current) throw new Error('Nenhuma sessão ativa.');
    this.current.gastoAcumuladoUSD += custoUSD;
    this.current.chamadas.push({ agentId, modelId, promptTokens, completionTokens, custoUSD, ts: Date.now() });

    if (this.current.status === 'ativa' && this.current.gastoAcumuladoUSD >= this.current.limiteArtificialUSD) {
      this.current.status = 'encerrando'; // sinaliza: próxima ação do mestre = resumo de fechamento
    }
    await put('sessions', this.current);
    return this.current;
  }

  shouldForceClosingSummary() {
    return this.current?.status === 'encerrando';
  }

  async finishSession({ caixaAtualUSD }) {
    if (!this.current) throw new Error('Nenhuma sessão ativa.');
    this.current.status = 'encerrada';
    this.current.endedAt = Date.now();
    await put('sessions', this.current);

    const sobra = this.current.limiteSessaoUSD - this.current.gastoAcumuladoUSD;
    const novoCaixa = Math.max(0, caixaAtualUSD - this.current.gastoAcumuladoUSD);
    const finished = this.current;
    this.current = null;
    return { sessionSummary: finished, sobraUSD: sobra, novoCaixaUSD: novoCaixa };
  }

  getMetrics() {
    if (!this.current) return null;
    const restante = Math.max(0, this.current.limiteArtificialUSD - this.current.gastoAcumuladoUSD);
    const pctUsado = this.current.limiteSessaoUSD > 0
      ? (this.current.gastoAcumuladoUSD / this.current.limiteSessaoUSD) * 100
      : 0;
    return {
      gastoAcumuladoUSD: this.current.gastoAcumuladoUSD,
      limiteSessaoUSD: this.current.limiteSessaoUSD,
      limiteArtificialUSD: this.current.limiteArtificialUSD,
      restanteAntesDoFechamentoUSD: restante,
      pctUsado,
      totalChamadas: this.current.chamadas.length,
      status: this.current.status,
    };
  }
}

function defaultConfig() {
  return {
    id: 'main',
    apiKey: '', managementKey: '',
    caixaTotalUSD: 0,
    sessoesPorSemana: 1,
    modeloAgentes: 'openai/gpt-oss-20b',
    modeloMestre: 'openai/gpt-oss-120b',
    modeloImagem: '',
    sistemaRegras: 'dnd5e-srd', // 'dnd5e-srd' | 'custom'
  };
}
