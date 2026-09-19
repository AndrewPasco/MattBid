/**
 * Parser for FedEx bid-package .asc text exports.
 * Plain browser script (also runnable under Node via `require`). No dependencies.
 */
(function (global) {
  'use strict';

  var MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

  function pad2(n) {
    return n < 10 ? '0' + n : String(n);
  }

  /** Convert 'hh:mm' (hours may be 1-3 digits) to minutes. */
  function toMinutes(hhmm) {
    var parts = hhmm.split(':');
    return Number(parts[0]) * 60 + Number(parts[1]);
  }

  /** Convert a 3-or-4-digit credit string ('8336' or '813') to 'hh:mm' ('83:36' or '08:13'). */
  function digitsToHHMM(s) {
    var mins = s.slice(-2);
    var hrs = s.slice(0, -2);
    if (hrs.length < 2) hrs = '0' + hrs;
    return hrs + ':' + mins;
  }

  function addDaysISO(iso, n) {
    var parts = iso.split('-').map(Number);
    var dt = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
    dt.setUTCDate(dt.getUTCDate() + n);
    return dt.getUTCFullYear() + '-' + pad2(dt.getUTCMonth() + 1) + '-' + pad2(dt.getUTCDate());
  }

  /** Resolve a pairing-header EFFECTIVE clause to an ISO {start,end}, given the title's month/year. */
  function parseEffective(text, titleMonthIdx, titleYear) {
    var m1, d1, m2, d2, m;
    m = text.match(/^([A-Z]{3}) (\d{2})-([A-Z]{3}) (\d{2})$/);
    if (m) {
      m1 = m[1]; d1 = Number(m[2]); m2 = m[3]; d2 = Number(m[4]);
    } else {
      m = text.match(/^([A-Z]{3}) (\d{2}) ONLY$/);
      m1 = m[1]; d1 = Number(m[2]); m2 = m1; d2 = d1;
    }
    return {
      start: effDate(m1, d1, titleMonthIdx, titleYear),
      end: effDate(m2, d2, titleMonthIdx, titleYear),
      text: text,
    };
  }

  function effDate(monAbbr, day, titleMonthIdx, titleYear) {
    var monthIdx = MONTHS.indexOf(monAbbr);
    var year = titleYear;
    if (titleMonthIdx - monthIdx > 6) year += 1;
    return year + '-' + pad2(monthIdx + 1) + '-' + pad2(day);
  }

  var HEADER_RE = /^ *(\d+) ((?:[A-Z]{2} ?)+) +REPORT AT +(\d\d:\d\d) \((\d\d:\d\d) L\.T\.\) +EFFECTIVE (.+)$/;
  var LEG_RE = /^(.{5}) +(\S+) +(\S+) +([A-Z0-9]{3,4}) (\d{4})\((\d{4})\) +([A-Z0-9]{3,4}) (\d{4})\((\d{4})\) +(\d\d:\d\d)(.*)$/;
  var HOTEL_RE = /^ {14}(.{44})\s*(?:\d\d:\d\dM? +){2}\d\d:\d\dM?(?: +([A-Z]{3}) (\d+:\d\d))?\s*$/;
  var FOOTER_RE = /CREDIT HRS: *(\d+:\d\d)(T?) +BLK HRS: *(\d+:\d\d) +LDGS: *(\d+) +TAFB: *(\d+:\d\d)/;
  var DASH_RE = /^-{5,}$/;
  var PAGE_HEADER_RE = /^ Report for \S+ schedule/;

  function parsePairings(sectionLines, titleMonthIdx, titleYear) {
    var pairings = new Map();
    var kept = sectionLines.filter(function (l) {
      return l !== '' && !PAGE_HEADER_RE.test(l);
    });

    var blocks = [];
    var cur = [];
    for (var i = 0; i < kept.length; i++) {
      var l = kept[i];
      if (DASH_RE.test(l)) {
        if (cur.length) blocks.push(cur);
        cur = [];
      } else {
        cur.push(l);
      }
    }
    if (cur.length) blocks.push(cur);

    blocks.forEach(function (block) {
      var hm = block[0].match(HEADER_RE);
      if (!hm) return;
      var num = Number(hm[1]);
      var dows = hm[2].trim().split(/ +/);
      var effText = hm[5].trim();
      var legs = [];
      var hotels = [];
      var footer = null;

      for (var j = 3; j < block.length; j++) {
        var line = block[j];
        var fm = line.match(FOOTER_RE);
        if (fm) {
          footer = { credit: fm[1], creditT: fm[2] === 'T', blk: fm[3], ldgs: Number(fm[4]), tafb: fm[5] };
          continue;
        }
        var lm = line.match(LEG_RE);
        if (lm) {
          var flt = lm[2];
          legs.push({
            day: lm[1].trim(),
            flt: flt,
            dh: /^[A-Z]{2}\d{4}$/.test(flt) && flt !== 'GT9999',
            eqp: lm[3],
            dep: lm[4], depZ: lm[5], depL: lm[6],
            arr: lm[7], arrZ: lm[8], arrL: lm[9],
            blk: lm[10],
            flags: lm[11].trim(),
          });
          continue;
        }
        if (/^ {14}TRANS /.test(line)) continue;
        if (/^ {14}/.test(line)) {
          var hmM = line.match(HOTEL_RE);
          if (hmM) {
            var name = hmM[1].trim();
            if (name) hotels.push({ name: name, layover: hmM[2] ? hmM[2] + ' ' + hmM[3] : '' });
          }
        }
      }

      var pairing = {
        num: num,
        dows: dows,
        report: hm[3],
        reportLocal: hm[4],
        effective: parseEffective(effText, titleMonthIdx, titleYear),
        crew: block[1].trim(),
        legs: legs,
        hotels: hotels,
        credit: footer ? footer.credit : '',
        creditT: footer ? footer.creditT : false,
        blk: footer ? footer.blk : '',
        ldgs: footer ? footer.ldgs : 0,
        tafb: footer ? footer.tafb : '',
        raw: block.join('\n'),
      };
      if (!pairings.has(num)) pairings.set(num, []);
      pairings.get(num).push(pairing);
    });

    return pairings;
  }

  function uniqueDhCities(legs) {
    var set = new Set();
    legs.forEach(function (l) {
      if (l.dh) { set.add(l.dep); set.add(l.arr); }
    });
    return Array.from(set);
  }

  /** Determine dhKind/midDh/dhCities for a trip, from its resolved pairing or (if none) its grid tokens. */
  function resolveDhKind(pairing, tokens) {
    if (pairing) {
      var legs = pairing.legs;
      var n = legs.length;
      var lead = 0;
      while (lead < n && legs[lead].dh) lead++;
      if (lead === n) {
        return { dhKind: 'double', midDh: false, dhCities: uniqueDhCities(legs) };
      }
      var trail = 0;
      while (trail < n && legs[n - 1 - trail].dh) trail++;
      var front = lead > 0 && trail === 0;
      var back = trail > 0 && lead === 0;
      var double = lead > 0 && trail > 0;
      var dhKind = front ? 'front' : back ? 'back' : double ? 'double' : 'none';
      var midDh = false;
      for (var k = lead; k < n - trail; k++) {
        if (legs[k].dh) { midDh = true; break; }
      }
      return { dhKind: dhKind, midDh: midDh, dhCities: uniqueDhCities(legs) };
    }

    var first = tokens[0] || [];
    var last = tokens[tokens.length - 1] || [];
    var hasFirst = first.indexOf('D/H') !== -1;
    var hasLast = last.indexOf('D/H') !== -1;
    var kind, mid = false;
    if (hasFirst && hasLast) kind = 'double';
    else if (hasFirst) kind = 'front';
    else if (hasLast) kind = 'back';
    else {
      kind = 'none';
      for (var d = 1; d < tokens.length - 1; d++) {
        if (tokens[d].indexOf('D/H') !== -1) { mid = true; break; }
      }
    }
    return { dhKind: kind, midDh: mid, dhCities: [] };
  }

  function parseCaptainSection(sectionLines, pairings) {
    var titleIdx = -1;
    for (var i = 0; i < sectionLines.length; i++) {
      if (/Captain ONLY\s*$/.test(sectionLines[i])) { titleIdx = i; break; }
    }
    var tm = sectionLines[titleIdx].match(/\((\d{4}-\d\d-\d\d) - (\d{4}-\d\d-\d\d)\)/);
    var period = { start: tm[1], end: tm[2] };

    var dateRowIdx = -1;
    for (var j = titleIdx + 1; j < sectionLines.length; j++) {
      if (/^\s+\|(\s*\d{2}[:|])/.test(sectionLines[j])) { dateRowIdx = j; break; }
    }
    var numDays = sectionLines[dateRowIdx].match(/\d{2}/g).length;
    var days = [];
    for (var d0 = 0; d0 < numDays; d0++) days.push(addDaysISO(period.start, d0));

    var lineStarts = [];
    for (var k = dateRowIdx + 1; k < sectionLines.length; k++) {
      if (/^LINE \d/.test(sectionLines[k])) lineStarts.push(k);
    }

    function cellAt(row, n) {
      return row.slice(28 + 5 * n, 28 + 5 * n + 4).trim();
    }

    var lines = lineStarts.map(function (idx) {
      var rows = sectionLines.slice(idx, idx + 6);
      var lm = rows[0].match(/^LINE (\d+)( \*)?/);
      var crTaf = rows[2].match(/CR\.\s+(\d+:\d\d)\s+TAFB\s+(\d+:\d\d)/);
      var blkLand = rows[4].match(/BLK\.\s+(\d+:\d\d)\s+LANDINGS\s+(\d+)/);
      var daysOffM = rows[5].match(/DAYS OFF\s+(\d+)/);

      var offDays = [];
      var tripStarts = [];
      for (var day = 0; day < numDays; day++) {
        var c = cellAt(rows[4], day);
        if (c === '---') offDays.push(day);
        else if (/^\d+$/.test(c)) tripStarts.push({ day: day, pairingNum: Number(c) });
      }

      // Credit digits are right-aligned in their slot: a single-digit hour ('8:13' -> '813')
      // drops its leading zero, so the token can be 3 or 4 digits wide.
      var creditByDay = {};
      var creditRe = /\d{3,4}/g;
      var cm;
      while ((cm = creditRe.exec(rows[5]))) {
        creditByDay[Math.floor((cm.index - 29) / 5)] = digitsToHHMM(cm[0]);
      }

      var trips = tripStarts.map(function (ts) {
        var endIdx = ts.day;
        while (endIdx + 1 < numDays) {
          var nc = cellAt(rows[4], endIdx + 1);
          if (nc === '---' || /^\d+$/.test(nc)) break;
          endIdx++;
        }
        while (endIdx > ts.day) {
          var hasToken = [0, 1, 2, 3].some(function (r) { return cellAt(rows[r], endIdx); });
          if (hasToken) break;
          endIdx--;
        }

        var tokens = [];
        for (var day2 = ts.day; day2 <= endIdx; day2++) {
          tokens.push([0, 1, 2, 3].map(function (r) { return cellAt(rows[r], day2); }).filter(Boolean));
        }

        var candidates = pairings.get(ts.pairingNum) || [];
        var startDate = days[ts.day];
        var pairing = candidates.find(function (p) {
          return p.effective.start <= startDate && startDate <= p.effective.end;
        }) || candidates[0] || null;

        var dh = resolveDhKind(pairing, tokens);

        return {
          pairingNum: ts.pairingNum,
          credit: creditByDay[ts.day] || '',
          startIdx: ts.day,
          endIdx: endIdx,
          tokens: tokens,
          pairing: pairing,
          dhKind: dh.dhKind,
          midDh: dh.midDh,
          dhCities: dh.dhCities,
        };
      });

      return {
        num: Number(lm[1]),
        flag: lm[2] ? '*' : '',
        credit: crTaf[1],
        tafb: crTaf[2],
        blk: blkLand[1],
        landings: Number(blkLand[2]),
        daysOff: Number(daysOffM[1]),
        offDays: offDays,
        trips: trips,
        rows: rows,
      };
    });

    return { period: period, days: days, lines: lines };
  }

  function parseAsc(text) {
    var lines = text.split(/\r?\n/);
    var tm = lines[0].match(/Report for (\S+) schedule (\S+) (\d{4})\s+([A-Z]+) BASE/);
    var fleet = tm[1], monthName = tm[2], year = Number(tm[3]), base = tm[4];
    var titleMonthIdx = MONTHS.indexOf(monthName.slice(0, 3));
    var title = fleet + ' ' + monthName + ' ' + year + ' ' + base;

    var hashIdxs = [];
    lines.forEach(function (l, i) { if (l === '######') hashIdxs.push(i); });
    var section1 = lines.slice(0, hashIdxs[0]);
    var section2 = lines.slice(hashIdxs[0] + 1, hashIdxs[1]);

    var pairings = parsePairings(section1, titleMonthIdx, year);
    var cal = parseCaptainSection(section2, pairings);

    return {
      title: title,
      period: cal.period,
      days: cal.days,
      pairings: pairings,
      lines: cal.lines,
      seat: 'CAP',
    };
  }

  global.parseAsc = parseAsc;
  global.toMinutes = toMinutes;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { parseAsc: parseAsc, toMinutes: toMinutes };
  }
})(typeof window !== 'undefined' ? window : globalThis);
