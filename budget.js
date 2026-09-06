// budget.js — caixa lastreado e limite artificial por sessão.

import { put, get } from './db.js';

export class Budget {
  constructor(cfg) {
    this.cfg = cfg;
    this.session = null;
  }

  start({ saldoProvedor, modeloMestrePrice }) {
    const caixa = Math.min(this.cfg.caixaUSD || 0, saldoProvedor);
    const sessoes = this.cfg.sessoesPorSemana || 1;
    const limite = sessoes > 0 ? caixa / sessoes : caixa;
    // reserva dinâmica = custo estimado do resumo de fechamento (não um % fixo arbitrário)
    const reserva = modeloMestrePrice ? modeloMestrePrice.outPrice * 450 * 1.4 : limite * 0.03;
    this.session = {
      id: `s_${Date.now()}`,
      limite,
      reserva,
      limiteArtificial: Math.max(0, limite - reserva),
      gasto: 0,
      tokens: 0,
      chamadas: 0,
      status: 'ativa',
      iniciada: Date.now(),
    };
    return this.session;
  }

  // Sempre registrado DEPOIS da chamada terminar — nada é cortado no meio.
  register(cost, tokens) {
    if (!this.session) return null;
    this.session.gasto += cost;
    this.session.tokens += tokens;
    this.session.chamadas++;
    if (this.session.status === 'ativa' && this.session.gasto >= this.session.limiteArtificial) {
      this.session.status = 'encerrando';
    }
    return this.session;
  }

  mustClose() { return this.session?.status === 'encerrando'; }

  async finish() {
    if (!this.session) return null;
    this.session.status = 'encerrada';
    this.session.fim = Date.now();
    await put('sessions', { ...this.session });
    const gasto = this.session.gasto;
    this.cfg.caixaUSD = Math.max(0, (this.cfg.caixaUSD || 0) - gasto);
    await put('config', { id: 'main', ...this.cfg });
    const s = this.session;
    this.session = null;
    return { gasto, sobra: s.limite - gasto, caixa: this.cfg.caixaUSD };
  }

  pct() {
    if (!this.session || !this.session.limite) return 0;
    return Math.min(100, (this.session.gasto / this.session.limite) * 100);
  }
}
