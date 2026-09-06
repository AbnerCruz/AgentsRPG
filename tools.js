// tools.js — ferramentas que o SITE fornece (nunca os agentes geram isso durante o turno deles):
// mapa em grid quadriculado com tokens posicionais, acervo de artefatos editável, imagens.

import { put, get, getAll, del, uid } from './db.js';
import { movementSquaresAllowed, gridDistance } from './rules.js';

// ---- Mapa em grid ----
export class GridMap {
  constructor(canvas, { cols = 20, rows = 15, cellSize = 32, backgroundImage = null } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.cols = cols; this.rows = rows; this.cellSize = cellSize;
    this.backgroundImage = backgroundImage; // dataURL ou null
    this.tokens = []; // { id, name, x, y, color, ownerAgentId, speedMeters }
    canvas.width = cols * cellSize;
    canvas.height = rows * cellSize;
  }

  addToken(token) {
    this.tokens.push({ id: token.id || uid('tok'), color: '#c0392b', ...token });
    this.render();
  }

  moveToken(id, x, y, { enforceLimit = true } = {}) {
    const tok = this.tokens.find(t => t.id === id);
    if (!tok) return false;
    if (enforceLimit && tok.origin) {
      const allowed = movementSquaresAllowed(tok.speedMeters || 9);
      const dist = gridDistance(tok.origin, { x, y });
      if (dist > allowed) return { ok: false, reason: `Movimento excede o deslocamento permitido (${allowed} casas).` };
    }
    tok.x = Math.max(0, Math.min(this.cols - 1, x));
    tok.y = Math.max(0, Math.min(this.rows - 1, y));
    this.render();
    return { ok: true };
  }

  startTurnFor(id) {
    const tok = this.tokens.find(t => t.id === id);
    if (tok) tok.origin = { x: tok.x, y: tok.y };
  }

  render() {
    const { ctx, cols, rows, cellSize } = this;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    if (this.backgroundImage) {
      const img = new Image();
      img.src = this.backgroundImage;
      ctx.drawImage(img, 0, 0, this.canvas.width, this.canvas.height);
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    for (let c = 0; c <= cols; c++) {
      ctx.beginPath(); ctx.moveTo(c * cellSize, 0); ctx.lineTo(c * cellSize, rows * cellSize); ctx.stroke();
    }
    for (let r = 0; r <= rows; r++) {
      ctx.beginPath(); ctx.moveTo(0, r * cellSize); ctx.lineTo(cols * cellSize, r * cellSize); ctx.stroke();
    }
    for (const tok of this.tokens) {
      const cx = tok.x * cellSize + cellSize / 2;
      const cy = tok.y * cellSize + cellSize / 2;
      ctx.beginPath();
      ctx.arc(cx, cy, cellSize * 0.4, 0, Math.PI * 2);
      ctx.fillStyle = tok.color;
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = `${Math.floor(cellSize * 0.35)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText((tok.name || '?').slice(0, 2).toUpperCase(), cx, cy + cellSize * 0.12);
    }
  }

  async saveState(mapId, name) {
    await put('maps', { id: mapId || uid('map'), name, cols: this.cols, rows: this.rows, cellSize: this.cellSize, backgroundImage: this.backgroundImage, tokens: this.tokens, updatedAt: Date.now() });
  }
}

// ---- Acervo de artefatos (documentos de campanha editáveis: NPCs, locais, itens, logs) ----
export async function saveArtifact({ id, type, title, content, tags = [] }) {
  const artId = id || uid('art');
  await put('artifacts', { id: artId, type, title, content, tags, updatedAt: Date.now() });
  return artId;
}

export async function listArtifacts(type = null) {
  const all = await getAll('artifacts');
  return type ? all.filter(a => a.type === type) : all;
}

export async function deleteArtifact(id) {
  return del('artifacts', id);
}

// ---- Imagens geradas (armazenadas como dataURL dentro do artefato, sem servidor externo) ----
export async function saveGeneratedImage({ title, dataUrl, promptUsed, tags = [] }) {
  return saveArtifact({ type: 'imagem', title, content: { dataUrl, promptUsed }, tags });
}
