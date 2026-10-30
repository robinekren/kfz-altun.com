// Kalender-Helfer für den Wintergeschenk-Termin (Browser + Node-Test, ohne Bibliotheken)
(function (root) {
  var TZ = 'Europe/Vienna';
  var TITLE = 'Gratis Wintercheck · KFZ Altun Neunkirchen';
  var LOCATION = 'KFZ Altun Neunkirchen, Sandgasse 12, 2620 Neunkirchen';
  var PHONE = '+43 660 7036723';

  // Offset (ms) von Europe/Vienna zu UTC zum Zeitpunkt t
  function tzOffset(t) {
    var p = {};
    new Intl.DateTimeFormat('en-US', { timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
      .formatToParts(new Date(t)).forEach(function (x) { p[x.type] = x.value; });
    return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second) - t;
  }
  // "2026-11-02", "08:00" (Wiener Ortszeit) → Date (UTC-korrekt, auch bei Sommer-/Winterzeit)
  function viennaToDate(date, time) {
    var d = date.split('-').map(Number), h = time.split(':').map(Number);
    var guess = Date.UTC(d[0], d[1] - 1, d[2], h[0], h[1] || 0);
    var t = guess - tzOffset(guess);
    return new Date(guess - tzOffset(t));
  }
  function utcStamp(dt) { return dt.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''); } // 20261102T070000Z
  function isoZ(dt) { return dt.toISOString().replace(/\.\d{3}/, ''); }                            // 2026-11-02T07:00:00Z

  function event(claim) {
    if (!claim || !/^\d{4}-\d{2}-\d{2}$/.test(claim.date || '')) return null;
    var start = /^\d{2}:\d{2}$/.test(claim.start || '') ? claim.start : '08:00';
    var end = /^\d{2}:\d{2}$/.test(claim.end || '') ? claim.end : '18:00';
    var lines = [
      'Dein Code: ' + claim.code,
      'Code in der Werkstatt zeigen.',
      'Gratis Batterietest + Kontrolle der Flüssigkeitsstände (ca. 15 Minuten).',
      'Wunschzeitfenster: ' + start + '–' + end + ' Uhr. Komm einfach in diesem Zeitraum vorbei.',
      'Fragen oder verschieben: ' + PHONE,
    ];
    return {
      title: TITLE, location: LOCATION, description: lines.join('\n'),
      start: viennaToDate(claim.date, start), end: viennaToDate(claim.date, end),
      morning: viennaToDate(claim.date, '07:30'), uid: claim.code + '-' + claim.date + '@kfz-altun.com',
    };
  }

  function icsEscape(s) { return String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n'); }
  // Zeilen auf 75 Oktette falten (RFC 5545 3.1), UTF-8-sicher
  function fold(line) {
    var out = [], cur = '', bytes = 0, limit = 75;
    for (var i = 0; i < line.length; i++) {
      var ch = line[i], code = line.charCodeAt(i);
      if (code >= 0xd800 && code <= 0xdbff && i + 1 < line.length) { ch += line[++i]; }
      var b = unescape(encodeURIComponent(ch)).length;
      if (bytes + b > limit) { out.push(cur); cur = ' '; bytes = 1; limit = 75; }
      cur += ch; bytes += b;
    }
    out.push(cur);
    return out.join('\r\n');
  }

  function ics(claim, now) {
    var ev = event(claim);
    if (!ev) return null;
    var alarms = [
      ['BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:Morgen: Gratis Wintercheck · Code ' + claim.code, 'TRIGGER:-P1D', 'END:VALARM'],
    ];
    // Am Termintag 07:30 Wiener Zeit (nur sinnvoll, wenn vor dem Start)
    var morning = ev.morning < ev.start
      ? 'TRIGGER;VALUE=DATE-TIME:' + utcStamp(ev.morning)
      : 'TRIGGER:-PT1H';
    alarms.push(['BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:Heute: Gratis Wintercheck · Code ' + claim.code, morning, 'END:VALARM']);
    var rows = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//KFZ Altun Neunkirchen//Wintergeschenk//DE', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      'UID:' + ev.uid,
      'DTSTAMP:' + utcStamp(now || new Date()),
      'DTSTART:' + utcStamp(ev.start),
      'DTEND:' + utcStamp(ev.end),
      'SUMMARY:' + icsEscape(ev.title),
      'LOCATION:' + icsEscape(ev.location),
      'DESCRIPTION:' + icsEscape(ev.description),
      'STATUS:CONFIRMED', 'TRANSP:OPAQUE',
    ];
    alarms.forEach(function (a) { rows = rows.concat(a.map(function (l) { return l.indexOf('DESCRIPTION:') === 0 ? 'DESCRIPTION:' + icsEscape(l.slice(12)) : l; })); });
    rows.push('END:VEVENT', 'END:VCALENDAR');
    return rows.map(fold).join('\r\n') + '\r\n';
  }

  function googleUrl(claim) {
    var ev = event(claim); if (!ev) return null;
    return 'https://calendar.google.com/calendar/render?action=TEMPLATE' +
      '&text=' + encodeURIComponent(ev.title) +
      '&dates=' + utcStamp(ev.start) + '/' + utcStamp(ev.end) +
      '&details=' + encodeURIComponent(ev.description) +
      '&location=' + encodeURIComponent(ev.location) +
      '&ctz=' + encodeURIComponent(TZ);
  }

  function outlookUrl(claim) {
    var ev = event(claim); if (!ev) return null;
    return 'https://outlook.live.com/calendar/0/deeplink/compose?path=%2Fcalendar%2Faction%2Fcompose&rru=addevent' +
      '&subject=' + encodeURIComponent(ev.title) +
      '&startdt=' + encodeURIComponent(isoZ(ev.start)) +
      '&enddt=' + encodeURIComponent(isoZ(ev.end)) +
      '&location=' + encodeURIComponent(ev.location) +
      '&body=' + encodeURIComponent(ev.description);
  }

  var api = { event: event, ics: ics, googleUrl: googleUrl, outlookUrl: outlookUrl, viennaToDate: viennaToDate, fold: fold };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.WGCal = api;
})(this);
