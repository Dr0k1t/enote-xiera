// Endpoint de telemetría. Acepta POST con un objeto JSON pequeño.
// Hardening: limita tamaño de payload para evitar log-spam / DoS de coste.
// NOTA: sin auth ni rate-limit real (un público anónimo puede POST). Para
// rate-limiting robusto usar Vercel Firewall o un store (KV) — ver reporte.
const MAX_PAYLOAD_BYTES = 4096;

module.exports = (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  let payload;
  try {
    payload = JSON.stringify(req.body ?? {});
  } catch {
    return res.status(400).json({ error: 'Invalid body' });
  }
  if (payload.length > MAX_PAYLOAD_BYTES) {
    return res.status(413).json({ error: 'Payload too large' });
  }
  console.log('[enote-log]', payload);
  return res.status(200).json({ ok: true });
};
