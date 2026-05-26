/// <reference path="./types.js" />
import { CONFIG } from './config.js';
import { supabase, uploadImage } from './supabase.js';
import { cacheImages, saveImageToCache, isOnline, getOfflineNotes, getOfflineNote } from './offline.js';

async function processImages(imagenes) {
  if (!imagenes || !Array.isArray(imagenes)) return [];

  const processed = [];
  for (const img of imagenes) {
    if (typeof img === 'string') {
      processed.push(img);
      continue;
    }

    if (img.blob) {
      try {
        const publicUrl = await uploadImage(img.blob, img.nombre);
        await saveImageToCache(publicUrl, img.blob);
        processed.push(publicUrl);
      } catch (err) {
        console.error('Error al subir imagen a Supabase:', err);
        throw new Error('No se pudo subir la imagen. Revisa tu conexión.');
      }
    } else {
      const url = img.url || img;
      if (typeof url === 'string' && !url.startsWith('blob:')) {
        processed.push(url);
      }
    }
  }
  return processed;
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
    clienteNombre: note.cliente_nombre || '',
    clienteDireccion: note.cliente_direccion || '',
    clienteTelefono: note.cliente_telefono || '',
    pastelCantidad: note.pastel_cantidad ?? 1,
    pisos: note.pisos ?? null,
    sabor: note.sabor || '',
    kilos: note.kilos || '',
    modelo: note.modelo || '',
    texto: note.texto || '',
    colores: note.colores || '',
    horaEntrega: note.hora_entrega || '',
    horaPeriodo: note.hora_periodo || 'AM',
    direccionEntrega: note.direccion_entrega || '',
    costoPastel: note.costo_pastel ?? 0,
    depositoEquipo: note.deposito_equipo ?? 0,
    arreglosFigura: note.arreglos_figura ?? 0,
    servicioDomicilio: note.servicio_domicilio ?? 0,
    anticipo: note.anticipo ?? 0,
    metodoPago: note.metodo_pago || '',
  };
}

export async function getNotes() {
  if (!isOnline()) {
    return getOfflineNotes();
  }
  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .order('prioridad', { ascending: true })
    .order('id', { ascending: false });
  if (error) throw error;
  const notes = (data || []).map(mapDbNote);

  // Cache de imágenes en segundo plano (fire-and-forget)
  cacheImages(notes);
  return notes;
}

export async function getNote(id) {
  if (!isOnline()) {
    const cached = await getOfflineNote(id);
    return cached ? mapDbNote(cached) : null;
  }
  const { data, error } = await supabase.from('notes').select('*').eq('id', id).single();
  if (error) return null;
  return mapDbNote(data);
}

function validateNoteFields(fields) {
  const errors = [];
  if (!fields.fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fields.fecha)) {
    errors.push('Fecha inválida (YYYY-MM-DD)');
  }
  if (!fields.destino || !CONFIG.locations.includes(fields.destino)) {
    errors.push(`Destino inválido. Debe ser: ${CONFIG.locations.join(', ')}`);
  }
  const hasProductos = fields.productos && Array.isArray(fields.productos) && fields.productos.length > 0;
  const hasPastelData = (fields.clienteNombre || '').trim() || (fields.sabor || '').trim() || (fields.modelo || '').trim() || (fields.costoPastel > 0);
  if (!hasProductos && !hasPastelData) {
    errors.push('Debe haber al menos un producto o datos de cliente/pastel');
  }
  if (fields.observaciones && fields.observaciones.length > 2000) {
    errors.push('Observaciones demasiado largas (máx 2000 caracteres)');
  }
  return errors;
}

export async function createNote(fields, session) {
  const errors = validateNoteFields(fields);
  if (errors.length) throw new Error(errors.join('\n'));

  const { data: maxNote } = await supabase
    .from('notes')
    .select('numero')
    .order('numero', { ascending: false })
    .limit(1);
  const maxNum = maxNote?.[0]?.numero
    ? parseInt(String(maxNote[0].numero).replace('#', '')) || 0
    : 0;
  const numero = '#' + String(maxNum + 1).padStart(4, '0');

  const imagenes = await processImages(fields.imagenes);

  const { data, error } = await supabase
    .from('notes')
    .insert([{
      numero,
      fecha: fields.fecha,
      destino: fields.destino,
      productos: fields.productos,
      observaciones: fields.observaciones || '',
      estatus: 'Nueva',
      imagenes,
      unread_new: true,
      unread_modified: false,
      prioridad: 0,
      creado_por: session.username,
      cliente_nombre: fields.clienteNombre || '',
      cliente_direccion: fields.clienteDireccion || '',
      cliente_telefono: fields.clienteTelefono || '',
      pastel_cantidad: fields.pastelCantidad ?? 1,
      pisos: fields.pisos ?? null,
      sabor: fields.sabor || '',
      kilos: fields.kilos || '',
      modelo: fields.modelo || '',
      texto: fields.texto || '',
      colores: fields.colores || '',
      hora_entrega: fields.horaEntrega || '',
      hora_periodo: fields.horaPeriodo || 'AM',
      direccion_entrega: fields.direccionEntrega || '',
      costo_pastel: fields.costoPastel ?? 0,
      deposito_equipo: fields.depositoEquipo ?? 0,
      arreglos_figura: fields.arreglosFigura ?? 0,
      servicio_domicilio: fields.servicioDomicilio ?? 0,
      anticipo: fields.anticipo ?? 0,
      metodo_pago: fields.metodoPago || '',
    }])
    .select()
    .single();
  if (error) throw error;
  return mapDbNote(data);
}

// Campos cuyo cambio se considera "contenido" para marcar unread_modified.
const CONTENT_FIELDS = [
  'fecha', 'destino', 'productos', 'observaciones', 'imagenes',
  'clienteNombre', 'clienteDireccion', 'clienteTelefono',
  'pastelCantidad', 'pisos', 'sabor', 'kilos', 'modelo', 'texto', 'colores',
  'horaEntrega', 'horaPeriodo', 'direccionEntrega',
  'costoPastel', 'depositoEquipo', 'arreglosFigura', 'servicioDomicilio',
  'anticipo', 'metodoPago',
];

function fieldsTouchContent(fields) {
  return Object.keys(fields).some(k => CONTENT_FIELDS.includes(k));
}

export async function updateNote(id, fields, session) {
  const force = fields._force === true;
  const localModifiedEn = fields._localModifiedEn;
  // Limpiar metadatos internos antes de validar/guardar
  delete fields._force;
  delete fields._localModifiedEn;

  // Validación parcial: si vienen campos críticos, exigir que sean válidos.
  if (fields.fecha !== undefined || fields.destino !== undefined) {
    if (fields.fecha !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(fields.fecha)) {
      throw new Error('Fecha inválida (YYYY-MM-DD)');
    }
    if (fields.destino !== undefined && !CONFIG.locations.includes(fields.destino)) {
      throw new Error(`Destino inválido. Debe ser: ${CONFIG.locations.join(', ')}`);
    }
  }
  if (fields.observaciones && fields.observaciones.length > 2000) {
    throw new Error('Observaciones demasiado largas (máx 2000 caracteres)');
  }

  // Conflict detection: si el cliente declaró su versión local y otro escribió después, abortar.
  if (!force && localModifiedEn) {
    const { data: current } = await supabase
      .from('notes')
      .select('modificado_en')
      .eq('id', id)
      .single();
    if (current?.modificado_en) {
      const serverTime = new Date(current.modificado_en).getTime();
      const clientTime = new Date(localModifiedEn).getTime();
      if (serverTime > clientTime) {
        const { data: fullNote } = await supabase.from('notes').select('*').eq('id', id).single();
        return { conflict: true, serverNote: mapDbNote(fullNote) };
      }
    }
  }

  if (fields.imagenes) {
    fields.imagenes = await processImages(fields.imagenes);
  }

  // Si admin edita contenido de una nota ya en proceso/completada, marcar unread_modified.
  let unreadModifiedFlag;
  if (session?.role === 'admin' && fieldsTouchContent(fields)) {
    const existing = await getNote(id);
    if (existing && CONFIG.confirmEditStatuses.includes(existing.estatus)) {
      const onlyStatus = Object.keys(fields).every(k => k === 'estatus' || !CONTENT_FIELDS.includes(k));
      if (!onlyStatus) unreadModifiedFlag = true;
    }
  }

  const dbFields = {};
  for (const [key, val] of Object.entries(fields)) {
    const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
    dbFields[dbKey] = val;
  }
  dbFields.modificado_por = session.username;
  dbFields.modificado_en = new Date().toISOString();
  if (unreadModifiedFlag) dbFields.unread_modified = true;

  const { data, error } = await supabase
    .from('notes')
    .update(dbFields)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;

  if (data.imagenes) cacheImages([mapDbNote(data)]);

  return { old: null, new: mapDbNote(data) };
}

export async function deleteNote(id) {
  // .select() devuelve las filas afectadas; sin él Supabase responde data:[] aunque
  // RLS haya bloqueado la operación, sin marcar error. Verificamos para no mentirle al usuario.
  const { data, error } = await supabase.from('notes').delete().eq('id', id).select();
  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error('No se pudo eliminar la nota: permisos insuficientes o ya no existe.');
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
    _force: true,
  }, session);
  return updated?.new;
}
