// tokens.js — estimativa de tokens (heurística offline, sem depender de tokenizer externo)
// Regra prática usada pela indústria: ~4 caracteres por token em inglês/português misto.
// É só uma estimativa para decisões de orçamento (nunca corta nada, apenas prevê).

export function estimateTokens(text) {
  if (!text) return 0;
  const chars = String(text).length;
  return Math.ceil(chars / 3.6); // levemente conservador para PT-BR (acentos, etc.)
}

export function estimateMessagesTokens(messages) {
  return messages.reduce((sum, m) => sum + estimateTokens(m.content) + 4, 0);
}

// Formata USD pequeno com precisão útil (ex: $0.000342)
export function fmtUSD(value) {
  if (value === 0) return '$0,00';
  if (Math.abs(value) < 0.01) return `$${value.toFixed(6)}`;
  return `$${value.toFixed(4)}`;
}
