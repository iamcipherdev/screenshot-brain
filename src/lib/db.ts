// ─── Minimal promise-based IndexedDB wrapper ──────────────────────────────
// Stores:
//   shots  — screenshot metadata (no blobs) — fast full-table scans
//   blobs  — { id, thumb, full } image data
//   colls  — collections
//   kv     — settings / chat history / misc

const DB_NAME = 'screenshot-brain';
const DB_VERSION = 2;

let dbp: Promise<IDBDatabase> | null = null;

export function openDb(): Promise<IDBDatabase> {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('shots')) {
        const s = db.createObjectStore('shots', { keyPath: 'id' });
        s.createIndex('addedAt', 'addedAt');
        s.createIndex('createdAt', 'createdAt');
        s.createIndex('value', 'value');
      }
      if (!db.objectStoreNames.contains('blobs')) db.createObjectStore('blobs', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('colls')) db.createObjectStore('colls', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
      if (!db.objectStoreNames.contains('convos')) {
        const c = db.createObjectStore('convos', { keyPath: 'id' });
        c.createIndex('updatedAt', 'updatedAt');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbp;
}

function tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then((db) => new Promise<T>((resolve, reject) => {
    const t = db.transaction(store, mode);
    const req = fn(t.objectStore(store));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }));
}

// kv ------------------------------------------------------------
export async function kvGet<T>(key: string): Promise<T | undefined> {
  return tx<T | undefined>('kv', 'readonly', (s) => s.get(key) as IDBRequest<T | undefined>);
}
export async function kvSet<T>(key: string, val: T): Promise<void> {
  await tx('kv', 'readwrite', (s) => s.put(val, key) as unknown as IDBRequest<IDBValidKey>);
}
export async function kvDel(key: string): Promise<void> {
  await tx('kv', 'readwrite', (s) => s.delete(key) as unknown as IDBRequest<undefined>);
}

// shots ----------------------------------------------------------
export async function allShots<T>(): Promise<T[]> {
  return tx<T[]>('shots', 'readonly', (s) => s.getAll() as IDBRequest<T[]>);
}
export async function getShot<T>(id: string): Promise<T | undefined> {
  return tx<T | undefined>('shots', 'readonly', (s) => s.get(id) as IDBRequest<T | undefined>);
}
export async function putShot<T>(shot: T): Promise<void> {
  await tx('shots', 'readwrite', (s) => s.put(shot) as unknown as IDBRequest<IDBValidKey>);
}
export async function putShots<T>(shots: T[]): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const t = db.transaction('shots', 'readwrite');
    const s = t.objectStore('shots');
    for (const shot of shots) s.put(shot);
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}
export async function delShot(id: string): Promise<void> {
  await tx('shots', 'readwrite', (s) => s.delete(id) as unknown as IDBRequest<undefined>);
}

// blobs ----------------------------------------------------------
export async function putBlobs(rec: { id: string; thumb: Blob; full: Blob }): Promise<void> {
  await tx('blobs', 'readwrite', (s) => s.put(rec) as unknown as IDBRequest<IDBValidKey>);
}
export async function getBlobs(id: string): Promise<{ id: string; thumb: Blob; full: Blob } | undefined> {
  return tx('blobs', 'readonly', (s) => s.get(id) as IDBRequest<{ id: string; thumb: Blob; full: Blob } | undefined>);
}
export async function getThumb(id: string): Promise<Blob | undefined> {
  const rec = await getBlobs(id);
  return rec?.thumb;
}

// collections ------------------------------------------------------
export async function allColls<T>(): Promise<T[]> {
  return tx<T[]>('colls', 'readonly', (s) => s.getAll() as IDBRequest<T[]>);
}
export async function putColl<T>(c: T): Promise<void> {
  await tx('colls', 'readwrite', (s) => s.put(c) as unknown as IDBRequest<IDBValidKey>);
}
export async function delColl(id: string): Promise<void> {
  await tx('colls', 'readwrite', (s) => s.delete(id) as unknown as IDBRequest<undefined>);
}

// conversations ----------------------------------------------------
export async function allConvos<T>(): Promise<T[]> {
  return tx<T[]>('convos', 'readonly', (s) => s.getAll() as IDBRequest<T[]>);
}
export async function getConvo<T>(id: string): Promise<T | undefined> {
  return tx<T | undefined>('convos', 'readonly', (s) => s.get(id) as IDBRequest<T | undefined>);
}
export async function putConvo<T>(c: T): Promise<void> {
  await tx('convos', 'readwrite', (s) => s.put(c) as unknown as IDBRequest<IDBValidKey>);
}
export async function delConvo(id: string): Promise<void> {
  await tx('convos', 'readwrite', (s) => s.delete(id) as unknown as IDBRequest<undefined>);
}

// nuke -------------------------------------------------------------
export async function wipeAll(): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const t = db.transaction(['shots', 'blobs', 'colls', 'kv', 'convos'], 'readwrite');
    t.objectStore('shots').clear();
    t.objectStore('blobs').clear();
    t.objectStore('colls').clear();
    t.objectStore('kv').clear();
    t.objectStore('convos').clear();
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}
