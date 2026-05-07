import { CONFIG } from './config.js';

const P = CONFIG.storagePrefix;

function _key(k)    { return P + k; }
function _load(k, d){ try { return JSON.parse(localStorage.getItem(_key(k))) ?? d; } catch { return d; } }
function _save(k, v){ localStorage.setItem(_key(k), JSON.stringify(v)); }

// ─── Auto-increment ──────────────────────────────────────────────────────────
function getNextId() {
  const next = (_load('nextId', 0)) + 1;
  _save('nextId', next);
  return next;
}

// ─── CRUD ────────────────────────────────────────────────────────────────────
export function getNotes() {
  const notes = _load('notes', []);
  return notes.slice().sort((a, b) => a.prioridad - b.prioridad);
}

export function getNote(id) {
  return _load('notes', []).find(n => n.id === id) ?? null;
}

export function createNote(fields, user) {
  const id = getNextId();
  const now = new Date().toISOString();
  const note = {
    id,
    numero:        CONFIG.noteNumberFormat(id),
    fecha:         fields.fecha,
    destino:       fields.destino,
    productos:     fields.productos.filter(p => p.nombre.trim()),
    observaciones: (fields.observaciones || '').trim(),
    estatus:       'Nueva',
    unreadNew:     true,  // Agregado
    unreadModified: false, // Agregado
    creadoPor:     user.username,
    creadoEn:      now,
    modificadoPor: user.username,
    modificadoEn:  now,
    prioridad:     id,
  };
  const notes = _load('notes', []);
  notes.push(note);
  _save('notes', notes);
  return note;
}

export function updateNote(id, fields, user) {
  const notes = _load('notes', []);
  const idx = notes.findIndex(n => n.id === id);
  if (idx === -1) return null;
  const oldNote = { ...notes[idx], productos: [...notes[idx].productos] };

  // Ignorar banderas si el cambio es solo marcar como leído
  const isReadUpdate = fields.unreadNew !== undefined || fields.unreadModified !== undefined;
  
  let newUnreadModified = fields.unreadModified !== undefined ? fields.unreadModified : oldNote.unreadModified;
  let newUnreadNew = fields.unreadNew !== undefined ? fields.unreadNew : oldNote.unreadNew;

  // Modificación por admin en estado 'En Proceso' dispara notificación
  if (user.role === 'admin' && !isReadUpdate && oldNote.estatus === 'En Proceso') {
    newUnreadModified = true;
  }

  const updated = {
    ...notes[idx],
    ...(fields.fecha        !== undefined && { fecha: fields.fecha }),
    ...(fields.destino      !== undefined && { destino: fields.destino }),
    ...(fields.productos    !== undefined && { productos: fields.productos.filter(p => p.nombre.trim()) }),
    ...(fields.observaciones!== undefined && { observaciones: fields.observaciones.trim() }),
    ...(fields.estatus      !== undefined && { estatus: fields.estatus }),
    unreadNew: newUnreadNew,
    unreadModified: newUnreadModified,
    modificadoPor: user.username,
    modificadoEn:  new Date().toISOString(),
  };
  notes[idx] = updated;
  _save('notes', notes);
  return { old: oldNote, new: updated };
}

export function deleteNote(id) {
  const notes = _load('notes', []);
  const filtered = notes.filter(n => n.id !== id);
  if (filtered.length === notes.length) return false;
  _save('notes', filtered);
  return true;
}

// ─── Priority reorder ────────────────────────────────────────────────────────
export function moveNoteUp(id) {
  const notes = getNotes(); // sorted by prioridad
  const idx = notes.findIndex(n => n.id === id);
  if (idx <= 0) return;
  _swapPrioridad(notes, idx - 1, idx);
}

export function moveNoteDown(id) {
  const notes = getNotes();
  const idx = notes.findIndex(n => n.id === id);
  if (idx === -1 || idx >= notes.length - 1) return;
  _swapPrioridad(notes, idx, idx + 1);
}

function _swapPrioridad(sortedNotes, i, j) {
  const allNotes = _load('notes', []);
  const pI = sortedNotes[i].prioridad;
  const pJ = sortedNotes[j].prioridad;
  const nI = allNotes.find(n => n.id === sortedNotes[i].id);
  const nJ = allNotes.find(n => n.id === sortedNotes[j].id);
  if (nI) nI.prioridad = pJ;
  if (nJ) nJ.prioridad = pI;
  _save('notes', allNotes);
}

// ─── Seed data ───────────────────────────────────────────────────────────────
export function seedDemoNotes() {
  if (_load('notes', []).length > 0) return;
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const seeds = [
    {
      id: 1, numero: CONFIG.noteNumberFormat(1), prioridad: 1,
      fecha: today, destino: 'Planta de Producción',
      productos: [{ nombre: 'Conchas', cantidad: '20' }, { nombre: 'Cuernos', cantidad: '15' }, { nombre: 'Polvorones', cantidad: '30' }],
      observaciones: 'Entregar antes de las 6:00 pm. Polvorones solo si hay material.',
      estatus: 'En Proceso',
      creadoPor: 'admin1', creadoEn: yesterday + 'T09:00:00.000Z',
      modificadoPor: 'planta1', modificadoEn: today + 'T08:15:00.000Z',
    },
    {
      id: 2, numero: CONFIG.noteNumberFormat(2), prioridad: 2,
      fecha: today, destino: 'Planta de Producción',
      productos: [{ nombre: 'Pay de queso', cantidad: '8' }, { nombre: 'Carlota de limón', cantidad: '4' }],
      observaciones: '',
      estatus: 'Nueva',
      creadoPor: 'admin1', creadoEn: today + 'T07:30:00.000Z',
      modificadoPor: 'admin1', modificadoEn: today + 'T07:30:00.000Z',
    },
    {
      id: 3, numero: CONFIG.noteNumberFormat(3), prioridad: 3,
      fecha: yesterday, destino: 'Planta de Producción',
      productos: [{ nombre: 'Pastel de chocolate', cantidad: '2' }, { nombre: 'Tres leches', cantidad: '1' }],
      observaciones: 'El pastel de chocolate lleva decoración especial (ver foto en WhatsApp).',
      estatus: 'Completada',
      creadoPor: 'admin1', creadoEn: yesterday + 'T10:00:00.000Z',
      modificadoPor: 'planta1', modificadoEn: yesterday + 'T16:45:00.000Z',
    },
    {
      id: 4, numero: CONFIG.noteNumberFormat(4), prioridad: 4,
      fecha: yesterday, destino: 'Planta de Producción',
      productos: [{ nombre: 'Orejas', cantidad: '50' }],
      observaciones: 'Pedido cancelado por el cliente.',
      estatus: 'Cancelada',
      creadoPor: 'admin1', creadoEn: yesterday + 'T11:00:00.000Z',
      modificadoPor: 'admin1', modificadoEn: yesterday + 'T12:00:00.000Z',
    },
  ];
  _save('nextId', 4);
  _save('notes', seeds);
}
