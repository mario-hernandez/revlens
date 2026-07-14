'use strict';
// revlens · engine/server.js — MOTOR de la capa de revisión asistida. Genérico y configurable:
// sirve CUALQUIER producto (web/informe/texto renderizado en HTML) con una capa encima de revisión
// «francotirador» + asesor IA + cola de comentarios anclados. No contiene nada específico de un
// producto: todo lo particular vive en `revlens.config.json` y en `contexto.md`. Cero dependencias.
//
// Un agente IA lo acopla así (ver AGENTE.md): apunta la config al producto, rellena el contexto,
// arranca. Backend IA conmutable: claude -p (gratis, comparte cuota de Claude Code) con fallback a
// Gemini (API propia), o el que se configure.
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFile } = require('child_process');

// ── config ──────────────────────────────────────────────────────────────────
const CFG_PATH = process.env.REVLENS_CONFIG || path.join(process.cwd(), 'revlens.config.json');
let CFG = {};
try { CFG = JSON.parse(fs.readFileSync(CFG_PATH, 'utf8')); }
catch (e) { console.error('No pude leer', CFG_PATH, '—', e.message, '\nCrea un revlens.config.json (ver AGENTE.md).'); process.exit(1); }
const BASE = path.dirname(path.resolve(CFG_PATH)); // todas las rutas de la config son relativas a ella
const abs = (p, d) => path.resolve(BASE, p || d);

const ENGINE = __dirname;
// Dos modos de producto: (a) carpeta local (dir) · (b) web pública en vivo (url → proxy con inyección).
const PROD = CFG.producto || {};
const MODO = PROD.url ? 'proxy' : 'dir';
const ORIGIN = MODO === 'proxy' ? new URL(PROD.url) : null; // host permitido del proxy (no es open-proxy)
const ENTRADA = ORIGIN ? ((ORIGIN.pathname || '/') + ORIGIN.search) : null; // ruta EXACTA configurada (con su path)
const PRODUCTO = abs(PROD.dir || './producto');
const RAIZ = PROD.raiz || 'index.html';
const CONTEXTO_FILE = abs(CFG.contexto || './contexto.md');
const COLA = abs(CFG.cola || './comentarios-pendientes.jsonl');
const BAK = COLA + '.bak';
const PORT = Number(process.env.PORT || CFG.puerto || 8130);
const TITULO = CFG.titulo || 'REVISIÓN';
const PUNTOS = CFG.puntos || 'p, li, h1, h2, h3, h4, figcaption, td, blockquote';
const IA = Object.assign({ backend: 'auto', claudeModel: 'claude-sonnet-5', geminiModel: 'gemini-2.5-flash' }, CFG.ia || {});
const EXTRA_DIRS = (CFG.servirTambien || []).map(d => ({ prefijo: d.prefijo, dir: abs(d.dir) })); // p.ej. visores, assets externos

let GEMINI_KEY = process.env.GOOGLE_GENAI_API_KEY || (IA.geminiKeyEnv && process.env[IA.geminiKeyEnv]) || '';
try { if (!GEMINI_KEY && IA.geminiKeychain) GEMINI_KEY = require('child_process').execFileSync('security', ['find-generic-password', '-s', IA.geminiKeychain, '-w'], { encoding: 'utf8' }).trim(); } catch {}

// ── util ──────────────────────────────────────────────────────────────────────
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json', '.pdf': 'application/pdf', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.gif': 'image/gif', '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2', '.mp4': 'video/mp4', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml', '.md': 'text/markdown; charset=utf-8' };
const readBody = (req) => new Promise((res) => { let b = '', d = false; const f = () => { if (!d) { d = true; res(b); } }; req.on('data', c => { b += c; if (b.length > 2e6) req.destroy(); }); req.on('end', f); req.on('close', f); req.on('error', f); });
const CTX = () => { try { return fs.readFileSync(CONTEXTO_FILE, 'utf8'); } catch { return ''; } };

function serveFrom(res, base, rel, inject) {
  const clean = path.normalize(rel).replace(/^(\.\.[/\\])+/, '').replace(/\0/g, '');
  let fp = path.join(base, clean);
  if (!fp.startsWith(base)) { res.writeHead(403); return res.end(); }
  try {
    if (fs.statSync(fp).isDirectory()) fp = path.join(fp, RAIZ);
    const ext = path.extname(fp).toLowerCase();
    if (inject && ext === '.html') {
      const html = fs.readFileSync(fp, 'utf8').replace(/<\/body>/i, '<script src="/_rev/overlay.js"></script>\n</body>');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); return res.end(html);
    }
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    fs.createReadStream(fp).pipe(res);
  } catch { res.writeHead(404); res.end('No encontrado'); }
}

// ── cola de comentarios (jsonl atómica + backup + auto-recuperación) ───────────
function leerCola() { try { return fs.readFileSync(COLA, 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l)); } catch { return []; } }
function escribirCola(arr) { const tmp = COLA + '.tmp'; fs.writeFileSync(tmp, arr.map(c => JSON.stringify(c)).join('\n') + (arr.length ? '\n' : '')); fs.renameSync(tmp, COLA); try { if (arr.length) fs.copyFileSync(COLA, BAK); } catch {} }
try { if (!fs.existsSync(COLA) && fs.existsSync(BAK)) { fs.copyFileSync(BAK, COLA); console.log('cola restaurada desde .bak'); } } catch {}

// ── asesor IA (claude -p con fallback a Gemini) ────────────────────────────────
const CONV = new Map();
const esLimite = (t) => /session limit|hit your (usage|session)|rate limit|quota|resets \d/i.test(String(t || ''));
function viaClaude(mensaje, sid) {
  return new Promise((resolve) => {
    const args = ['-p', String(mensaje), '--output-format', 'json', '--model', IA.claudeModel];
    const nuevo = !(sid && /^[a-f0-9-]{36}$/.test(sid));
    if (nuevo) { sid = crypto.randomUUID(); args.push('--session-id', sid, '--append-system-prompt', CTX()); } else args.push('--resume', sid);
    execFile('claude', args, { cwd: BASE, timeout: 120000, maxBuffer: 8 * 1024 * 1024 }, (err, stdout) => {
      if (err && !stdout) return resolve({ ok: false, limite: false, error: err.message || 'claude no disponible' });
      try { const j = JSON.parse(stdout); const t = j.result || '';
        // Solo es 'límite' si claude marcó error (is_error). NO mirar esLimite sobre una respuesta OK:
        // un asesoramiento válido puede mencionar "rate limit"/"quota" y NO es un fallo de cuota.
        if (j.is_error) return resolve({ ok: false, limite: esLimite(t), error: t || 'error de claude' });
        resolve({ ok: true, texto: t, sid: j.session_id || sid, motor: 'claude' });
      } catch { resolve({ ok: false, limite: false, error: 'respuesta ilegible de claude' }); }
    });
  });
}
function viaGemini(mensaje, sid) {
  return new Promise((resolve) => {
    if (!GEMINI_KEY) return resolve({ ok: false, error: 'sin key de Gemini' });
    if (!sid || !CONV.has(sid)) { sid = 'g_' + crypto.randomBytes(8).toString('hex'); CONV.set(sid, []); }
    const hist = CONV.get(sid); hist.push({ role: 'user', parts: [{ text: String(mensaje) }] });
    const payload = JSON.stringify({ systemInstruction: { parts: [{ text: CTX() }] }, contents: hist, generationConfig: { temperature: 0.4 } });
    const req = https.request(`https://generativelanguage.googleapis.com/v1beta/models/${IA.geminiModel}:generateContent?key=${GEMINI_KEY}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, timeout: 120000 }, (r) => {
        let b = ''; r.on('data', c => b += c); r.on('end', () => {
          try { const j = JSON.parse(b); const t = (((j.candidates || [])[0] || {}).content || {}).parts?.[0]?.text || '';
            if (!t) { hist.pop(); return resolve({ ok: false, error: 'gemini sin respuesta: ' + (j.error?.message || '').slice(0, 80) }); }
            hist.push({ role: 'model', parts: [{ text: t }] }); resolve({ ok: true, texto: t, sid, motor: 'gemini' });
          } catch { hist.pop(); resolve({ ok: false, error: 'respuesta ilegible de gemini' }); }
        });
      });
    req.on('error', () => { hist.pop(); resolve({ ok: false, error: 'error de red con gemini' }); });
    req.on('timeout', () => { req.destroy(); hist.pop(); resolve({ ok: false, error: 'timeout de gemini' }); });
    req.end(payload);
  });
}
async function asesor(mensaje, sid) {
  if (IA.backend === 'gemini') return viaGemini(mensaje, sid);
  const cSid = (sid && /^[a-f0-9-]{36}$/.test(sid)) ? sid : null;
  if (IA.backend === 'claude') return viaClaude(mensaje, cSid);
  if (sid && sid.startsWith('g_')) return viaGemini(mensaje, sid);
  const c = await viaClaude(mensaje, cSid);
  if (c.ok || !c.limite) return c;
  const g = await viaGemini(mensaje, null);
  if (g.ok) g.texto = '· (asesor: Claude sin cuota, sigo con Gemini) ·\n\n' + g.texto;
  return g;
}

// ── modo proxy: sirve una web pública en vivo con la capa inyectada ────────────
// Proxy transparente al MISMO host de ORIGIN (no open-proxy): los recursos con ruta relativa del
// sitio pasan por aquí y se reenvían; en el HTML se inyecta el overlay y se quitan CSP/base/X-Frame.
async function proxy(req, res, url) {
  let target; try { target = new URL(url.pathname + url.search, ORIGIN.origin); } catch { res.writeHead(400); return res.end(); }
  if (target.host !== ORIGIN.host) { res.writeHead(404); return res.end('fuera del sitio'); }
  try {
    // redirect MANUAL (anti-SSRF): no seguimos a ciegas a otro host. Un 3xx same-host se refleja al
    // navegador como path local (sigue por el proxy); a otro host o protocolo no-http → BLOQUEADO. + timeout.
    const r = await fetch(target, { redirect: 'manual', signal: AbortSignal.timeout(20000), headers: { 'user-agent': req.headers['user-agent'] || 'revlens', accept: req.headers.accept || '*/*', 'accept-encoding': 'identity' } });
    if (r.status >= 300 && r.status < 400 && r.headers.get('location')) {
      let dest; try { dest = new URL(r.headers.get('location'), target); } catch { res.writeHead(502); return res.end('redirect inválido'); }
      if (dest.host !== ORIGIN.host || !/^https?:$/.test(dest.protocol)) { res.writeHead(502); return res.end('redirect fuera del sitio bloqueado'); }
      res.writeHead(302, { Location: dest.pathname + dest.search }); return res.end();
    }
    const ct = r.headers.get('content-type') || 'application/octet-stream';
    if (/text\/html/i.test(ct)) {
      let html = await r.text();
      html = html.replace(/<base\b[^>]*>/ig, '');                                   // sin <base>: todo queda same-origin por el proxy
      const tag = '<script src="/_rev/overlay.js"></script>';
      html = /<\/body>/i.test(html) ? html.replace(/<\/body>/i, tag + '\n</body>') : html + tag;
      res.writeHead(r.status, { 'Content-Type': 'text/html; charset=utf-8' }); return res.end(html); // sin CSP/X-Frame: los omitimos
    }
    const buf = Buffer.from(await r.arrayBuffer());
    res.writeHead(r.status, { 'Content-Type': ct }); return res.end(buf);
  } catch (e) { res.writeHead(502); res.end('proxy: ' + (e && e.message || 'error')); }
}

// ── server ──────────────────────────────────────────────────────────────────
http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x'); const p = url.pathname;
    if (p === '/_rev/overlay.js') return serveFrom(res, ENGINE, 'overlay.js');
    if (p === '/_rev/config') { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ titulo: TITULO, puntos: PUNTOS })); }

    // ── plano de control bajo /_rev/api/ (NO colisiona con el /api/* del sitio proxeado, B4) ──
    if (p.startsWith('/_rev/api/')) {
      // Guardia anti-CSRF/abuso: header custom (fuerza preflight que no respondemos) + Origin propio.
      if ((req.headers['x-revlens'] || '') !== '1') { res.writeHead(403, { 'Content-Type': 'application/json' }); return res.end('{"error":"control"}'); }
      const o = req.headers.origin; if (o) { try { if (new URL(o).host !== req.headers.host) { res.writeHead(403); return res.end(); } } catch { res.writeHead(403); return res.end(); } }
      const J = { 'Content-Type': 'application/json' };
      const sub = p.slice('/_rev/api/'.length);
      if (req.method === 'POST' && sub === 'asesor') {
        const body = JSON.parse(await readBody(req) || '{}');
        const msg = String(body.mensaje || '').slice(0, 8000);
        if (!msg.trim()) { res.writeHead(400, J); return res.end('{"error":"vacío"}'); }
        const r = await asesor(msg, body.sid);
        res.writeHead(r.ok ? 200 : 502, J); return res.end(JSON.stringify(r));
      }
      if (req.method === 'POST' && sub === 'comentario') {
        const b = JSON.parse(await readBody(req) || '{}');
        const c = { ts: new Date().toISOString(), id: crypto.randomBytes(4).toString('hex'), estado: 'pendiente',
          seccion: String(b.seccion || '').slice(0, 120), ancla: String(b.ancla || '').slice(0, 800),
          selector: String(b.selector || '').slice(0, 400), indice: Number.isInteger(b.indice) ? b.indice : 0, hash: String(b.hash || '').slice(0, 40),
          inquietud: String(b.inquietud || '').slice(0, 2000), texto: String(b.texto || '').slice(0, 4000), sid: String(b.sid || '').slice(0, 40) };
        const all = leerCola(); all.push(c); escribirCola(all);
        res.writeHead(200, J); return res.end(JSON.stringify(c));
      }
      const mc = sub.match(/^comentario\/([a-f0-9]{8})$/);
      if (mc && (req.method === 'PUT' || req.method === 'DELETE')) {
        let b = {}; if (req.method === 'PUT') b = JSON.parse(await readBody(req) || '{}'); // readBody ANTES de leerCola (anti lost-update)
        const all = leerCola(); const i = all.findIndex(c => c.id === mc[1]);
        if (i < 0) { res.writeHead(404, J); return res.end('{"error":"no existe"}'); }
        if (req.method === 'DELETE') all.splice(i, 1);
        else { if (typeof b.texto === 'string') all[i].texto = b.texto.slice(0, 4000); if (typeof b.estado === 'string') all[i].estado = b.estado.slice(0, 20); all[i].editado = new Date().toISOString(); }
        escribirCola(all);
        res.writeHead(200, J); return res.end(JSON.stringify(req.method === 'DELETE' ? { ok: true } : all[i]));
      }
      if (sub === 'comentarios') { res.writeHead(200, J); return res.end(JSON.stringify(leerCola())); }
      res.writeHead(404, J); return res.end('{"error":"ruta"}');
    }

    for (const e of EXTRA_DIRS) if (e.prefijo && p.startsWith(e.prefijo)) return serveFrom(res, e.dir, p.slice(e.prefijo.length));
    if (MODO === 'proxy') {
      // la raíz local sirve la URL EXACTA configurada (con su path), no la home del dominio → así los
      // recursos relativos de esa página resuelven bien y la navegación sigue siendo same-host.
      if ((p === '/' || p === '') && ENTRADA && ENTRADA !== '/') { res.writeHead(302, { Location: ENTRADA }); return res.end(); }
      return proxy(req, res, url);
    }
    return serveFrom(res, PRODUCTO, p === '/' ? RAIZ : p, true);
  } catch (e) { try { res.writeHead(500); res.end(); } catch {} }
}).listen(PORT, '127.0.0.1', () => console.log(`revlens · «${TITULO}» en http://localhost:${PORT} · producto=${MODO === 'proxy' ? 'proxy → ' + ORIGIN.origin : path.relative(BASE, PRODUCTO)} · IA=${IA.backend} (claude=${IA.claudeModel}, gemini=${GEMINI_KEY ? 'key✓' : 'sin key'})`));
