/**
 * Contract tests for parse.js on synthetic packages. Run: node --test test/unit.test.js
 * The builders copy the column layout of a real .asc file. The data is made up, so these
 * tests run on every machine and need no real package.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { parseAsc } = require('../parse.js');

// ---------- builders ----------

/** A leg row. `day` is the 5-character DAY column, for example ' 25SU' or '  *TU'. */
const leg = (flt, dep, arr, day = '   MO') =>
  `${day} ${flt.padStart(6)}  F83  ${dep} 1000(0500)  ${arr} 1100(0600)  01:00`;

/** The row with the duty times. It ends a duty period. */
const dutyEnd = (city = '') => ' '.repeat(58) + '01:00  02:00  01:00' + (city ? `  ${city} 20:00` : '');

/** A pairing block. `rows` are leg() and dutyEnd() rows. */
const pairing = (num, effective, rows) => [
  `${String(num).padStart(6)} MO               REPORT AT  10:00 (05:00 L.T.)  EFFECTIVE ${effective}`,
  ' FULL CREW',
  '  DAY   FLT.  EQP  DEPARTS (L.T.)  ARRIVES (L.T.)  BLK.     BLK.   DUTY    CR.      LAYOVER',
  ...rows,
  '     CREDIT HRS:   10:00T    BLK HRS:  05:00     LDGS:   2      TAFB:   30:00',
  '-'.repeat(92),
];

/**
 * A 6-row LINE block. `days` has one item per grid day: the day's tokens (4 or fewer), '---'
 * (a day off), or { off: true, tokens } (a day off that still holds the last leg of a trip).
 * `starts` maps a day index to [pairing number, trip credit 'hh:mm'].
 */
function lineBlock(num, days, starts, lineCredit = '10:00') {
  const toks = d => (Array.isArray(d) ? d : (d && d.tokens) || []);
  const off = d => d === '---' || !!(d && d.off);
  const row = (label, cell) => label.padEnd(27) + '|' + days.map((d, n) => cell(d, n).padStart(4)).join(':');
  const tok = r => d => toks(d)[r] || '';
  return [
    row(`LINE ${num}`, tok(0)),
    row('', tok(1)),
    row(` CR.   ${lineCredit}  TAFB  30:00`, tok(2)),
    row('', tok(3)),
    row(' BLK.   5:00  LANDINGS 2', (d, n) => (off(d) ? '---' : starts[n] ? String(starts[n][0]) : '')),
    ' DAYS OFF 1'.padEnd(28) + days.map((d, n) => ' ' + (starts[n] ? starts[n][1].replace(':', '') : '').padStart(4)).join(''),
  ];
}

/** A package text: title, pairings, then the Captain grid that starts on `start`. */
function packageText({ month = 'OCTOBER 2026', start = '2026-10-25', pairings, line }) {
  const dates = line[0].split('|')[1].split(':').map((_, n) => {
    const d = new Date(start + 'T00:00Z');
    d.setUTCDate(d.getUTCDate() + n);
    return String(d.getUTCDate()).padStart(2, '0');
  });
  return [
    ` Report for B777 schedule ${month}                      MEM BASE  #     1`,
    ...pairings.flat(),
    '######',
    `${month.slice(0, 3)} (${start} - 2099-01-01) - B777 MEM DOMICILE - Captain ONLY`,
    ''.padEnd(27) + '|' + dates.map(d => `  ${d}`).join(':'),
    ...line,
    '######',
  ].join('\n');
}

const trip = pkg => pkg.lines[0].trips[0];
const labels = pkg => trip(pkg).stops.map(s => s.label);
/** Each stop as [label, first day, last day], with days counted from the trip start. */
const stops = pkg => trip(pkg).stops.map(s => [s.label, s.startIdx - trip(pkg).startIdx, s.endIdx - trip(pkg).startIdx]);

// ---------- contracts ----------

test('a file that is not a package: parse throws a clear error', () => {
  assert.throws(() => parseAsc('hello'), /not a bid package/);
});

test('a package with no Captain grid: parse throws a clear error', () => {
  assert.throws(() => parseAsc(' Report for B777 schedule OCTOBER 2026   MEM BASE\n######\n######'), /Captain ONLY/);
});

test('two duties fly EWR-IND-EWR overnight: each shows "EWR IND EWR" from its start day', () => {
  const pkg = parseAsc(packageText({
    pairings: [pairing(21, 'OCT 25 ONLY', [
      leg('1101', 'MEM', 'EWR'), dutyEnd('EWR'),
      leg('1102', 'EWR', 'IND'), leg('1103', 'IND', 'EWR'), dutyEnd('EWR'),
      leg('1102', 'EWR', 'IND'), leg('1103', 'IND', 'EWR'), dutyEnd('EWR'),
      leg('1104', 'EWR', 'MEM'), dutyEnd(),
    ])],
    line: lineBlock(1001, [['1101', 'EWR'], ['1102'], ['1103', 'EWR', '1102'], ['1103', 'EWR'], ['1104']], { 0: [21, '10:00'] }),
  }));
  assert.deepEqual(stops(pkg), [['EWR', 0, 0], ['EWR IND EWR', 1, 1], ['EWR IND EWR', 2, 3], ['MEM', 4, 4]]);
  assert.deepEqual(pkg.warnings, []);
});

test('a loop, then a move to a new city the next day: each shows on its own day', () => {
  const pkg = parseAsc(packageText({
    pairings: [pairing(22, 'OCT 25 ONLY', [
      leg('2201', 'MEM', 'CDG'), dutyEnd('CDG'),
      leg('2202', 'CDG', 'LGG'), leg('2203', 'LGG', 'CDG'), dutyEnd('CDG'),
      leg('2204', 'CDG', 'FRA'), dutyEnd('FRA'),
      leg('2204', 'FRA', 'MEM'), dutyEnd(),
    ])],
    line: lineBlock(1001, [['2201'], ['CDG'], ['2202'], ['2203', 'CDG', '2204', 'FRA'], ['2204']], { 0: [22, '10:00'] }),
  }));
  assert.deepEqual(stops(pkg), [['CDG', 0, 1], ['CDG LGG CDG', 2, 2], ['FRA', 3, 3], ['MEM', 4, 4]]);
});

test('a duty with two legs that ends in a new city: the stop shows the full route', () => {
  const pkg = parseAsc(packageText({
    pairings: [pairing(30, 'OCT 25 ONLY', [
      leg('1111', 'MEM', 'EWR'), leg('2222', 'EWR', 'ORD'), dutyEnd('ORD'),
      leg('3333', 'ORD', 'MEM'), dutyEnd(),
    ])],
    line: lineBlock(1001, [['1111', '2222', 'ORD'], ['3333']], { 0: [30, '10:00'] }),
  }));
  assert.deepEqual(labels(pkg), ['MEM EWR ORD', 'MEM']);
});

test('a two-stop duty, a layover day, then a loop: each route shows on its own days', () => {
  const pkg = parseAsc(packageText({
    pairings: [pairing(31, 'OCT 25 ONLY', [
      leg('3101', 'MEM', 'KIX'), dutyEnd('KIX'),
      leg('3102', 'KIX', 'PEK'), leg('3103', 'PEK', 'ICN'), dutyEnd('ICN'),
      leg('3104', 'ICN', 'PEK'), leg('3105', 'PEK', 'ICN'), dutyEnd('ICN'),
      leg('3106', 'ICN', 'MEM'), dutyEnd(),
    ])],
    line: lineBlock(1001, [['3101', 'KIX'], ['3102', '3103'], ['ICN'], ['3104', '3105'], ['ICN', '3106']], { 0: [31, '10:00'] }),
  }));
  assert.deepEqual(stops(pkg), [['KIX', 0, 0], ['KIX PEK ICN', 1, 2], ['ICN PEK ICN', 3, 3], ['MEM', 4, 4]]);
});

test('the last leg departs on a day that the grid marks as a day off: the trip keeps that day', () => {
  const pkg = parseAsc(packageText({
    pairings: [pairing(32, 'OCT 25 ONLY', [
      leg('3201', 'MEM', 'KIX'), dutyEnd('KIX'),
      leg('3202', 'KIX', 'MEM'), dutyEnd(),
    ])],
    line: lineBlock(1001, [['3201', 'KIX'], ['KIX'], { off: true, tokens: ['3202'] }, '---'], { 0: [32, '10:00'] }),
  }));
  assert.deepEqual(stops(pkg), [['KIX', 0, 1], ['MEM', 2, 2]]);
});

test('a JAN package and a pairing effective DEC 29: the Dec 29 trip uses that pairing', () => {
  const pkg = parseAsc(packageText({
    month: 'JANUARY 2027',
    start: '2026-12-28',
    pairings: [
      pairing(5, 'JAN 05 ONLY', [leg('1111', 'MEM', 'ORD'), leg('2222', 'ORD', 'MEM'), dutyEnd()]),
      pairing(5, 'DEC 29 ONLY', [leg('3333', 'MEM', 'EWR'), leg('4444', 'EWR', 'MEM'), dutyEnd()]),
    ],
    line: lineBlock(1001, ['---', ['3333', 'EWR'], ['4444']], { 1: [5, '10:00'] }),
  }));
  assert.equal(trip(pkg).pairing.effective.text, 'DEC 29 ONLY');
  assert.equal(trip(pkg).pairing.effective.start, '2026-12-29');
  assert.deepEqual(pkg.warnings, []);
});

test('an evening departure (EFFECTIVE is the next Zulu day): the trip uses that pairing', () => {
  const pkg = parseAsc(packageText({
    start: '2026-10-02',
    pairings: [
      pairing(7, 'OCT 10 ONLY', [leg('1111', 'MEM', 'ORD'), leg('2222', 'ORD', 'MEM'), dutyEnd()]),
      pairing(7, 'OCT 03 ONLY', [leg('3333', 'MEM', 'EWR'), leg('4444', 'EWR', 'MEM'), dutyEnd()]),
    ],
    line: lineBlock(1001, [['3333', 'EWR'], ['4444']], { 0: [7, '10:00'] }),
  }));
  assert.equal(trip(pkg).pairing.effective.text, 'OCT 03 ONLY');
  assert.deepEqual(pkg.warnings, []);
});

test('an EFFECTIVE clause with an unknown format: parse continues and warns', () => {
  const pkg = parseAsc(packageText({
    pairings: [pairing(9, 'OCT 01-OCT 31 EXCEPT OCT 15', [leg('1111', 'MEM', 'EWR'), leg('2222', 'EWR', 'MEM'), dutyEnd()])],
    line: lineBlock(1001, [['1111', 'EWR'], ['2222']], { 0: [9, '10:00'] }),
  }));
  assert.equal(trip(pkg).pairing.num, 9);
  assert.deepEqual(pkg.warnings, ['LINE 1001: no pairing 9 is effective on 2026-10-25']);
});

test('a pairing with no legs that the parser can read: parse continues and warns', () => {
  const pkg = parseAsc(packageText({
    pairings: [pairing(11, 'OCT 25 ONLY', ['  garbled leg row', dutyEnd()])],
    line: lineBlock(1001, [['1111', 'EWR'], ['2222']], { 0: [11, '10:00'] }),
  }));
  assert.equal(trip(pkg).pairing, null);
  assert.deepEqual(pkg.warnings, ['LINE 1001: pairing 11 is not in the package']);
});

test('trip credits that do not add up to the line credit: parse warns', () => {
  const pkg = parseAsc(packageText({
    pairings: [pairing(12, 'OCT 25 ONLY', [leg('1111', 'MEM', 'EWR'), leg('2222', 'EWR', 'MEM'), dutyEnd()])],
    line: lineBlock(1001, [['1111', 'EWR'], ['2222']], { 0: [12, '10:00'] }, '12:00'),
  }));
  assert.deepEqual(pkg.warnings, ['LINE 1001: the trip credits do not add up to the line credit']);
});

test('a deadhead leg between two FedEx legs: the trip marks the day of that leg', () => {
  const pkg = parseAsc(packageText({
    pairings: [pairing(33, 'OCT 25 ONLY', [
      leg('3301', 'MEM', 'EWR'), dutyEnd('EWR'),
      leg('UA3302', 'EWR', 'ORD'), dutyEnd('ORD'),
      leg('3303', 'ORD', 'MEM'), dutyEnd(),
    ])],
    line: lineBlock(1001, [['3301', 'EWR'], ['D/H', 'ORD'], ['3303']], { 0: [33, '10:00'] }),
  }));
  assert.equal(trip(pkg).dhKind, 'none');
  assert.deepEqual(trip(pkg).midDhDays, [1]);
});
