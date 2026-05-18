/// <reference path="./types.js" />
const DB_NAME = 'enote-local';
const DB_VERSION = 3;
const STORES = {
  NOTES_CACHE: 'notes_cache',
  PENDING_QUEUE: 'pending_queue',
  IMAGE_CACHE: 'image_cache',
};

let db = null;

async function openDB() {
  if (db) return db;
  db = await new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = e => {
      const database = e.target.result;
      if (!database.objectStoreNames.contains(STORES.NOTES_CACHE)) {
        database.createObjectStore(STORES.NOTES_CACHE, { keyPath: 'id' });
      }
      if (!database.objectStoreNames.contains(STORES.PENDING_QUEUE)) {
        database.createObjectStore(STORES.PENDING_QUEUE, { keyPath: 'localId', autoIncrement: true });
      }
      // v3: recrear IMAGE_CACHE con keyPath 'url' (pierde caché previo — aceptable).
      if (database.objectStoreNames.contains(STORES.IMAGE_CACHE)) {
        database.deleteObjectStore(STORES.IMAGE_CACHE);
      }
      database.createObjectStore(STORES.IMAGE_CACHE, { keyPath: 'url' });
    };
  });
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

async function dbPut(storeName, data) {
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const req = database.transaction(storeName, 'readwrite').objectStore(storeName).put(data);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function dbAdd(storeName, data) {
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const req = database.transaction(storeName, 'readwrite').objectStore(storeName).add(data);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function dbDelete(storeName, key) {
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const req = database.transaction(storeName, 'readwrite').objectStore(storeName).delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function dbClear(storeName) {
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const req = database.transaction(storeName, 'readwrite').objectStore(storeName).clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function syncNotesToCache(notes) {
  await dbClear(STORES.NOTES_CACHE);
  for (const note of notes) {
    await dbPut(STORES.NOTES_CACHE, note);
  }
}

export async function getOfflineNotes() {
  return dbGetAll(STORES.NOTES_CACHE);
}

export async function getOfflineNote(id) {
  return dbGet(STORES.NOTES_CACHE, id);
}

export async function createNoteOffline(noteData) {
  await dbAdd(STORES.PENDING_QUEUE, { ...noteData, synced: false, createdAt: new Date().toISOString() });
}

export async function getPendingNotes() {
  return dbGetAll(STORES.PENDING_QUEUE);
}

export async function deletePendingNote(localId) {
  await dbDelete(STORES.PENDING_QUEUE, localId);
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

export async function syncPendingNotes(createNoteFn) {
  const pending = await getPendingNotes();
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
      await dbPut(STORES.PENDING_QUEUE, { ...item, synced: true });
      await deletePendingNote(item.localId);
    }
  }
}

export async function getPendingCount() {
  return (await getPendingNotes()).length;
}

export function isOnline() {
  return navigator.onLine;
}

/**
 * Guarda un Blob en IMAGE_CACHE con keyPath 'url'.
 */
export async function saveImageToCache(url, blob) {
  return dbPut(STORES.IMAGE_CACHE, { url, blob });
}

/**
 * Recupera el registro completo { url, blob } del caché.
 */
export async function getImageFromCache(url) {
  return dbGet(STORES.IMAGE_CACHE, url);
}

/**
 * Descarga en paralelo (batches de 5) las imágenes de un set de notas.
 * Fire-and-forget — no se espera a que termine.
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
      try {
        const cached = await getImageFromCache(url);
        if (!cached) {
          const res = await fetch(url);
          if (res.ok) {
            await saveImageToCache(url, await res.blob());
          }
        }
      } catch {
        // ignorar fallos individuales
      }
    }));
  }
}

/**
 * Pre-cachea imágenes de un lote completo de notas.
 * Fire-and-forget — no bloquea el flujo principal.
 */
export async function preCacheAllImages(notes) {
  if (!isOnline()) return;
  const notesWithImages = notes.filter(n => n.imagenes && n.imagenes.length > 0);
  if (notesWithImages.length === 0) return;
  cacheImages(notesWithImages);
}
