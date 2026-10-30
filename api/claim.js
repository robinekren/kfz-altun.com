// Vercel Serverless Function: Wintergeschenk-Anspruch speichern und persönlichen Code vergeben
// Env: BLOB_READ_WRITE_TOKEN (optional, entsteht beim Verbinden eines Vercel-Blob-Stores)
//      NOTIFY_EMAIL (Empfänger der Benachrichtigung, Standard robinekrenn@gmail.com)
//      RESEND_API_KEY + NOTIFY_FROM (optional; sonst Versand über FormSubmit, einmalige Aktivierung nötig)
// Ohne Token wird nur geloggt (Zeile "CLAIM {...}" in den Vercel-Logs). Der Kunde bekommt immer seinen Code.

const crypto = require('crypto');

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // ohne 0/O/1/I
const BLOB_API = 'https://blob.vercel-storage.com';
const CONSENT_TEXT = 'Ja, KFZ Altun Neunkirchen darf mir gelegentlich Angebote und Tipps rund ums Auto per E-Mail schicken. Abbestellen jederzeit mit einem Klick.';
const LIMITS = { name: 80, tel: 30, email: 120, tag: 60, zeit: 60, auto: 80, source: 60, campaign: 80, date: 10, start: 5, end: 5 };

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

function makeCode() {
  const bytes = crypto.randomBytes(5);
  let s = '';
  for (let i = 0; i < 5; i++) s += ALPHABET[bytes[i] % ALPHABET.length]; // 32 Zeichen → gleichverteilt
  return 'WG-' + s;
}

function clean(v, max) {
  return String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

function validate(input) {
  const b = input && typeof input === 'object' ? input : {};
  const out = {};
  for (const k of Object.keys(LIMITS)) out[k] = clean(b[k], LIMITS[k]);
  const errors = [];
  if (out.name.length < 2) errors.push('name');
  if (out.tel.replace(/\D/g, '').length < 6) errors.push('tel');
  if (out.date && !/^\d{4}-\d{2}-\d{2}$/.test(out.date)) out.date = '';
  if (out.start && !/^\d{2}:\d{2}$/.test(out.start)) out.start = '';
  if (out.end && !/^\d{2}:\d{2}$/.test(out.end)) out.end = '';
  return { data: out, errors };
}

function viennaTime(d) {
  return new Intl.DateTimeFormat('de-AT', {
    timeZone: 'Europe/Vienna', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).format(d);
}

async function readBody(req) {
  if (req.body !== undefined && req.body !== null && req.body !== '') {
    if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch (e) { return null; } }
    if (Buffer.isBuffer(req.body)) { try { return JSON.parse(req.body.toString('utf8')); } catch (e) { return null; } }
    return req.body;
  }
  if (typeof req.on !== 'function') return null;
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (c) => { raw += c; if (raw.length > 20000) raw = raw.slice(0, 20000); });
    req.on('end', () => { try { resolve(JSON.parse(raw || '{}')); } catch (e) { resolve(null); } });
    req.on('error', () => resolve(null));
  });
}

async function storeBlob(token, pathname, json) {
  const { put } = require('@vercel/blob');
  // Privater Store (Frankfurt): Inhalte nur mit Token lesbar
  return put(pathname, json, { access: 'private', contentType: 'application/json', addRandomSuffix: false, token: token || undefined });
}

function withTimeout(ms) {
  if (typeof AbortController !== 'function') return { signal: undefined, done() {} };
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  return { signal: c.signal, done() { clearTimeout(t); } };
}

function mailFields(c) {
  return {
    Name: c.name,
    Telefon: c.tel,
    Wunschtermin: [c.tag, c.zeit].filter(Boolean).join(', ') || '–',
    'E-Mail': c.email || '–',
    Werbung: c.marketingConsent ? 'Ja, eingewilligt' : 'Nein',
    Auto: c.auto || '–',
    Code: c.code,
    Quelle: [c.source, c.campaign].filter(Boolean).join(' / '),
    Zeit: c.createdAtVienna,
  };
}

function htmlEsc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

// Benachrichtigung an Robin (nie an den Kunden). Gibt true/false zurück, wirft nie.
async function notify(claim) {
  const to = process.env.NOTIFY_EMAIL || 'robinekrenn@gmail.com';
  const subject = '🎉 Neuer Kunde! ' + claim.name + ' will den Gratis-Wintercheck · ' + [claim.tag, (claim.zeit || '').split(' (')[0]].filter(Boolean).join(', ') + ' · ' + claim.code;
  const fields = mailFields(claim);
  const t = withTimeout(45000);
  try {
    let r;
    if (process.env.RESEND_API_KEY) {
      const rows = Object.keys(fields).map((k) => '<tr><td style="padding:4px 12px 4px 0;color:#6e6e73">' + k + '</td><td style="padding:4px 0"><b>' + htmlEsc(fields[k]) + '</b></td></tr>').join('');
      r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { authorization: 'Bearer ' + process.env.RESEND_API_KEY, 'content-type': 'application/json' },
        body: JSON.stringify({
          from: process.env.NOTIFY_FROM || 'Wintergeschenk <onboarding@resend.dev>',
          to: [to],
          subject,
          text: Object.keys(fields).map((k) => k + ': ' + fields[k]).join('\n'),
          html: '<table style="font-family:-apple-system,Arial,sans-serif;font-size:15px">' + rows + '</table>',
        }),
        signal: t.signal,
      });
    } else {
      r = await fetch('https://formsubmit.co/ajax/' + encodeURIComponent(to), {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json', origin: 'https://www.kfz-altun.com', referer: 'https://www.kfz-altun.com/wintergeschenk/' },
        body: JSON.stringify(Object.assign({ _subject: subject, _template: 'table', _captcha: 'false' }, fields)),
        signal: t.signal,
      });
    }
    if (!r.ok) throw new Error('status ' + r.status);
    if (!process.env.RESEND_API_KEY) {
      const j = await r.json().catch(() => null);
      if (j && (j.success === false || j.success === 'false')) throw new Error('formsubmit ' + (j.message || 'failed'));
    }
    return true;
  } catch (e) {
    console.error('CLAIM_NOTIFY_FAILED ' + claim.code + ' ' + (e && e.message));
    return false;
  } finally {
    t.done();
  }
}

async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return send(res, 405, { ok: false, error: 'method_not_allowed' });
  }

  const body = await readBody(req);
  if (!body) return send(res, 400, { ok: false, error: 'invalid_json' });
  const { data, errors } = validate(body);
  if (errors.length) return send(res, 400, { ok: false, error: 'validation', fields: errors });

  const now = new Date();
  const code = makeCode();
  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(data.email)) data.email = '';
  // Werbe-Einwilligung nur, wenn das Kästchen aktiv angehakt wurde (DSGVO Art. 7, § 174 TKG)
  const consent = body.marketing === true && !!data.email;
  data.marketingConsent = consent;
  data.consentText = consent ? CONSENT_TEXT : '';
  const claim = Object.assign({ code }, data, {
    source: data.source || 'direkt',
    createdAt: now.toISOString(),
    createdAtVienna: viennaTime(now),
    userAgent: clean(req.headers && req.headers['user-agent'], 200),
  });

  console.log('CLAIM ' + JSON.stringify(claim));

  const token = process.env.BLOB_READ_WRITE_TOKEN;
  const store = async () => {
    if (!token && !process.env.BLOB_STORE_ID) return false;
    const stamp = claim.createdAt.replace(/[:.]/g, '-');
    const pathname = 'wintergeschenk/claims/' + stamp + '-' + code + '-' + crypto.randomBytes(8).toString('hex') + '.json';
    try {
      await storeBlob(token, pathname, JSON.stringify(claim));
      return true;
    } catch (e) {
      console.error('CLAIM_STORE_FAILED ' + code + ' ' + (e && e.message));
      return false;
    }
  };
  // Mail läuft nach der Antwort weiter (FormSubmit braucht teils 30 s), Speichern wird abgewartet
  const mail = notify(claim);
  try { require('@vercel/functions').waitUntil(mail); } catch (e) { /* lokal ohne Paket */ }
  const stored = await store();
  const notified = 'queued';

  return send(res, 200, { ok: true, code, stored, notified, createdAt: claim.createdAt });
}

module.exports = handler;
module.exports.makeCode = makeCode;
module.exports.notify = notify;
module.exports.validate = validate;
module.exports.ALPHABET = ALPHABET;
