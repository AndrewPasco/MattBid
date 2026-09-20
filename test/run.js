/**
 * Node-based verification: runs the shared fixture assertions, then sanity-checks
 * the parser against the full real .asc export.
 */
var fs = require('fs');
var path = require('path');

global.window = global;
require('../parse.js');
require('./assertions.js');

function main() {
  var fixtureText = fs.readFileSync(path.join(__dirname, 'fixture.asc'), 'utf8');
  var fixtureParsed = global.parseAsc(fixtureText);
  var results = global.runAssertions(fixtureParsed);

  var passed = 0, failed = 0;
  results.forEach(function (r) {
    console.log((r.pass ? 'PASS' : 'FAIL') + ' - ' + r.name + (r.pass ? '' : ' (' + r.detail + ')'));
    if (r.pass) passed++; else failed++;
  });
  console.log(passed + ' passed, ' + failed + ' failed');

  var realPath = '/Users/apasco/Downloads/2026_Oct_B777_MEM_LINES.asc';
  if (!fs.existsSync(realPath)) {
    console.log('\nReal file not found at ' + realPath + ', skipping full-file checks.');
    process.exit(failed === 0 ? 0 : 1);
  }

  var realText = fs.readFileSync(realPath, 'utf8');
  var real = global.parseAsc(realText);

  var calLines = real.lines.filter(function (l) { return !l.reserve; });
  var reserveLines = real.lines.filter(function (l) { return l.reserve; });

  console.log('\n--- full file checks ---');
  console.log('lines count: ' + calLines.length + ' (expect 283)');
  console.log('pairings count: ' + real.pairings.size + ' (expect 874)');
  console.log('reserve lines count: ' + reserveLines.length + ' (expect 52)');
  var blankLetterLines = reserveLines.filter(function (l) { return !l.letter; });
  console.log('reserve lines with blank letter: ' + blankLetterLines.length + ' (expect 0)');

  var trips = [];
  calLines.forEach(function (line) {
    line.trips.forEach(function (trip) { trips.push({ line: line, trip: trip }); });
  });
  console.log('trips: ' + trips.length);

  var nullPairingTrips = trips.filter(function (t) { return t.trip.pairing === null; });
  console.log('trips with pairing null: ' + nullPairingTrips.length + ' (expect 0)');
  if (nullPairingTrips.length) {
    nullPairingTrips.slice(0, 5).forEach(function (t) {
      console.log('  LINE ' + t.line.num + ' pairingNum ' + t.trip.pairingNum + ' startIdx ' + t.trip.startIdx);
    });
  }

  var mismatches = [];
  calLines.forEach(function (line) {
    var sumMinutes = line.trips.reduce(function (acc, t) {
      return acc + (t.credit ? global.toMinutes(t.credit) : 0);
    }, 0);
    // Line credit excludes the carry-out portion of a trip that ends after the bid period (row 3 'C/O.').
    var co = line.rows[3].match(/C\/O\.\s+(\d+:\d\d)/);
    var lineMinutes = global.toMinutes(line.credit) + (co ? global.toMinutes(co[1]) : 0);
    if (sumMinutes !== lineMinutes) {
      mismatches.push({ num: line.num, sum: sumMinutes, lineCredit: lineMinutes });
    }
  });
  console.log('line credit mismatches: ' + mismatches.length);
  mismatches.slice(0, 5).forEach(function (m) {
    console.log('  LINE ' + m.num + ' sum=' + m.sum + 'min line=' + m.lineCredit + 'min');
  });

  process.exit(failed === 0 ? 0 : 1);
}

main();
