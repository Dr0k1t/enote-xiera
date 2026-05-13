// Logging de sesión para desarrollo local.
// POST silencioso a /api/log — no afecta la UI si el servidor no está disponible.
async function post(data) {
  try {
    await fetch('/api/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ts: new Date().toISOString(), ...data }),
    });
  } catch { /* servidor estático o sin endpoint — falla silenciosa */ }
}

export const log = {
  sessionStart: (s) =>
    post({ type: 'session_start', user: s.username, role: s.role }),

  noteCreated: (n) =>
    post({ type: 'note_created', noteId: n.id,
           noteSizeBytes: JSON.stringify(n).length,
           imagenes: n.imagenes?.length ?? 0 }),

  noteUpdated: (n) =>
    post({ type: 'note_updated', noteId: n.id,
           noteSizeBytes: JSON.stringify(n).length,
           imagenes: n.imagenes?.length ?? 0 }),

  noteTomada: (n) =>
    post({ type: 'note_tomada', noteId: n.id,
           tomada: n.tomada, tomadaPor: n.tomadaPor }),

  imageCompressed: (file, result) =>
    post({ type: 'image_compressed',
           originalName:      file.name,
           originalSizeKB:    (file.size / 1024).toFixed(1),
           // base64: cada 4 chars = 3 bytes → length * 0.75
           compressedSizeKB:  ((result.url.length * 0.75) / 1024).toFixed(1),
           width:             result.width,
           height:            result.height }),
};
