function logError(err, req) {
  console.error('--- ERROR LOG ---');
  console.error('Time:', new Date().toISOString());
  if (req) {
    console.error('Route:', req.method, req.originalUrl);
    if (req.user) console.error('User:', req.user);
    if (Object.keys(req.body || {}).length) console.error('Body:', req.body);
    if (Object.keys(req.params || {}).length) console.error('Params:', req.params);
    if (Object.keys(req.query || {}).length) console.error('Query:', req.query);
  }
  console.error('Error:', err);
  console.error('--- END ERROR LOG ---');
}
module.exports = { logError };