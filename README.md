# Paukščių lyderių lentelė – organiser app (PC)

Web app (works offline after the first visit). Imports the teams' ZIP files and runs the leaderboard "reveal" show.

## Pages (bottom-left switcher, keys 1 / 2 / 3)

1. **Duomenys (was Page 1) – import:** drag & drop ZIP files anywhere on the window or press **Importuoti failus** (select many). Shows an import report (green = ok, amber = warning, red = rejected file), the list of imported teams (the totals are blurred every time the app opens; **Rodyti skaičius** reveals them), **Eksportuoti CSV**, **Išsaugoti kopiją / Įkelti kopiją** (one JSON file with all teams and corrections – save it before the event as a safety net) and **Išvalyti viską**. Clearing everything or removing one team (✕) can be undone with **Atšaukti** for 7 seconds. The ⚠ badge next to a team opens its import warnings. If a new file's team name only differs in case or diacritics from an existing one, it replaces that team and the report says so. Below the table, **Komandų duomenų taisymas**: every team has a collapsible list (collapsed on open) of the birds that count for it, each with **Pašalinti**, and a field on top to add a bird from the Excel list. Every correction changes the team's count everywhere (Lentelė, Statistika, CSV), has an **Atšaukti** undo, and stays applied when the team's file is imported again.
2. **Lentelė (was Page 2) – leaderboard:** step through the birds with the arrows (keys ← / → / Space, Home / End). Teams that saw the bird get +1 and the cards glide to their new places. The big number at the top right is the number of different species revealed so far. **F** (or the button top-left) toggles full screen (also on the Statistika page).
3. **Statistika (was Page 3):** a plain list of every bird species that at least one team checked (Excel order; no whole families, no teams' own added species). **Eksportuoti** saves two plain `.txt` files: `pastebetos-rusys.txt` (the same list, numbered, one species per line) and `komandu-rusys.txt` (every team in the order of the final standings, each with its birds in Excel order, then its whole families and own added birds; Chrome may ask once to allow multiple downloads); the fullscreen button stays visible in fullscreen.

Step numbers are never shown (the teams must not know how many birds are left). Right before the last bird a teaser stage "Paskutinė rūšis jau čia…" is shown with no team highlighted.

After the last step, one more → opens the **final stage**: the bird selection and the buttons are hidden, only the table and the big counter stay in the same places, and the winners are shown in **gold, silver and bronze** (only the first three teams get a medal). In this stage equal totals are separated by the number of species that only that team found (the most unique species goes first); if that is equal too, the team that exported its file earlier goes first (e.g. 19:30 beats 19:50); teams still equal after that share a place. Places are never skipped after a tie (1, 1, 2, 3). The CSV and `komandu-rusys.txt` exports use the same final order, and the CSV has an extra "Unikalios rūšys" column. During the show (before the final stage) tied teams just share a place and are ordered by name.. ← goes back to the last bird.

Order of the steps: species seen by the most teams first, rarest last; then whole-family ticks ("Šeima"), then the teams' own added species (same name from several teams = one step).

Importing a team again replaces the older file (the newest export time wins). Data stays in this browser (Chrome/Edge) on this PC.

## Publish on GitHub Pages (free) – separate repository

1. github.com → **New repository**, name e.g. `pauksciu-lentele`, **Public**.
2. **uploading an existing file** → drag in everything inside the `organiser_app` folder (files `index.html`, `app.js`, `styles.css`, `zip-reader.js`, `sw.js`, `manifest.webmanifest` and the folders `data`, `fonts`, `icons`). Commit.
3. **Settings → Pages** → Deploy from a branch → `main` / root → Save.
4. The address will be `https://<your-username>.github.io/pauksciu-lentele/`. Open it in Chrome/Edge, then **Install app** from the address bar if you want an app window.

## Updating

Replace the changed files in the repository (upload all files again) and **change the version in `sw.js`** (`const CACHE = 'leaderboard-v1'` → `'leaderboard-v2'`). Open the app with internet, close it fully and open it again.


## Keys and help (added in v38)
`?` (or the **?** button next to the page switcher) opens the key list. Keys are ignored while typing in a field. In the final stage of Lentelė a very faint back arrow appears bottom right (full strength on hover). With more than 10 teams the table is split evenly between columns (15 teams: 8 + 7). Statistika has a heading with the total and **Eksportuoti (2 failai)** saves both text files.
