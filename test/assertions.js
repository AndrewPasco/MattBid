/**
 * Shared fixture assertions for parse.js, run from both parse.test.html and run.js.
 * Exposes runAssertions(parsed) -> [{name, pass, detail}].
 */
(function (global) {
  global.hiddenArrivalDays = function (lines) {
    var n = 0;
    lines.forEach(function (line) {
      if (line.reserve) return;
      line.trips.forEach(function (t) {
        var apt = function (tk) { return tk.some(function (x) { return /^[A-Z]{3}$/.test(x); }); };
        var mv = function (tk) { return tk.some(function (x) { return /^\d{3,4}$/.test(x) || x === 'D/H'; }); };
        t.stops.forEach(function (s) {
          for (var d = s.startIdx + 1; d <= s.endIdx; d++) {
            var tk = t.tokens[d - t.startIdx], prev = t.tokens[d - 1 - t.startIdx];
            if (apt(tk) && mv(tk) && apt(prev)) n++;
          }
        });
      });
    });
    return n;
  };

  'use strict';

  function runAssertions(r) {
    var results = [];
    function check(name, cond, detail) {
      results.push({ name: name, pass: !!cond, detail: detail || '' });
    }
    function eq(name, actual, expected) {
      check(name, actual === expected, 'expected ' + JSON.stringify(expected) + ' got ' + JSON.stringify(actual));
    }

    eq('pairings has 4 numbers', r.pairings.size, 4);

    var p1 = (r.pairings.get(1) || [])[0];
    check('pairing 1 exists', !!p1);
    if (p1) {
      eq('pairing 1: 8 legs', p1.legs.length, 8);
      eq('pairing 1: legs[0].flt', p1.legs[0].flt, 'UA5672');
      eq('pairing 1: legs[0].dh', p1.legs[0].dh, true);
      eq('pairing 1: legs[1].dh', p1.legs[1].dh, true);
      eq('pairing 1: legs[2].flt', p1.legs[2].flt, '6031');
      eq('pairing 1: legs[2].dh', p1.legs[2].dh, false);
      eq('pairing 1: credit', p1.credit, '83:36');
      eq('pairing 1: creditT', p1.creditT, true);
      eq('pairing 1: blk', p1.blk, '49:06');
      eq('pairing 1: ldgs', p1.ldgs, 6);
      eq('pairing 1: tafb', p1.tafb, '305:20');
      eq('pairing 1: effective.start', p1.effective.start, '2026-09-28');
      eq('pairing 1: effective.end', p1.effective.end, '2026-09-28');
      check('pairing 1: hotels[0].name starts CAPTAIN COOK', p1.hotels[0] && p1.hotels[0].name.indexOf('CAPTAIN COOK') === 0,
        JSON.stringify(p1.hotels[0]));
      eq('pairing 1: hotels[0].layover', p1.hotels[0] && p1.hotels[0].layover, 'ANC 49:23');
    }

    var p139 = (r.pairings.get(139) || [])[0];
    check('pairing 139 exists', !!p139);
    if (p139) {
      eq('pairing 139: 7 legs', p139.legs.length, 7);
      eq('pairing 139: legs[0].dh (DL1681)', p139.legs[0].dh, true);
      eq('pairing 139: legs[1].dh', p139.legs[1].dh, true);
      var restOk = p139.legs.slice(2).every(function (l) { return l.dh === false; });
      check('pairing 139: legs[2..] all not dh', restOk);
      eq('pairing 139: credit', p139.credit, '65:03');
    }

    eq('days[0]', r.days[0], '2026-09-28');
    eq('days.length', r.days.length, 37);
    eq('days[36]', r.days[36], '2026-11-03');
    eq('period.end', r.period.end, '2026-10-25');
    check('title contains OCTOBER 2026', r.title.indexOf('OCTOBER 2026') !== -1, r.title);

    eq('lines.length', r.lines.length, 9);

    var line1001 = r.lines.find(function (l) { return l.num === 1001; });
    check('LINE 1001 exists', !!line1001);
    if (line1001) {
      eq('LINE 1001: one trip', line1001.trips.length, 1);
      var t = line1001.trips[0];
      eq('LINE 1001: trip pairingNum', t.pairingNum, 1);
      eq('LINE 1001: trip startIdx', t.startIdx, 0);
      eq('LINE 1001: trip credit', t.credit, '83:36');
      eq('LINE 1001: trip dhKind', t.dhKind, 'front');
      eq('LINE 1001: trip midDh', t.midDh, false);
      eq('LINE 1001: stops labels', t.stops.map(function (s) { return s.label; }).join(','),
        'ANC,CAN,DEL,CAN,DEL,CDG,MEM');
      ['MEM', 'ORD', 'ANC'].forEach(function (city) {
        check('LINE 1001: dhCities contains ' + city, t.dhCities.indexOf(city) !== -1, t.dhCities.join(','));
      });
      eq('LINE 1001: line credit', line1001.credit, '83:36');
      eq('LINE 1001: daysOff', line1001.daysOff, 14);
      eq('LINE 1001: offDays.length', line1001.offDays.length, 14);
      eq('LINE 1001: flag', line1001.flag, '');
    }

    var line1002 = r.lines.find(function (l) { return l.num === 1002; });
    check('LINE 1002 exists', !!line1002);
    if (line1002) {
      eq('LINE 1002: flag', line1002.flag, '*');
      eq('LINE 1002: trips[0].pairingNum', line1002.trips[0].pairingNum, 366);
      eq('LINE 1002: trips[0].startIdx', line1002.trips[0].startIdx, 1);
    }

    var line1150 = r.lines.find(function (l) { return l.num === 1150; });
    check('LINE 1150 exists', !!line1150);
    if (line1150) {
      eq('LINE 1150: trips.length', line1150.trips.length, 2);
      var t0 = line1150.trips[0], t1 = line1150.trips[1];
      eq('LINE 1150: trips[0].pairingNum', t0.pairingNum, 139);
      eq('LINE 1150: trips[0].startIdx', t0.startIdx, 3);
      eq('LINE 1150: trips[0].credit', t0.credit, '65:03');
      eq('LINE 1150: trips[0].dhKind', t0.dhKind, 'front');
      eq('LINE 1150: trips[1].pairingNum', t1.pairingNum, 105);
      eq('LINE 1150: trips[1].startIdx', t1.startIdx, 23);
      eq('LINE 1150: trips[1].credit', t1.credit, '15:13');
      eq('LINE 1150: daysOff', line1150.daysOff, 15);
      check('LINE 1150: trips[0].tokens[0] contains D/H', t0.tokens[0] && t0.tokens[0].indexOf('D/H') !== -1,
        JSON.stringify(t0.tokens[0]));
      // pairing 105 legs: 5313 (not dh), UA1959 (dh), UA2789 (dh) -> trailing run of 2 dh legs -> 'back'
      eq('LINE 1150: trips[1].dhKind (from pairing 105 legs)', t1.dhKind, 'back');
      eq('LINE 1150: trips[0].endIdx', t0.endIdx, 13);
      eq('LINE 1150: trips[0] first stop label', t0.stops[0].label, 'CDG');
    }

    var reserveNums = [7001, 7002, 7003, 7004, 7008, 7009];
    var reserveLines = r.lines.filter(function (l) { return l.reserve; });
    eq('reserve lines count', reserveLines.length, 6);
    eq('reserve lines sorted after 1150 and match expected numbers',
      r.lines.slice(-6).map(function (l) { return l.num; }).join(','), reserveNums.join(','));

    var r7001 = r.lines.find(function (l) { return l.num === 7001; });
    check('7001 exists', !!r7001);
    if (r7001) {
      eq('7001: letter', r7001.letter, 'R');
      eq('7001: credit', r7001.credit, '80:00');
      eq('7001: trips[0].startIdx', r7001.trips[0].startIdx, 0);
      eq('7001: trips[0].endIdx', r7001.trips[0].endIdx, 6);
      eq('7001: daysOff', r7001.daysOff, 37 - r7001.trips.reduce(function (acc, t) { return acc + (t.endIdx - t.startIdx + 1); }, 0));
    }

    eq('pkg.rlg', r.rlg, '80:00');

    var r7008 = r.lines.find(function (l) { return l.num === 7008; });
    var r7009 = r.lines.find(function (l) { return l.num === 7009; });
    check('7008 and 7009 exist', !!r7008 && !!r7009);
    if (r7008 && r7009) {
      eq('7008: letter', r7008.letter, 'A');
      eq('7008 and 7009: equal letter', r7008.letter, r7009.letter);
      eq('7008 and 7009: equal trips', JSON.stringify(r7008.trips), JSON.stringify(r7009.trips));
    }

    var noBadStopLabels = true;
    r.lines.forEach(function (line) {
      line.trips.forEach(function (trip) {
        trip.stops.forEach(function (s) {
          if (s.label === 'D/H' || s.label === '=>' || /^\d+$/.test(s.label)) noBadStopLabels = false;
        });
      });
    });
    check('no stop label is D/H, =>, or numeric', noBadStopLabels);
    eq('no stop hides an out-and-back arrival day', global.hiddenArrivalDays(r.lines), 0);

    r.lines.forEach(function (line) {
      line.trips.forEach(function (trip) {
        check('trip endIdx >= startIdx (' + line.num + '/' + trip.pairingNum + ')', trip.endIdx >= trip.startIdx);
        check('trip endIdx < 37 (' + line.num + '/' + trip.pairingNum + ')', trip.endIdx < 37);
      });
    });

    return results;
  }

  global.runAssertions = runAssertions;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { runAssertions: runAssertions };
  }
})(typeof window !== 'undefined' ? window : globalThis);
