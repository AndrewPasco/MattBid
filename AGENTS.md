# Agent guide: MattBid

MattBid is a static web page for FedEx bid lines. It has no build step and no dependencies to
install. Read `README.md` first for the user workflow.

## Files

- `parse.js`: the `.asc` parser. It is a plain browser script that Node can also `require`.
- `index.html`: the app (markup, styles, and logic). No automated test covers it.
- `sw.js`: the service worker for offline launch. It lists the files that the app loads.
- `manifest.json`: makes the Home Screen icon open the app as a standalone web app.
- `vendor/Sortable.min.js`: SortableJS 1.15.6 (MIT), the same bytes as the npm package.
- `worker/`: the sync server, a Cloudflare Worker with one Durable Object for each sync code.
- `test/unit.test.js`: contract tests on synthetic packages. They run on every machine.
- `test/run.js` and `test/assertions.js`: checks on a cut of a real package and on the full package.

## Run the tests

1. Always run the synthetic tests:

   ```bash
   node --test test/unit.test.js
   ```

2. If a real package is on this machine, also run the real-data checks:

   ```bash
   sh test/make-fixture.sh ~/Downloads/2026_Oct_B777_MEM_LINES.asc
   node test/run.js
   ```

   For a different package, set `MATTBID_ASC=<path>`. Then `run.js` does only the checks that
   apply to all packages.

3. If you change `worker/`, run its tests. They start `wrangler dev` (the local runtime, with no
   account and no network):

   ```bash
   cd worker && npm ci && npm test
   ```

## Deploy the sync server

- Run `npm run deploy` in `worker/` (the pinned wrangler). It needs `wrangler login` to the owner's Cloudflare
  account. The URL is `https://mattbid-sync.mattbid-sync.workers.dev`, and `SYNC_URL` in
  `index.html` uses it.
- An iPad can run an old copy of the app from the service worker cache. If you change the API,
  keep the old requests working.
- The sync code is SHA-256 of `mattbid-sync:` plus the sync password, as base64url
  (`syncKeyFor` in `index.html`). If you change this, each device loses its sync until the
  user types the password again.
- The Worker allows 60 requests a minute for each client address (the `LIMITER` binding).
- `save()` in `index.html` changes `updatedAt` only when the state changes. Keep it that way: if
  a device changes `updatedAt` without an edit, its old state overwrites newer edits.

## Rules for new tests

- Do not put real package data in git. The repository is public. `test/fixture.asc` stays in
  `.gitignore`.
- For each parser bug, first write a synthetic test that fails. Then fix the bug.
- Write each test as a contract. The test name gives the precondition and the effect. The
  action is `parseAsc`.
- Build the input with the builders in `test/unit.test.js`: `leg`, `dutyEnd`, `pairing`,
  `lineBlock`, and `packageText`. Copy the column layout of a real package, not its data.
- If you change how the parser reads a column, run `node test/run.js` on the full package.
  `pkg.warnings` must stay empty.
- A check that only prints a number is not a test. Make it fail the run.
- For a change to `index.html`, open the app in a browser and do the changed task by hand
  (`README.md`, "Run locally").
- If the app loads a new file, add the file to `FILES` in `sw.js`. If you do not, the app does
  not open offline. To check, load the app once, stop the server, and load the app again.

## Package facts that the tests use

- The grid days are local dates. The `EFFECTIVE` dates are the Zulu dates of the first
  departure. Thus a trip that departs in the evening is effective one day after its grid day.
- One pairing number can have more than one block, each with a different `EFFECTIVE` range.
- A January package can have pairings that are effective in December of the previous year.
- The row with the three duty times (and the hotel, if there is one) ends a duty period.
- The grid shows flight numbers and layover cities only. The legs of the pairing give the full
  route.
- The grid shows each leg as one token, in leg order: the FedEx flight number, `D/H` (an
  airline deadhead or ground transport), or `HSBY` (a hotel standby, leg `STHOTL`). The parser
  uses this order to put each leg on its day. Each duty period starts a stop on that day.
- The grid can mark the day of the last leg of a trip as a day off (`---`) when the leg departs
  after midnight. That day is still part of the trip.
- A trip in the next columns can show the last leg of the trip before it.
- The stop labels of a trip must list every city where a leg lands, in order
  (`missedLandings` in `test/assertions.js`).
- The trip credits (the last row of a `LINE` block) add up to the line credit (`CR.`) plus the
  `C/O.` credit on the fourth row.
