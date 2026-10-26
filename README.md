# Paukščių lyderių lentelė – organiser app (PC)

Web app (works offline after the first visit). Imports the teams' ZIP files and runs the leaderboard "reveal" show.

## Pages (bottom-left switcher, keys 1 / 2 / 3)

1. **Duomenys (was Page 1) – import:** drag & drop ZIP files anywhere on the window or press **Importuoti failus** (select many). Shows an import report (green = ok, amber = warning, red = rejected file), the list of imported teams (the totals are blurred every time the app opens; **Rodyti skaičius** reveals them), **Eksportuoti CSV** and **Išvalyti viską**.
2. **Lentelė (was Page 2) – leaderboard:** step through the birds with the arrows (keys ← / → / Space, Home / End). Teams that saw the bird get +1 and the cards glide to their new places. The big number at the top right is the number of different species revealed so far. **F** (or the button top-left) toggles full screen (also on the Statistika page).
3. **Statistika (was Page 3):** a plain list of every bird species that at least one team checked (Excel order; no whole families, no teams' own added species). **Eksportuoti** saves the same list as a plain `.txt` file (numbered, one species per line); the fullscreen button stays visible in fullscreen.

Step numbers are never shown (the teams must not know how many birds are left). Right before the last bird a teaser stage "Paskutinė rūšis jau čia…" is shown with no team highlighted.

After the last step, one more → opens the **final stage**: the bird selection and the buttons are hidden, only the table and the big counter stay in the same places, and the winners are shown in **gold, silver and bronze** (teams with equal totals share a medal). ← goes back to the last bird.

Order of the steps: species seen by the most teams first, rarest last; then whole-family ticks ("Šeima"), then the teams' own added species (same name from several teams = one step).

Importing a team again replaces the older file (the newest export time wins). Data stays in this browser (Chrome/Edge) on this PC.

## Publish on GitHub Pages (free) – separate repository

1. github.com → **New repository**, name e.g. `pauksciu-lentele`, **Public**.
2. **uploading an existing file** → drag in everything inside the `organiser_app` folder (files `index.html`, `app.js`, `styles.css`, `zip-reader.js`, `sw.js`, `manifest.webmanifest` and the folders `data`, `fonts`, `icons`). Commit.
3. **Settings → Pages** → Deploy from a branch → `main` / root → Save.
4. The address will be `https://<your-username>.github.io/pauksciu-lentele/`. Open it in Chrome/Edge, then **Install app** from the address bar if you want an app window.

## Updating

Replace the changed files in the repository (upload all files again) and **change the version in `sw.js`** (`const CACHE = 'leaderboard-v1'` → `'leaderboard-v2'`). Open the app with internet, close it fully and open it again.
