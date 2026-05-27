/// <reference path="./types.js" />
const DB_NAME = 'enote-local';
const DB_VERSION = 4;
const STORES = {
  NOTES_CACHE: 'notes_cache',
  PENDING_QUEUE: 'pending_queue',
  IMAGE_CACHE: 'image_cache',
};

const MAX_IMAGE_CACHE = 500;
const FETCH_TIMEOUT_MS = 10000;

let db = null;
let _syncing = false;

async function openDB() {
  if (db) return db;
  db = await new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onblocked = () => {
      console.warn('IndexedDB open blocked by another tab');
      reject(new Error('DB bloqueada por otra pestaña — cierra otras pestañas de Enote'));
    };
    req.onupgradeneeded = e => {
      const database = e.target.result;
      const tx = e.target.transaction;
      // v1+: stores iniciales
      if (!database.objectStoreNames.contains(STORES.NOTES_CACHE)) {
        database.createObjectStore(STORES.NOTES_CACHE, { keyPath: 'id' });
      }
      if (!database.objectStoreNames.contains(STORES.PENDING_QUEUE)) {
        database.createObjectStore(STORES.PENDING_QUEUE, { keyPath: 'localId', autoIncrement: true });
      }
      // v2→v3: recrear IMAGE_CACHE con nuevo schema (keyPath url + índice cachedAt)
      if (e.oldVersion < 3) {
        if (database.objectStoreNames.contains(STORES.IMAGE_CACHE)) {
          database.deleteObjectStore(STORES.IMAGE_CACHE);
        }
        const imgStore = database.createObjectStore(STORES.IMAGE_CACHE, { keyPath: 'url' });
        imgStore.createIndex('cachedAt', 'cachedAt', { unique: false });
      }
      // v3→v4: backfill _userId desde _session.userId para items legacy (creados en v1.2 sin O1 fix)
      if (e.oldVersion >= 2 && e.oldVersion < 4 && database.objectStoreNames.contains(STORES.PENDING_QUEUE)) {
        const store = tx.objectStore(STORES.PENDING_QUEUE);
        const getAllReq = store.getAll();
        getAllReq.onsuccess = () => {
          for (const item of getAllReq.result) {
            if (item._userId === undefined && item._session?.userId) {
              store.put({ ...item, _userId: item._session.userId });
            }
          }
        };
      }
    };
  });
  db.onclose = () => { db = null; };
  db.onversionchange = () => { try { db.close(); } catch {} db = null; };
  return db;
}

async function dbGet(storeName, key) {
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const req = database.transaction(storeName, 'readonly').objectStore(storeName).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function dbGetAll(storeName) {
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const req = database.transaction(storeName, 'readonly').objectStore(storeName).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function dbCount(storeName) {
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const req = database.transaction(storeName, 'readonly').objectStore(storeName).count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// Resolver en tx.oncomplete garantiza que el commit terminó antes de continuar.
async function dbPut(storeName, data) {
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(storeName, 'readwrite');
    let result;
    const req = tx.objectStore(storeName).put(data);
    req.onsuccess = () => { result = req.result; };
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Transaction aborted'));
  });
}

async function dbAdd(storeName, data) {
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(storeName, 'readwrite');
    let result;
    const req = tx.objectStore(storeName).add(data);
    req.onsuccess = () => { result = req.result; };
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Transaction aborted'));
  });
}

async function dbDelete(storeName, key) {
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Transaction aborted'));
  });
}

async function dbClear(storeName) {
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Transaction aborted'));
  });
}

/**
 * Reemplaza el caché de notas en una sola transacción atómica.
 * Si la TX falla, el caché previo queda intacto.
 */
export async function syncNotesToCache(notes) {
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORES.NOTES_CACHE, 'readwrite');
    const store = tx.objectStore(STORES.NOTES_CACHE);
    store.clear();
    for (const note of notes) store.put(note);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Transaction aborted'));
  });
}

export async function getOfflineNotes() {
  return dbGetAll(STORES.NOTES_CACHE);
}

export async function getOfflineNote(id) {
  return dbGet(STORES.NOTES_CACHE, id);
}

/**
 * Encola nota offline con scope por userId para evitar que otro usuario la sincronice.
 */
export async function createNoteOffline(noteData, userId) {
  await dbAdd(STORES.PENDING_QUEUE, {
    ...noteData,
    _userId: userId,
    synced: false,
    createdAt: new Date().toISOString(),
  });
}

/**
 * Devuelve solo las notas pendientes del userId dado (si no se pasa, todas).
 */
export async function getPendingNotes(userId) {
  const all = await dbGetAll(STORES.PENDING_QUEUE);
  if (!userId) return all;
  return all.filter(item =>
    item._userId === userId ||
    // items legacy (v1.2) sin _userId: asumir pertenecen al usuario actual como fallback seguro
    (item._userId === undefined && (item._session?.userId === userId || !item._session))
  );
}

export async function deletePendingNote(localId) {
  await dbDelete(STORES.PENDING_QUEUE, localId);
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

/**
 * Sincroniza notas pendientes hacia el servidor.
 * Guardia anti-concurrencia evita doble disparo por eventos online consecutivos.
 * No marca synced:true antes de borrar — atomicidad simplificada.
 */
export async function syncPendingNotes(createNoteFn, userId, onPermanentFailure) {
  if (_syncing) return;
  _syncing = true;
  try {
    const pending = await getPendingNotes(userId);
    for (const item of pending) {
      let success = false;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          await createNoteFn(item);
          success = true;
          break;
        } catch {
          if (attempt < 3) await sleep(1000 * Math.pow(2, attempt - 1));
        }
      }
      if (success) {
        await deletePendingNote(item.localId);
      } else {
        const failCount = (item._failCount || 0) + 1;
        if (failCount >= 9) {
          // Falla permanente — eliminar de cola y notificar al caller
          console.error('Pending note permanently failed after 9 attempts:', item.localId);
          try { await deletePendingNote(item.localId); } catch {}
          if (onPermanentFailure) onPermanentFailure(item);
        } else {
          try { await dbPut(STORES.PENDING_QUEUE, { ...item, _failCount: failCount }); } catch {}
        }
      }
    }
  } finally {
    _syncing = false;
  }
}

export async function getPendingCount(userId) {
  return (await getPendingNotes(userId)).length;
}

export function isOnline() {
  return navigator.onLine;
}

/**
 * Limpia todos los stores. Usado al hacer logout para evitar PII residual.
 */
export async function clearAllOfflineData() {
  for (const store of Object.values(STORES)) {
    try { await dbClear(store); } catch { /* ignorar errores por store */ }
  }
}

/**
 * Guarda un Blob en IMAGE_CACHE con keyPath 'url' y aplica evicción FIFO si excede MAX_IMAGE_CACHE.
 */
export async function saveImageToCache(url, blob) {
  try {
    const count = await dbCount(STORES.IMAGE_CACHE);
    if (count >= MAX_IMAGE_CACHE) {
      await evictOldestImage();
    }
  } catch { /* si el conteo falla, igual intentar put */ }
  return dbPut(STORES.IMAGE_CACHE, { url, blob, cachedAt: Date.now() });
}

async function evictOldestImage() {
  const database = await openDB();
  return new Promise((resolve) => {
    const tx = database.transaction(STORES.IMAGE_CACHE, 'readwrite');
    const store = tx.objectStore(STORES.IMAGE_CACHE);
    let idx;
    try { idx = store.index('cachedAt'); } catch { resolve(); return; }
    const req = idx.openCursor();
    req.onsuccess = (e) => {
      const cursor = e.target.result;
      if (cursor) {
        store.delete(cursor.primaryKey);
      }
      resolve();
    };
    req.onerror = () => resolve();
  });
}

export async function getImageFromCache(url) {
  return dbGet(STORES.IMAGE_CACHE, url);
}

/**
 * Descarga imágenes en paralelo (batches de 5) con timeout por fetch.
 */
export async function cacheImages(notes) {
  if (!isOnline()) return;

  const allUrls = notes.flatMap(n =>
    (n.imagenes || [])
      .map(img => typeof img === 'string' ? img : img.url)
      .filter(u => u && !u.startsWith('blob:') && !u.startsWith('data:'))
  );
  if (allUrls.length === 0) return;

  const batch = (arr, size) => {
    const result = [];
    for (let i = 0; i < arr.length; i += size) result.push(arr.slice(i, i + size));
    return result;
  };

  for (const urlBatch of batch(allUrls, 5)) {
    await Promise.all(urlBatch.map(async url => {
      const cached = await getImageFromCache(url).catch(() => null);
      if (cached) return;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      try {
        const res = await fetch(url, { signal: controller.signal });
        if (res.ok) {
          await saveImageToCache(url, await res.blob());
        }
      } catch {
        // ignorar timeout y otros fallos individuales
      } finally {
        clearTimeout(timeout);
      }
    }));
  }
}

/**
 * Pre-cachea imágenes de un lote completo de notas. Fire-and-forget.
 */
export async function preCacheAllImages(notes) {
  if (!isOnline()) return;
  const notesWithImages = notes.filter(n => n.imagenes && n.imagenes.length > 0);
  if (notesWithImages.length === 0) return;
  cacheImages(notesWithImages);
}
