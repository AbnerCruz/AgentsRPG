// db.js — persistência local via IndexedDB, sem backend, sem servidor.
// Stores: config, agents, memories_long, memories_short, artifacts, logs, sessions, maps

const DB_NAME = 'mesa_rpg_ia';
const DB_VERSION = 1;
const STORES = ['config', 'agents', 'memories_long', 'memories_short', 'artifacts', 'logs', 'sessions', 'maps', 'rules_cache'];

let _db = null;

export function openDB() {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      for (const store of STORES) {
        if (!db.objectStoreNames.contains(store)) {
          db.createObjectStore(store, { keyPath: 'id' });
        }
      }
    };
    req.onsuccess = (e) => { _db = e.target.result; resolve(_db); };
    req.onerror = (e) => reject(e.target.error);
  });
}

export async function put(store, obj) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).put(obj);
    tx.oncomplete = () => resolve(obj);
    tx.onerror = (e) => reject(e.target.error);
  });
}

export async function get(store, id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = (e) => reject(e.target.error);
  });
}

export async function getAll(store) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = (e) => reject(e.target.error);
  });
}

export async function del(store, id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).delete(id);
    tx.oncomplete = () => resolve(true);
    tx.onerror = (e) => reject(e.target.error);
  });
}

export async function clearAll() {
  const db = await openDB();
  for (const store of STORES) {
    await new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readwrite');
      tx.objectStore(store).clear();
      tx.oncomplete = resolve;
      tx.onerror = (e) => reject(e.target.error);
    });
  }
}

// ---- Export / Import (zip) ----
// Usa JSZip (carregado via CDN no index.html)

export async function exportAllToZip() {
  const dump = {};
  for (const store of STORES) {
    dump[store] = await getAll(store);
  }
  const zip = new JSZip();
  zip.file('mesa-rpg-ia-save.json', JSON.stringify(dump, null, 2));
  // artefatos binários (imagens geradas em base64) já vêm embutidos no JSON como dataURL,
  // então um único arquivo json dentro do zip é suficiente e mais simples de restaurar.
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  return blob;
}

export async function importFromZipFile(file) {
  const zip = await JSZip.loadAsync(file);
  const entry = zip.file('mesa-rpg-ia-save.json');
  if (!entry) throw new Error('Arquivo de save não encontrado dentro do zip (esperado: mesa-rpg-ia-save.json).');
  const text = await entry.async('string');
  const dump = JSON.parse(text);
  await clearAll();
  for (const store of STORES) {
    const rows = dump[store] || [];
    for (const row of rows) await put(store, row);
  }
  return true;
}

export function uid(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
