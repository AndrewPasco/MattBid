# MattBid v0

MattBid is a single-page dashboard for FedEx monthly bid lines. It reads the bid package `.asc`
export, shows each line as a calendar bar, and exports an ordered bid.

## Files

- `index.html`: the app (markup, styles, and logic).
- `parse.js`: the `.asc` parser. `parseAsc(text)` returns the package object.
- `sw.js` and `manifest.json`: offline launch and the Home Screen app. `vendor/`: SortableJS.
- `worker/`: the sync server (a Cloudflare Worker). See "Sync" below.
- `test/parse.test.html`: browser test page. `test/run.js`: the same checks under Node.
- `test/unit.test.js`: contract tests on synthetic packages. `AGENTS.md` gives the test rules.
- `test/fixture.asc`: a small cut of a real package. It is not in git. Create it with
  `sh test/make-fixture.sh ~/Downloads/2026_Oct_B777_MEM_LINES.asc`.

## Run locally

1. Start a static server in this folder:

   ```bash
   python3 -m http.server 8765
   ```

2. Open `http://localhost:8765/` and import the `.asc` file.
3. Open `http://localhost:8765/test/parse.test.html` to run the parser tests.

The app needs a web server because it loads `parse.js`, `vendor/Sortable.min.js`, and the
service worker (`sw.js`).
Safari on iPad does not run scripts in HTML files opened from the Files app, so the app is
hosted on GitHub Pages: https://andrewpasco.github.io/MattBid/

## iPad

1. Open https://andrewpasco.github.io/MattBid/ in Safari. You can use Chrome for other sites.
2. Tap the share button, then `Add to Home Screen`. Keep `Open as Web App` on.
3. Always open MattBid from the Home Screen icon. It must open full screen, with no address
   bar. If it opens in a browser tab, remove the icon and do steps 1 and 2 again. The Home
   Screen app has its own storage, so a package that you import in a browser tab does not
   show in it.
4. Save the `.asc` file to the Files app (iCloud Drive or On My iPad).
5. In MattBid, tap `Choose File` and pick the `.asc` file. MattBid keeps each month that you
   import. Use the list at the top to change the month. Each change saves at once on this
   iPad. Other devices do not get it.
6. After one launch with a network, MattBid also opens with no network (for example, in
   airplane mode). When the network is back, the next launch gets the newest version.
7. Export: `Copy` puts the line numbers on the clipboard. `Download` saves a `.txt` file. In
   the Home Screen app, tap `Save to Files` in the share sheet.

## Sync (optional)

Sync keeps your selections, tiers, and filters the same on all your devices. The FedEx package
does not sync: import the `.asc` file on each device.

1. On each device, tap `Sync`, type the same sync password (10 or more characters), and tap
   `Turn on sync`. Your password manager (for example, iCloud Keychain) can save the password
   and fill it in on your other devices.
2. Import the same `.asc` file on each device. Your selections show.

If two devices already have selections for a month before you turn on sync, turn on sync first
on the device with the selections that you want to keep. The other device then gets them.

A change syncs 2 seconds after you make it, and again each time you open the app. With no
network, the button shows `Sync ⚠`, and MattBid tries again when the network is back. If two
devices change the same month, the last change wins. Anyone who knows the password can see and
change your selections, so use a password that is hard to guess. MattBid keeps only a code made
from the password, not the password.

## Use

- Import: choose the `.asc` file. The app keeps the package in the browser storage
  (IndexedDB), so a reload does not need a new import. Your selections and filters save at
  once. All data stays in this browser on this device. Other devices and browsers do not
  see it.
- Colors: blue = front-end deadhead, green = back-end deadhead, orange = both,
  yellow = no deadhead. A purple day = the day of a deadhead inside the trip.
  Only legs with an airline code (`UA5672`, `DL0084`) count as deadheads.
- Each trip shows one stop for each duty, from the day that the duty starts: the city where
  the duty lands. If a duty lands in two or more cities, the stop shows the full route, for
  example `KIX PEK ICN` or `EWR IND EWR`. Deadhead connections show too (`MEM ORD ANC`).
- Tap a trip to open the pairing details and the raw pairing text.
- If the parser finds a problem in the package (for example, trip credits that do not add up
  to the line credit), the count shows `⚠ N parse warnings`. Tap it to see the list.
- Tap a day in the calendar header to mark it as a day off. The `Days off` mode either
  highlights those days or hides lines that work on them.
- `DH city`: type an airport code. `exclude` hides lines with a deadhead through that city,
  `only` shows only those lines.
- Select a line with its checkbox. The line moves from the list to the `Selected` panel.
  `✕` in `Selected` moves it back. Drag lines and tier breaks in the `Selected` panel.
  A selected line that a new import of the month removed shows `not in this package`. The
  export still includes it, so remove it with `✕`.
- `Export bid` gives one line number per row, tiers flattened top to bottom. Check
  `add 9952 (VTO)` to append 9952 as the last choice.

## Test

```bash
node --test test/unit.test.js
node test/run.js
```

The first command runs on every machine. The second command checks the fixture and, when
`~/Downloads/2026_Oct_B777_MEM_LINES.asc` exists (or `MATTBID_ASC` gives a package path), the
full package: counts, stop labels, and parse warnings.

For the sync server, also run `npm ci` and `npm test` in `worker/`.
