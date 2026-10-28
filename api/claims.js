// Vercel Serverless Function: Liste aller Wintergeschenk-Codes (nur mit Schlüssel)
// Env: ADMIN_KEY (frei wählbar, lang), BLOB_READ_WRITE_TOKEN (vom Vercel-Blob-Store)
// Aufruf: /api/claims?key=...            → JSON
//         /api/claims?key=...&format=csv → CSV (Excel)
//         /api/claims?key=...&format=html → Tabelle für die Theke

const crypto = require('crypto');

const BLOB_API = 'https://blob.vercel-storage.com';
const PREFIX = 'wintergeschenk/claims/';

function send(res, status, type, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', type);
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.end(body);
}
const json = (res, status, obj) => send(res, status, 'application/json; charset=utf-8', JSON.stringify(obj));

function query(req) {
  if (req.query && typeof req.query === 'object') return req.query;
  try { return Object.fromEntries(new URL(req.url || '/', 'http://x').searchParams); } catch (e) { return {}; }
}

function safeEqual(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

async function listClaims(token) {
  const auth = { authorization: 'Bearer ' + token, 'x-api-version': '7' };
  const blobs = [];
  let cursor = '';
  for (let page = 0; page < 20; page++) {
    const url = BLOB_API + '?prefix=' + encodeURIComponent(PREFIX) + '&limit=1000' + (cursor ? '&cursor=' + encodeURIComponent(cursor) : '');
    const r = await fetch(url, { headers: auth });
    if (!r.ok) throw new Error('list ' + r.status);
    const data = await r.json();
    blobs.push(...(data.blobs || []));
    if (!data.hasMore || !data.cursor) break;
    cursor = data.cursor;
  }
  const claims = await Promise.all(blobs.map(async (b) => {
    try {
      const r = await fetch(b.downloadUrl || b.url, { headers: { authorization: 'Bearer ' + token } });
      if (!r.ok) return null;
      return await r.json();
    } catch (e) { return null; }
  }));
  return claims.filter(Boolean).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

const COLS = [
  ['name', 'Name'], ['tel', 'Telefon'], ['wunsch', 'Wunschtermin'], ['auto', 'Auto'],
  ['code', 'Code'], ['quelle', 'Quelle'], ['zeit', 'Zeit'],
];
function row(c) {
  return {
    name: c.name || '', tel: c.tel || '',
    wunsch: [c.tag, c.zeit].filter(Boolean).join(', '),
    auto: c.auto || '', code: c.code || '',
    quelle: [c.source, c.campaign].filter(Boolean).join(' / '),
    zeit: c.createdAtVienna || c.createdAt || '',
  };
}

function toCsv(claims) {
  const esc = (v) => {
    let s = String(v == null ? '' : v);
    if (/^[=+\-@]/.test(s)) s = "'" + s; // Formel-Injection in Excel verhindern
    return '"' + s.replace(/"/g, '""') + '"';
  };
  const lines = [COLS.map((c) => esc(c[1])).join(';')];
  for (const c of claims) { const r = row(c); lines.push(COLS.map((k) => esc(r[k[0]])).join(';')); }
  return '﻿' + lines.join('\r\n') + '\r\n';
}

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

function toHtml(claims) {
  const rows = claims.map((c) => {
    const r = row(c);
    return '<tr>' + COLS.map((k) => '<td' + (k[0] === 'code' ? ' class="code"' : '') + ' data-l="' + esc(k[1]) + '">' +
      (k[0] === 'tel' && r.tel ? '<a href="tel:' + esc(r.tel.replace(/[^\d+]/g, '')) + '">' + esc(r.tel) + '</a>' : esc(r[k[0]])) + '</td>').join('') + '</tr>';
  }).join('');
  return '<!DOCTYPE html><html lang="de-AT"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<meta name="robots" content="noindex, nofollow"><title>Wintergeschenk · Codes</title><style>' +
    ':root{--ink:#1d1d1f;--ink2:#6e6e73;--line:#e5e5ea;--red:#d7263d}*{box-sizing:border-box}' +
    'body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text",Inter,sans-serif;color:var(--ink);background:#f5f5f7;-webkit-font-smoothing:antialiased}' +
    '.w{max-width:1100px;margin:0 auto;padding:28px 16px}h1{font-size:28px;letter-spacing:-.02em;margin:0 0 4px}p{color:var(--ink2);margin:0 0 18px}' +
    'input{font:inherit;font-size:17px;width:100%;padding:13px 15px;border-radius:12px;border:1.5px solid #d2d2d7;margin-bottom:16px}' +
    'table{width:100%;border-collapse:collapse;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.06)}' +
    'th,td{text-align:left;padding:12px 14px;border-bottom:1px solid var(--line);font-size:15px;vertical-align:top}th{font-size:13px;color:var(--ink2);font-weight:600;background:#fafafa}' +
    'td.code{font-family:ui-monospace,Menlo,monospace;font-weight:700;letter-spacing:.12em;color:var(--red);white-space:nowrap}a{color:inherit}' +
    '@media(max-width:700px){thead{display:none}table,tbody,tr,td{display:block;width:100%}tr{border-bottom:8px solid #f5f5f7}td{border:0;padding:6px 14px}td::before{content:attr(data-l);display:block;font-size:12px;color:var(--ink2)}}' +
    '</style></head><body><div class="w"><h1>Wintergeschenk · Codes</h1><p>' + claims.length + ' Anfragen · neueste zuerst</p>' +
    '<input id="q" type="search" placeholder="Code, Name oder Telefon suchen" autocomplete="off" autofocus>' +
    '<table><thead><tr>' + COLS.map((c) => '<th>' + esc(c[1]) + '</th>').join('') + '</tr></thead><tbody id="b">' + rows + '</tbody></table></div>' +
    '<script>document.getElementById("q").addEventListener("input",function(e){var q=e.target.value.toLowerCase().replace(/\\s/g,"");' +
    'document.querySelectorAll("#b tr").forEach(function(t){t.style.display=t.textContent.toLowerCase().replace(/\\s/g,"").indexOf(q)>-1?"":"none"})})</script></body></html>';
}

async function handler(req, res) {
  if (req.method && req.method !== 'GET') { res.setHeader('Allow', 'GET'); return json(res, 405, { ok: false, error: 'method_not_allowed' }); }
  const adminKey = process.env.ADMIN_KEY;
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!adminKey || !token) return json(res, 503, { ok: false, error: 'not_configured' });

  const q = query(req);
  const given = (req.headers && req.headers['x-admin-key']) || q.key || '';
  if (!given || !safeEqual(given, adminKey)) return json(res, 401, { ok: false, error: 'unauthorized' });

  let claims;
  try { claims = await listClaims(token); } catch (e) {
    console.error('CLAIMS_LIST_FAILED ' + (e && e.message));
    return json(res, 502, { ok: false, error: 'storage_unavailable' });
  }

  const format = String(q.format || 'json').toLowerCase();
  if (format === 'csv') {
    res.setHeader('Content-Disposition', 'attachment; filename="wintergeschenk-claims.csv"');
    return send(res, 200, 'text/csv; charset=utf-8', toCsv(claims));
  }
  if (format === 'html') return send(res, 200, 'text/html; charset=utf-8', toHtml(claims));
  return json(res, 200, { ok: true, count: claims.length, claims });
}

module.exports = handler;
module.exports.toCsv = toCsv;
module.exports.toHtml = toHtml;
