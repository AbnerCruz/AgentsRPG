// db.js — persistência local. Sem backend, sem servidor.

const DB_NAME = 'mesa_rpg_ia';
const DB_VERSION = 2;
export const STORES = ['config', 'agents', 'memories_long', 'memories_short', 'artifacts', 'sessions', 'world'];

let _db = null;

export function openDB() {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      for (const s of STORES) if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: 'id' });
    };
    req.onsuccess = (e) => { _db = e.target.result; resolve(_db); };
    req.onerror = (e) => reject(e.target.error);
  });
}

export async function put(store, obj) {
  const db = await openDB();
  return new Promise((res, rej) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).put(obj);
    tx.oncomplete = () => res(obj);
    tx.onerror = (e) => rej(e.target.error);
  });
}

export async function get(store, id) {
  const db = await openDB();
  return new Promise((res, rej) => {
    const tx = db.transaction(store, 'readonly');
    const r = tx.objectStore(store).get(id);
    r.onsuccess = () => res(r.result || null);
    r.onerror = (e) => rej(e.target.error);
  });
}

export async function getAll(store) {
  const db = await openDB();
  return new Promise((res, rej) => {
    const tx = db.transaction(store, 'readonly');
    const r = tx.objectStore(store).getAll();
    r.onsuccess = () => res(r.result || []);
    r.onerror = (e) => rej(e.target.error);
  });
}

export async function del(store, id) {
  const db = await openDB();
  return new Promise((res, rej) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).delete(id);
    tx.oncomplete = () => res(true);
    tx.onerror = (e) => rej(e.target.error);
  });
}

export async function clearAll() {
  const db = await openDB();
  for (const s of STORES) {
    await new Promise((res, rej) => {
      const tx = db.transaction(s, 'readwrite');
      tx.objectStore(s).clear();
      tx.oncomplete = res;
      tx.onerror = (e) => rej(e.target.error);
    });
  }
}

export async function exportZip() {
  const dump = {};
  for (const s of STORES) dump[s] = await getAll(s);
  const zip = new JSZip();
  zip.file('save.json', JSON.stringify(dump));
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
}

export async function importZip(file) {
  const zip = await JSZip.loadAsync(file);
  const entry = zip.file('save.json') || zip.file('mesa-rpg-ia-save.json');
  if (!entry) throw new Error('Save não encontrado no zip.');
  const dump = JSON.parse(await entry.async('string'));
  await clearAll();
  for (const s of STORES) for (const row of (dump[s] || [])) await put(s, row);
}

export const uid = (p = 'id') => `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
