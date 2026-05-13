import { CONFIG } from './config.js';
import { supabase, isSupabaseConfigured, uploadImage } from './supabase.js';
import { isDemoMode, login as authLogin, clearSession, requireAuth } from './auth.js';
import { cacheImages, saveImageToCache } from './offline.js';

const P = CONFIG.storagePrefix;
const NOTES_KEY = P + 'notes';

/**
 * Procesa las imágenes de una nota: las sube a Supabase si estamos online
 * y las guarda en el caché local de IndexedDB.
 */
async function processImages(imagenes) {
  if (!imagenes || !Array.isArray(imagenes)) return [];

  const processed = [];
  for (const img of imagenes) {
    // Si ya es una URL de Supabase (string), la mantenemos
    if (typeof img === 'string') {
      processed.push(img);
      continue;
    }

    // Si es un objeto de imagen nueva (con Blob)
    if (img.blob) {
      if (!isDemoMode()) {
        try {
          // Subir a Supabase Storage
          const publicUrl = await uploadImage(img.blob, img.nombre);
          // Guardar en caché local usando la nueva URL como llave
          await saveImageToCache(publicUrl, img.blob);
          processed.push(publicUrl);
        } catch (err) {
          console.error('Error al subir imagen a Supabase:', err);
          throw new Error('No se pudo subir la imagen. Revisa tu conexión.');
        }
      } else {
        // En modo Demo, generamos una URL local persistente (simulada) 
        // y guardamos el Blob en IndexedDB.
        const demoUrl = `demo://${img.id}/${img.nombre}`;
        await saveImageToCache(demoUrl, img.blob);
        processed.push(demoUrl);
      }
    } else {
      // Caso de fallback para objetos de imagen antiguos
      const url = img.url || img;
      if (typeof url === 'string' && !url.startsWith('blob:')) {
        processed.push(url);
      }
    }
  }
  return processed;
}

function delay(ms = 100) {
  return new Promise(r => setTimeout(r, ms));
}

function mapDbNote(note) {
  if (!note) return null;
  let imagenes = note.imagenes;
  if (typeof imagenes === 'string') {
    try { imagenes = JSON.parse(imagenes); } catch { imagenes = []; }
  }
  if (!Array.isArray(imagenes)) imagenes = [];
  return {
    ...note,
    imagenes,
    unreadNew: note.unread_new,
    unreadModified: note.unread_modified,
    creadoPor: note.creado_por,
    modificadoPor: note.modificado_por,
    creadoEn: note.creado_en,
    modificadoEn: note.modificado_en,
  };
}

async function getLocalNotes() {
  await delay();
  try { return JSON.parse(localStorage.getItem(NOTES_KEY) || '[]'); } catch { return []; }
}

async function setLocalNotes(notes) {
  await delay();
  localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
}

let _counter = null;
async function getNextNumero() {
  const notes = await getLocalNotes();
  if (_counter === null) {
    const max = notes.reduce((m, n) => {
      const m2 = parseInt(n.numero.replace('#', ''));
      return isNaN(m2) ? m : Math.max(m, m2);
    }, 0);
    _counter = max;
  }
  _counter++;
  return '#' + String(_counter).padStart(4, '0');
}

export async function getNotes() {
  let notes;
  if (!isDemoMode()) {
    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .order('prioridad', { ascending: true });
    if (error) throw error;
    notes = (data || []).map(mapDbNote);
  } else {
    notes = await getLocalNotes();
  }

  // Iniciar el cacheo de imágenes en segundo plano para asegurar disponibilidad offline
  cacheImages(notes);
  return notes;
}

export async function getNote(id) {
  if (!isDemoMode()) {
    const { data, error } = await supabase.from('notes').select('*').eq('id', id).single();
    if (error) return null;
    return mapDbNote(data);
  }
  const notes = await getLocalNotes();
  return notes.find(n => n.id === id) || null;
}

export async function createNote(fields, session) {
  const numero = await getNextNumero();
  const now = new Date().toISOString();
  
  // Procesar imágenes antes de crear el objeto de la nota
  const imagenes = await processImages(fields.imagenes);

  const note = {
    id: Date.now(),
    numero,
    fecha: fields.fecha,
    destino: fields.destino,
    productos: fields.productos,
    observaciones: fields.observaciones || '',
    estatus: 'Nueva',
    imagenes: imagenes,
    tomada: false,
    tomadaPor: null,
    tomadaEn: null,
    unreadNew: true,
    unreadModified: false,
    prioridad: 0,
    creadoPor: session.username,
    creadoEn: now,
    modificadoPor: null,
    modificadoEn: null,
  };

  if (!isDemoMode()) {
    const { data, error } = await supabase
      .from('notes')
      .insert([{
        numero: note.numero,
        fecha: note.fecha,
        destino: note.destino,
        productos: note.productos,
        observaciones: note.observaciones,
        estatus: note.estatus,
        imagenes: note.imagenes,
        unread_new: note.unreadNew,
        unread_modified: note.unreadModified,
        prioridad: note.prioridad,
        creado_por: note.creadoPor,
      }])
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  const notes = await getLocalNotes();
  notes.unshift(note);
  await setLocalNotes(notes);
  return note;
}

export async function updateNote(id, fields, session) {
  const now = new Date().toISOString();
  const notes = await getLocalNotes();
  const idx = notes.findIndex(n => n.id === id);
  if (idx === -1 && isDemoMode()) return null;

  // Procesar imágenes si vienen en los campos
  if (fields.imagenes) {
    fields.imagenes = await processImages(fields.imagenes);
  }

  if (!isDemoMode()) {
    const dbFields = {};
    for (const [key, val] of Object.entries(fields)) {
      const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      dbFields[dbKey] = val;
    }
    dbFields.modificado_por = session.username;
    dbFields.modificado_en = now;
    if (fields.unreadNew !== undefined) dbFields.unread_new = fields.unreadNew;
    if (fields.unreadModified !== undefined) dbFields.unread_modified = fields.unreadModified;

    const { data, error } = await supabase
      .from('notes')
      .update(dbFields)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    
    // Si la actualización fue exitosa, cacheamos las nuevas imágenes localmente
    if (data.imagenes) cacheImages([data]);
    
    return { old: null, new: data };
  }

  const old = { ...notes[idx] };
  const updated = { ...old, ...fields, modificadoPor: session.username, modificadoEn: now };

  if (CONFIG.confirmEditStatuses.includes(old.estatus) && session.role === 'admin') {
    updated.unreadModified = true;
  }
  notes[idx] = updated;
  await setLocalNotes(notes);
  return { old, new: updated };
}

export async function deleteNote(id) {
  if (!isDemoMode()) {
    const { error } = await supabase.from('notes').delete().eq('id', id);
    if (error) throw error;
    return;
  }
  const notes = await getLocalNotes();
  await setLocalNotes(notes.filter(n => n.id !== id));
}

export async function moveNoteUp(id) {
  if (isDemoMode()) {
    const notes = await getLocalNotes();
    const idx = notes.findIndex(n => n.id === id);
    if (idx > 0) {
      [notes[idx - 1], notes[idx]] = [notes[idx], notes[idx - 1]];
      notes.forEach((n, i) => n.prioridad = i);
      await setLocalNotes(notes);
    }
  }
}

export async function moveNoteDown(id) {
  if (isDemoMode()) {
    const notes = await getLocalNotes();
    const idx = notes.findIndex(n => n.id === id);
    if (idx < notes.length - 1) {
      [notes[idx], notes[idx + 1]] = [notes[idx + 1], notes[idx]];
      notes.forEach((n, i) => n.prioridad = i);
      await setLocalNotes(notes);
    }
  }
}

export async function toggleTomada(id, session) {
  const note = await getNote(id);
  if (!note) return null;
  const tomada = !note.tomada;
  const updated = await updateNote(id, {
    tomada,
    tomadaPor: tomada ? session.username : null,
    tomadaEn: tomada ? new Date().toISOString() : null,
  }, session);
  return updated?.new;
}

export async function seedDemoNotes() {
  if (!isDemoMode()) return;
  const existing = await getLocalNotes();
  if (existing.length > 0) return;

  const now = new Date().toISOString();
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  const demos = [
    { numero: '#0001', fecha: today, destino: 'Sucursal 1', estatus: 'Nueva', observaciones: 'Pedido regular de la semana', productos: [{ nombre: 'Conchas', cantidad: 20, unidad: 'pzas' }, { nombre: 'Cuernos', cantidad: 15, unidad: 'pzas' }], prioridad: 0, unreadNew: true, unreadModified: false },
    { numero: '#0002', fecha: today, destino: 'Sucursal 2', estatus: 'En Proceso', observaciones: 'pedido urgente', productos: [{ nombre: 'Polvorones', cantidad: 50, unidad: 'pzas' }], prioridad: 1, unreadNew: false, unreadModified: false },
    { numero: '#0003', fecha: today, destino: 'Planta de Producción', estatus: 'Nueva', observaciones: '', productos: [{ nombre: 'Harina', cantidad: 100, unidad: 'kg' }], prioridad: 2, unreadNew: true, unreadModified: false },
    { numero: '#0004', fecha: yesterday, destino: 'Sucursal 3', estatus: 'Completada', observaciones: 'Entregado a tiempo', productos: [{ nombre: 'Donas', cantidad: 30, unidad: 'pzas' }], prioridad: 3, unreadNew: false, unreadModified: false },
    { numero: '#0005', fecha: yesterday, destino: 'Sucursal 1', estatus: 'Nueva', observaciones: '', productos: [{ nombre: 'Mantecadas', cantidad: 25, unidad: 'pzas' }], prioridad: 4, unreadNew: true, unreadModified: false },
  ];

  let id = 1;
  for (const d of demos) {
    const notes = await getLocalNotes();
    const note = { id: id++, ...d, creadoPor: 'admin', creadoEn: now, modificadoPor: null, modificadoEn: null, tomada: false, tomadaPor: null, tomadaEn: null, imagenes: [] };
    notes.push(note);
    await setLocalNotes(notes);
  }
}