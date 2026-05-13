const DB_NAME = 'enote-local';
const DB_VERSION = 1;
const STORES = { NOTES_CACHE: 'notes_cache', PENDING_QUEUE: 'pending_queue' };

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
    };
  });
  return db;
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
      await deletePendingNote(item.localId);
    }
  }
}

export function isOnline() {
  return navigator.onLine;
}