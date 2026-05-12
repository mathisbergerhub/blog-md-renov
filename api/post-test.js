module.exports = async function postTest(req, res) {
  try {
    let body = req.body || null;
    if (!body && typeof req.on === 'function') {
      body = await new Promise((resolve, reject) => {
        let raw = '';
        req.on('data', (chunk) => { raw += chunk; });
        req.on('end', () => resolve(raw));
        req.on('error', reject);
      });
    }
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ ok: true, method: req.method || null, bodyType: typeof body, body }));
  } catch (error) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ ok: false, error: error.message }));
  }
};
