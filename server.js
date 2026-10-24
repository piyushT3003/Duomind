const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const ROOT = __dirname;
const PORT = Number(process.env.PORT || 5500);
const envPath = path.join(ROOT, '.env');

function loadDotEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    let value = m[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (!(m[1] in process.env)) process.env[m[1]] = value;
  }
}
loadDotEnv(envPath);

const KEY = process.env.GEMINI_API_KEY || '';
const MODELS = (process.env.GEMINI_MODELS || 'gemini-3.8-flash,gemini-3.5-flash-lite').split(',').map(s => s.trim()).filter(Boolean);

function send(res, status, body, type='application/json') {
  res.writeHead(status, {'Content-Type': type, 'Cache-Control':'no-store'});
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => {
      data += chunk;
      if (data.length > 70000) { req.destroy(); reject(new Error('Request too large')); }
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

async function gemini(req, res) {
  if (req.method !== 'POST') return send(res, 405, JSON.stringify({error:{message:'Use POST.'}}));
  if (!KEY) return send(res, 500, JSON.stringify({error:{message:'GEMINI_API_KEY is missing in .env'}}));
  let input;
  try { input = JSON.parse(await readBody(req)); } catch { return send(res, 400, JSON.stringify({error:{message:'Invalid JSON.'}})); }
  const { model, stream, body } = input || {};
  if (!MODELS.includes(model)) return send(res, 400, JSON.stringify({error:{message:`Model not allowed: ${model}`}}));
  if (!body || typeof body !== 'object') return send(res, 400, JSON.stringify({error:{message:'Missing request body.'}}));

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:${stream ? 'streamGenerateContent?alt=sse&' : 'generateContent?'}key=${encodeURIComponent(KEY)}`;
  let upstream;
  try {
    upstream = await fetch(endpoint, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)});
  } catch (e) {
    return send(res, 502, JSON.stringify({error:{message:'Could not reach Gemini.'}}));
  }

  res.statusCode = upstream.status;
  res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  if (stream && upstream.ok && upstream.body) {
    const reader = upstream.body.getReader();
    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      res.write(Buffer.from(value));
    }
    return res.end();
  }
  const text = await upstream.text();
  res.end(text.split(KEY).join('[hidden]'));
}

const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.ico':'image/x-icon'};

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (u.pathname === '/api/gemini') return gemini(req, res);
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method Not Allowed', 'text/plain');

  let pathname;
  try { pathname = decodeURIComponent(u.pathname); } catch { return send(res, 400, 'Bad Request', 'text/plain'); }
  if (pathname === '/') pathname = '/index.html';
  const file = path.resolve(ROOT, '.' + pathname);
  if (!file.startsWith(path.resolve(ROOT) + path.sep) && file !== path.resolve(ROOT)) return send(res, 403, 'Forbidden', 'text/plain');
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) return send(res, 404, 'Not Found', 'text/plain');
    res.writeHead(200, {'Content-Type': mime[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control':'no-cache'});
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(file).pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`DuoMind running at http://localhost:${PORT}`);
  console.log(KEY ? 'Gemini server key: loaded from .env' : 'WARNING: GEMINI_API_KEY is missing from .env');
});
