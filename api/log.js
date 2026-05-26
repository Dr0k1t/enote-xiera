module.exports = (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  console.log('[enote-log]', JSON.stringify(req.body));
  return res.status(200).json({ ok: true });
};
