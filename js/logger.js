const LOG_ENDPOINT = '/api/log';

async function post(data) {
  try {
    await fetch(LOG_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ts: new Date().toISOString(), ...data }),
    });
  } catch { /* silencioso */ }
}

// NOTA: no enviar PII (username, nombres de cliente, nombres de archivo) a logs.
// Solo metadatos no identificables: rol (categoría), ids numéricos, tamaños.
export const log = {
  sessionStart: (s) =>
    post({ type: 'session_start', role: s.role }),

  noteCreated: (n) =>
    post({ type: 'note_created', noteId: n.id,
           noteSizeBytes: JSON.stringify(n).length,
           imagenes: n.imagenes?.length ?? 0 }),

  noteUpdated: (n) =>
    post({ type: 'note_updated', noteId: n.id,
           noteSizeBytes: JSON.stringify(n).length,
           imagenes: n.imagenes?.length ?? 0 }),

  noteTomada: (n) =>
    post({ type: 'note_tomada', noteId: n.id, tomada: n.tomada }),

  imageCompressed: (file, result) =>
    post({ type: 'image_compressed',
           originalSizeKB:    (file.size / 1024).toFixed(1),
           compressedSizeKB:  ((result.url.length * 0.75) / 1024).toFixed(1),
           width:             result.width,
           height:            result.height }),

  error: (kind, payload) =>
    post({ type: 'error', kind, ...payload }),
};
