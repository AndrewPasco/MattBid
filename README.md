# MattBid v0

MattBid is a single-page dashboard for FedEx monthly bid lines. It reads the bid package `.asc`
export, shows each line as a calendar bar, and exports an ordered bid.

## Files

- `index.html`: the app (markup, styles, and logic).
- `parse.js`: the `.asc` parser. `parseAsc(text)` returns the package object.
- `test/parse.test.html`: browser test page. `test/run.js`: the same checks under Node.
- `test/fixture.asc`: a small cut of a real package. It is not in git. Create it with
  `sh test/make-fixture.sh ~/Downloads/2026_Oct_B777_MEM_LINES.asc`.

## Run locally

1. Start a static server in this folder:

   ```bash
   python3 -m http.server 8765
   ```

2. Open `http://localhost:8765/` and import the `.asc` file.
3. Open `http://localhost:8765/test/parse.test.html` to run the parser tests.

The app needs a web server because it loads `parse.js` and SortableJS (from cdnjs).
Safari on iPad does not run scripts in HTML files opened from the Files app, so the app is
hosted on GitHub Pages: https://andrewpasco.github.io/MattBid/

## iPad

1. Open https://andrewpasco.github.io/MattBid/ in Safari.
2. Tap the share button, then `Add to Home Screen`, so it opens like an app.
3. Save the `.asc` file to the Files app (iCloud Drive or On My iPad).
4. In MattBid, tap `Choose File` and pick the `.asc` file. The package stays in the browser
   storage until you import another one.
5. Export: `Copy` puts the line numbers on the clipboard; `Download` saves a `.txt` file to
   Files.

## Use

- Import: choose the `.asc` file. The app keeps the text in `localStorage` so a reload does
  not need a new import.
- Colors: blue = front-end deadhead, green = back-end deadhead, orange = both,
  yellow = no deadhead. A white dot in the middle = a deadhead inside the trip.
  Only legs with an airline code (`UA5672`, `DL0084`) count as deadheads.
- Tap a trip to open the pairing details and the raw pairing text.
- Tap a day in the calendar header to mark it as a day off. The `Days off` mode either
  highlights those days or hides lines that work on them.
- `DH city`: type an airport code. `exclude` hides lines with a deadhead through that city,
  `only` shows only those lines.
- Select lines with the checkbox. Drag lines and tier breaks in the `Selected` panel.
- `Export bid` gives one line number per row, tiers flattened top to bottom. Check
  `add 9952 (VTO)` to append 9952 as the last choice.

## Test

```bash
node test/run.js
```

The Node run checks the fixture and, when `~/Downloads/2026_Oct_B777_MEM_LINES.asc`
exists, the full package (line count, unresolved pairings, and credit sums).
