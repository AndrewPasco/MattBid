/**
 * Node-based verification: runs the shared fixture assertions, then sanity-checks
 * the parser against the full real .asc export.
 */
var fs = require('fs');
var os = require('os');
var path = require('path');

global.window = global;
require('../parse.js');
require('./assertions.js');

function main() {
  var fixturePath = path.join(__dirname, 'fixture.asc');
  if (!fs.existsSync(fixturePath)) {
    console.log('test/fixture.asc is missing. Create it: sh test/make-fixture.sh <package.asc>');
    process.exit(1);
  }
  var fixtureText = fs.readFileSync(fixturePath, 'utf8');
  var fixtureParsed = global.parseAsc(fixtureText);
  var results = global.runAssertions(fixtureParsed);

  var passed = 0, failed = 0;
  results.forEach(function (r) {
    console.log((r.pass ? 'PASS' : 'FAIL') + ' - ' + r.name + (r.pass ? '' : ' (' + r.detail + ')'));
    if (r.pass) passed++; else failed++;
  });
  console.log(passed + ' passed, ' + failed + ' failed');

  var realPath = process.env.MATTBID_ASC || path.join(os.homedir(), 'Downloads/2026_Oct_B777_MEM_LINES.asc');
  if (!fs.existsSync(realPath)) {
    console.log('\nReal file not found at ' + realPath + ', skipping full-file checks. Set MATTBID_ASC to its path.');
    process.exit(failed === 0 ? 0 : 1);
  }

  var real = global.parseAsc(fs.readFileSync(realPath, 'utf8'));
  var calLines = real.lines.filter(function (l) { return !l.reserve; });
  var reserveLines = real.lines.filter(function (l) { return l.reserve; });

  function expect(name, actual, expected) {
    var ok = actual === expected;
    if (!ok) failed++;
    console.log((ok ? 'PASS' : 'FAIL') + ' - ' + name + ': ' + actual + (ok ? '' : ' (expected ' + expected + ')'));
  }

  console.log('\n--- full file checks: ' + realPath + ' ---');
  // The counts are for the default October 2026 package. Other packages get only the invariants.
  if (!process.env.MATTBID_ASC) {
    expect('lines', calLines.length, 283);
    expect('pairing numbers', real.pairings.size, 874);
    expect('reserve lines', reserveLines.length, 52);
  }
  expect('reserve lines with a blank letter', reserveLines.filter(function (l) { return !l.letter; }).length, 0);
  expect('stops that hide an out-and-back arrival day', global.hiddenArrivalDays(real.lines), 0);
  // Warnings cover missing pairings, pairings with no effective date, and credit sums.
  expect('parse warnings', real.warnings.length, 0);
  real.warnings.slice(0, 5).forEach(function (w) { console.log('  ' + w); });

  process.exit(failed === 0 ? 0 : 1);
}

main();
