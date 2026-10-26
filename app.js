'use strict';

const TEAMS_KEY = 'lb.teams.v1';   // { teamKey: { key, name, exportedAt, importedAt, fileName, species[], families[], custom[], warnings[] } }
const PER_COLUMN = 10;             // teams per column on the leaderboard
const ROW_GAP = 12;
const COL_GAP = 18;
const MAX_CARD_H = 96;

// Page labels are placeholders; rename them here.
const PAGES = [
  { id: 'import', label: 'Duomenys', icon: '<svg viewBox="0 0 24 24"><path d="M12 4v10M8 10l4 4 4-4M5 19h14"/></svg>' },
  { id: 'board', label: 'Lentelė', icon: '<svg viewBox="0 0 24 24"><path d="M6 20v-8M12 20V5M18 20v-10"/></svg>' },
  { id: 'stats', label: 'Statistika', icon: '<svg viewBox="0 0 24 24"><path d="M4 18l5-6 4 3 7-9"/></svg>' },
];

const ICON_FULLSCREEN = '<svg viewBox="0 0 24 24"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>';
const ICON_PREV = '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>';
const ICON_NEXT = '<svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>';

const $ = (id) => document.getElementById(id);
const collator = new Intl.Collator('lt');
const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function el(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

// Lithuanian plural: 1, 21 → one · 2-9, 22-29 → few · 0, 10-20, 30… → many
function plural(n, one, few, many) {
  const last = n % 10;
  if (n % 100 >= 10 && n % 100 <= 20 || last === 0) return many;
  return last === 1 ? one : few;
}

const load = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch (e) { return fallback; }
};
const save = (key, value) => {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* storage unavailable */ }
};

let toastTimer;
function toast(message) {
  const t = $('toast');
  t.textContent = message;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 3000);
}

// ---------------------------------------------------------------- master species list
const master = { species: new Map(), families: new Map(), known: new Set() };

function indexMaster(data) {
  let sIdx = 0;
  let fIdx = 0;
  for (const [prefix, orders] of [['m', data.main], ['x', data.extra]]) {
    for (const o of orders) {
      for (const f of o.families) {
        master.families.set(`${prefix}:${o.name}:${f.name}`, {
          name: f.name, order: o.name, idx: fIdx++, ids: new Set(f.species.map((s) => s.id)), tickable: prefix === 'm',
        });
        for (const sp of f.species) {
          master.species.set(sp.id, { ...sp, idx: sIdx++ });
          master.known.add(norm(sp.lt));
          master.known.add(norm(sp.la));
        }
      }
    }
  }
}

// ---------------------------------------------------------------- teams
let teams = {};
const teamTotal = (t) => t.species.length + t.families.length + t.custom.length;

function sanitizeStored(stored) {
  const out = {};
  for (const [k, t] of Object.entries(stored || {})) {
    if (!t || typeof t.name !== 'string') continue;
    out[k] = {
      key: k, name: t.name, exportedAt: t.exportedAt ?? null, importedAt: t.importedAt ?? 0, fileName: t.fileName || '',
      species: Array.isArray(t.species) ? t.species : [], families: Array.isArray(t.families) ? t.families : [],
      custom: Array.isArray(t.custom) ? t.custom : [], warnings: Array.isArray(t.warnings) ? t.warnings : [],
    };
  }
  return out;
}

// Highest score first; equal scores share a place and are ordered by name (so the order never flickers).
function rank(items) {
  const sorted = [...items].sort((a, b) => b.score - a.score || collator.compare(a.name, b.name));
  let place = 1;
  sorted.forEach((it, i) => {
    if (i > 0 && it.score !== sorted[i - 1].score) place = i + 1;
    it.place = place;
  });
  return sorted;
}

// ---------------------------------------------------------------- import
async function readSubmission(file) {
  let bytes;
  if (/\.json$/i.test(file.name)) {
    bytes = new Uint8Array(await file.arrayBuffer());
  } else {
    const entries = ZipReader.read(await file.arrayBuffer());
    const entry = entries.find((e) => /\.json$/i.test(e.name) && !/(^|\/)__MACOSX\//.test(e.name) && !/(^|\/)\._/.test(e.name));
    if (!entry) throw new Error('ZIP viduje nerastas .json failas');
    bytes = await entry.data();
  }
  const text = new TextDecoder('utf-8').decode(bytes).replace(/^﻿/, '');
  try { return JSON.parse(text); } catch (e) { throw new Error('Sugadintas JSON failas'); }
}

function parseSubmission(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Failo turinys neatitinka formato');
  const warnings = [];
  const name = typeof data.teamName === 'string' ? data.teamName.replace(/\s+/g, ' ').trim().slice(0, 80) : '';
  if (!name) throw new Error('Trūksta komandos pavadinimo');
  if (data.version !== 1) warnings.push('Nežinoma failo versija – skaitoma kaip 1 versija');

  let exportedAt = Date.parse(data.exportedAt);
  if (Number.isNaN(exportedAt)) { exportedAt = null; warnings.push('Trūksta eksportavimo laiko'); }

  if (!Array.isArray(data.species)) warnings.push('Trūksta rūšių sąrašo');
  const species = [];
  const seenIds = new Set();
  let unknownSp = 0;
  let dupSp = 0;
  for (const s of Array.isArray(data.species) ? data.species : []) {
    const id = String(s && typeof s === 'object' ? s.id : s);
    if (!master.species.has(id)) { unknownSp++; continue; }
    if (seenIds.has(id)) { dupSp++; continue; }
    seenIds.add(id);
    species.push(id);
  }
  if (unknownSp) warnings.push(`${unknownSp} nežinomų rūšių numerių ignoruota`);
  if (dupSp) warnings.push(`${dupSp} pasikartojančių rūšių ignoruota`);

  const families = [];
  let unknownFam = 0;
  for (const f of Array.isArray(data.families) ? data.families : []) {
    const key = String(f && typeof f === 'object' ? f.key : f);
    const info = master.families.get(key);
    if (!info || !info.tickable) { unknownFam++; continue; }
    if (!families.includes(key)) families.push(key);
  }
  if (unknownFam) warnings.push(`${unknownFam} nežinomų šeimų ignoruota`);

  // A ticked family excludes its own species: keep the family, drop the species.
  let removed = 0;
  const speciesKept = species.filter((id) => {
    const clash = families.some((k) => master.families.get(k).ids.has(id));
    if (clash) removed++;
    return !clash;
  });
  if (removed) warnings.push(`${removed} rūšių, priklausančių pažymėtoms šeimoms, neįskaityta`);

  const custom = [];
  const seenNames = new Set();
  for (const c of Array.isArray(data.custom) ? data.custom : []) {
    const nm = String(c && typeof c === 'object' ? c.name : c).replace(/\s+/g, ' ').trim().slice(0, 60);
    if (!nm || seenNames.has(norm(nm))) continue;
    seenNames.add(norm(nm));
    if (master.known.has(norm(nm))) warnings.push(`Pridėta rūšis „${nm}“ jau yra sąraše`);
    custom.push({ name: nm });
  }

  return { name, exportedAt, species: speciesKept, families, custom, warnings };
}

async function importFiles(fileList) {
  const files = [...fileList];
  if (!files.length) return;
  const lines = [];
  for (const file of files) {
    try {
      const parsed = parseSubmission(await readSubmission(file));
      const key = norm(parsed.name);
      const existing = teams[key];
      const when = parsed.exportedAt ?? file.lastModified ?? Date.now();
      if (existing && existing.exportedAt && when < existing.exportedAt) {
        lines.push({ level: 'warn', file: file.name, text: `Praleista: ${parsed.name} – jau įkeltas naujesnis failas` });
        continue;
      }
      teams[key] = {
        key, name: parsed.name, exportedAt: when, importedAt: Date.now(), fileName: file.name,
        species: parsed.species, families: parsed.families, custom: parsed.custom, warnings: parsed.warnings,
      };
      lines.push({ level: 'ok', file: file.name, text: `${existing ? 'Atnaujinta' : 'Importuota'}: ${parsed.name}`, value: teamTotal(teams[key]) });
      for (const w of parsed.warnings) lines.push({ level: 'warn', file: file.name, text: w });
    } catch (e) {
      lines.push({ level: 'error', file: file.name, text: e.message || 'Nepavyko perskaityti failo' });
    }
  }
  save(TEAMS_KEY, teams);
  renderTeams();
  rebuildBoard();
  renderReport(lines);
  return lines;
}

// ---------------------------------------------------------------- page 1 rendering
function renderReport(lines) {
  const box = $('report');
  const ok = lines.filter((l) => l.level === 'ok').length;
  const bad = lines.filter((l) => l.level === 'error').length;
  box.replaceChildren(el('h3', '', `Importo ataskaita · ${ok} sėkmingai${bad ? `, ${bad} su klaida` : ''}`));
  for (const l of lines) {
    const row = el('div', 'report-line');
    row.append(el('span', `dot ${l.level === 'ok' ? '' : l.level}`));
    const text = el('span');
    text.append(document.createTextNode(l.text));
    if (l.value !== undefined) {
      text.append(document.createTextNode(' ('), el('span', 'secret', String(l.value)), document.createTextNode(')'));
    }
    if (l.level !== 'ok') text.append(el('span', 'report-file', `  · ${l.file}`));
    row.append(text);
    box.append(row);
  }
  box.hidden = false;
}

function fmtTime(ms) {
  if (!ms) return '–';
  const d = new Date(ms);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function renderTeams() {
  const list = Object.values(teams).sort((a, b) => collator.compare(a.name, b.name));
  $('teamCount').textContent = list.length ? `(${list.length})` : '';
  const wrap = $('teamsWrap');
  if (!list.length) {
    wrap.replaceChildren(el('div', 'empty-teams', 'Dar nėra importuotų komandų'));
    return;
  }
  const table = el('table', 'teams-table');
  const head = el('tr');
  [['Komanda', ''], ['Iš viso', 'num'], ['Rūšys', 'num'], ['Šeimos', 'num'], ['Pridėtos', 'num'], ['Eksportuota', ''], ['Failas', ''], ['', '']]
    .forEach(([t, c]) => head.append(el('th', c, t)));
  const thead = el('thead');
  thead.append(head);
  table.append(thead);
  const body = el('tbody');
  for (const t of list) {
    const tr = el('tr');
    const nameTd = el('td', '', t.name);
    if (t.warnings.length) {
      const badge = el('span', 'warn-badge', `⚠ ${t.warnings.length}`);
      badge.title = t.warnings.join('\n');
      nameTd.append(badge);
    }
    tr.append(nameTd,
      el('td', 'num total-cell secret', String(teamTotal(t))),
      el('td', 'num secret', String(t.species.length)),
      el('td', 'num secret', String(t.families.length)),
      el('td', 'num secret', String(t.custom.length)),
      el('td', '', fmtTime(t.exportedAt)),
      el('td', 'file', t.fileName));
    const rm = el('button', 'rm', '✕');
    rm.type = 'button';
    rm.title = 'Pašalinti komandą';
    rm.addEventListener('click', () => {
      if (!confirm(`Pašalinti komandą „${t.name}“?`)) return;
      delete teams[t.key];
      save(TEAMS_KEY, teams);
      renderTeams();
      rebuildBoard();
    });
    const rmTd = el('td');
    rmTd.append(rm);
    tr.append(rmTd);
    body.append(tr);
  }
  table.append(body);
  wrap.replaceChildren(table);
}

function exportCsv() {
  const ranked = rank(Object.values(teams).map((t) => ({ t, name: t.name, score: teamTotal(t) })));
  if (!ranked.length) { toast('Nėra ką eksportuoti'); return; }
  const esc = (v) => `"${String(v).replace(/"/g, '""')}"`;
  const rows = [['Vieta', 'Komanda', 'Iš viso', 'Rūšys', 'Šeimos', 'Pridėtos', 'Eksportuota']];
  for (const r of ranked) rows.push([r.place, r.t.name, r.score, r.t.species.length, r.t.families.length, r.t.custom.length, fmtTime(r.t.exportedAt)]);
  const csv = '﻿' + rows.map((r) => r.map(esc).join(';')).join('\r\n');
  downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), 'lyderiu-lentele.csv');
}

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

// ---------------------------------------------------------------- page 2: leaderboard reveal
let teamList = [];          // teams sorted by name
let steps = [];             // reveal steps: { type: 'sp'|'fam'|'cus', title, sub, teams:Set }
let pref = new Map();       // teamKey -> Int32Array(steps+1) cumulative scores
let realPref = [0];         // number of real species revealed after k steps
let cur = 0;                // current step (0 = nothing revealed)
const cards = new Map();    // teamKey -> card element
let currentOrder = [];      // teams in their current board order
let cardW = 0;
let cardH = 0;

function addTo(map, key, teamKey) {
  if (!map.has(key)) map.set(key, new Set());
  map.get(key).add(teamKey);
}

function buildSteps() {
  teamList = Object.values(teams).sort((a, b) => collator.compare(a.name, b.name));
  const sp = new Map();
  const fam = new Map();
  const cus = new Map();
  const cusName = new Map();
  for (const t of teamList) {
    t.species.forEach((id) => addTo(sp, id, t.key));
    t.families.forEach((k) => addTo(fam, k, t.key));
    t.custom.forEach((c) => {
      const n = norm(c.name);
      addTo(cus, n, t.key);
      if (!cusName.has(n)) cusName.set(n, c.name);
    });
  }
  const bySize = (a, b) => b.teams.size - a.teams.size;
  const spSteps = [...sp].map(([id, set]) => {
    const info = master.species.get(id);
    return { type: 'sp', title: info.lt, sub: info.la, teams: set, order: info.idx };
  }).sort((a, b) => bySize(a, b) || a.order - b.order);
  const famSteps = [...fam].map(([key, set]) => {
    const info = master.families.get(key);
    return { type: 'fam', title: info.name, sub: '', teams: set, order: info.idx };
  }).sort((a, b) => bySize(a, b) || a.order - b.order);
  const cusSteps = [...cus].map(([n, set]) => ({ type: 'cus', title: cusName.get(n), sub: '', teams: set, order: 0 }))
    .sort((a, b) => bySize(a, b) || collator.compare(a.title, b.title));
  steps = [...spSteps, ...famSteps, ...cusSteps];

  pref = new Map();
  for (const t of teamList) {
    const arr = new Int32Array(steps.length + 1);
    steps.forEach((s, i) => { arr[i + 1] = arr[i] + (s.teams.has(t.key) ? 1 : 0); });
    pref.set(t.key, arr);
  }
  realPref = [0];
  steps.forEach((s, i) => realPref.push(realPref[i] + (s.type === 'sp' ? 1 : 0)));
}

function rebuildBoard() {
  buildSteps();
  renderStats();
  const board = $('board');
  board.replaceChildren();
  cards.clear();
  currentOrder = [];
  for (const t of teamList) {
    const card = el('div', 'card');
    card.append(el('span', 'place'), el('span', 'name', t.name), el('span', 'score', '0'));
    card.title = t.name;
    board.append(card);
    cards.set(t.key, card);
  }
  $('boardEmpty').hidden = teamList.length > 0;
  cur = Math.min(cur, maxStage());
  relayout();
  updateBoard();
  showStep();
}

function relayout() {
  const board = $('board');
  const W = board.clientWidth;
  if (!W) return;                              // page is hidden
  // Height left for the table = page content minus the fixed header; the table always has PER_COLUMN rows
  // so it never changes size while stepping through the birds.
  const pageEl = $('page-board');
  const cs = getComputedStyle(pageEl);
  const content = pageEl.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
  const head = $('page-board').querySelector('.board-top').offsetHeight + $('birdPos').offsetHeight + 20;
  const H = Math.max(200, content - head);
  const cols = Math.max(1, Math.ceil(teamList.length / PER_COLUMN));
  cardW = (W - (cols - 1) * COL_GAP) / cols;
  cardH = Math.min((H - (PER_COLUMN - 1) * ROW_GAP) / PER_COLUMN, MAX_CARD_H);
  board.style.height = `${PER_COLUMN * cardH + (PER_COLUMN - 1) * ROW_GAP}px`;
  board.style.setProperty('--card-h', `${cardH}px`);
  board.classList.add('no-anim');
  for (const card of cards.values()) {
    card.style.width = `${cardW}px`;
    card.style.height = `${cardH}px`;
  }
  placeCards();
  void board.offsetWidth;
  requestAnimationFrame(() => board.classList.remove('no-anim'));
}

function placeCards() {
  currentOrder.forEach((r, i) => {
    const col = Math.floor(i / PER_COLUMN);
    const row = i % PER_COLUMN;
    cards.get(r.key).style.transform = `translate(${col * (cardW + COL_GAP)}px, ${row * (cardH + ROW_GAP)}px)`;
  });
}

// Stages the organiser steps through (cur):
//   0 = start · 1…N-1 = birds · N = "the last bird is coming" teaser (no highlight, standings unchanged)
//   N+1 = the last bird · N+2 = final stage (only the table and the counter, medals for the top 3)
function stageInfo(k) {
  const n = steps.length;
  if (n === 0) return { at: 0, kind: k === 0 ? 'start' : 'final' };
  if (k === 0) return { at: 0, kind: 'start' };
  if (k < n) return { at: k, kind: 'step', step: steps[k - 1] };
  if (k === n) return { at: n - 1, kind: 'teaser' };
  if (k === n + 1) return { at: n, kind: 'step', step: steps[n - 1] };
  return { at: n, kind: 'final' };
}
const maxStage = () => (steps.length ? steps.length + 2 : 1);
const isFinal = () => stageInfo(cur).kind === 'final';

function updateBoard() {
  const info = stageInfo(cur);
  const ranked = rank(teamList.map((t) => ({ key: t.key, name: t.name, score: pref.get(t.key)[info.at] })));
  currentOrder = ranked;
  const anyScore = ranked.length > 0 && ranked[0].score > 0;
  const fin = info.kind === 'final';
  const current = info.kind === 'step' ? info.step : null;   // the bird being shown: its finders stay highlighted
  placeCards();
  for (const r of ranked) {
    const card = cards.get(r.key);
    card.querySelector('.score').textContent = r.score;
    card.querySelector('.place').textContent = anyScore ? `${r.place}.` : '';
    card.classList.toggle('leader', !fin && anyScore && r.place === 1);
    card.classList.toggle('gold', fin && r.score > 0 && r.place === 1);
    card.classList.toggle('silver', fin && r.score > 0 && r.place === 2);
    card.classList.toggle('bronze', fin && r.score > 0 && r.place === 3);
    const found = !!current && current.teams.has(r.key);
    card.classList.remove('gain');
    if (found) {
      void card.offsetWidth;      // restart the little pulse for every new bird
      card.classList.add('gain');
    }
  }
}

let shownTotal = 0;
function showStep() {
  const info = stageInfo(cur);
  document.body.classList.toggle('final-stage', info.kind === 'final');
  const nameEl = $('birdName');
  const latinEl = $('birdLatin');
  nameEl.replaceChildren();
  nameEl.classList.remove('long');
  if (info.kind === 'start') {
    nameEl.textContent = steps.length ? 'Pradžia' : '–';
    latinEl.textContent = steps.length ? 'Spauskite → norėdami atskleisti rūšis' : '';
  } else if (info.kind === 'teaser') {
    nameEl.textContent = 'Paskutinė rūšis jau čia…';
    nameEl.classList.add('long');
    latinEl.textContent = 'Pasiruoškite!';
  } else if (info.kind === 'final') {
    latinEl.textContent = '';
  } else {
    const s = info.step;
    if (s.type === 'fam') nameEl.append(el('span', 'kind fam', 'Šeima'));
    if (s.type === 'cus') nameEl.append(el('span', 'kind cus', 'Pridėta'));
    nameEl.append(document.createTextNode(s.title));
    nameEl.classList.toggle('long', s.title.length > 24);
    latinEl.textContent = s.sub;
  }
  $('birdPos').textContent = '';           // no step numbers: the teams must not know how many birds are left
  $('prevBtn').disabled = cur === 0;
  $('nextBtn').disabled = cur >= maxStage();

  const total = realPref[info.at] ?? 0;
  const totalEl = $('totalNum');
  totalEl.textContent = total;
  $('totalLabel').textContent = plural(total, 'Rūšis', 'Rūšys', 'Rūšių');
  if (total > shownTotal) {
    totalEl.classList.remove('bump');
    void totalEl.offsetWidth;
    totalEl.classList.add('bump');
  }
  shownTotal = total;
}

function goto(k) {
  const target = Math.max(0, Math.min(maxStage(), k));
  if (target === cur) return;
  cur = target;
  updateBoard();
  showStep();
}

// ---------------------------------------------------------------- page 3: statistics
// Every bird species that at least one team ticked, in the order of the Excel list.
// Whole-family ticks and the teams' own added species are not included.
function checkedSpecies() {
  const found = new Set();
  for (const t of Object.values(teams)) t.species.forEach((id) => found.add(id));
  return [...found].map((id) => master.species.get(id)).sort((a, b) => a.idx - b.idx);
}

// Simple text file: one checked species per line (numbered 1, 2, 3 …), in the order of the Excel list.
function exportBirdList() {
  const birds = checkedSpecies();
  if (!birds.length) { toast('Nėra pažymėtų rūšių'); return; }
  const text = '\ufeff' + birds.map((b, i) => `${i + 1}. ${b.lt} (${b.la})`).join('\r\n') + '\r\n';
  downloadBlob(new Blob([text], { type: 'text/plain;charset=utf-8' }), 'pastebetos-rusys.txt');
}

function renderStats() {
  const box = $('stats');
  const birds = checkedSpecies();
  if (!birds.length) {
    box.replaceChildren(el('p', 'stats-empty', Object.keys(teams).length ? 'Nėra pažymėtų rūšių' : 'Importuokite komandų failus (Duomenys)'));
    return;
  }
  const panel = el('section', 'stat-panel wide');
  const cols = el('div', 'stat-cols');
  for (const b of birds) {
    const row = el('div', 'stat-row');
    const bird = el('span', 'stat-bird');
    bird.append(el('span', 'stat-lt', b.lt), el('span', 'stat-la', b.la));
    row.append(bird);
    cols.append(row);
  }
  panel.append(cols);
  box.replaceChildren(panel);
}

// ---------------------------------------------------------------- pages, keys, fullscreen
let page = 'import';

function showPage(id) {
  if (!PAGES.some((p) => p.id === id)) id = 'import';
  page = id;
  for (const p of PAGES) $(`page-${p.id}`).hidden = p.id !== id;
  document.querySelectorAll('.pager button').forEach((b) => b.classList.toggle('active', b.dataset.page === id));
  window.scrollTo(0, 0);
  if (id === 'board') requestAnimationFrame(relayout);
}

function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen().catch(() => toast('Pilno ekrano įjungti nepavyko'));
}

document.addEventListener('fullscreenchange', () => {
  document.body.classList.toggle('fs', !!document.fullscreenElement);
  requestAnimationFrame(relayout);
});
window.addEventListener('resize', () => requestAnimationFrame(relayout));

document.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const idx = ['1', '2', '3'].indexOf(e.key);
  if (idx >= 0) { showPage(PAGES[idx].id); return; }
  if ((e.key === 'f' || e.key === 'F') && (page === 'board' || page === 'stats')) { toggleFullscreen(); return; }
  if (page !== 'board') return;
  if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') { e.preventDefault(); goto(cur + 1); }
  else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); goto(cur - 1); }
  else if (e.key === 'Home') { e.preventDefault(); goto(0); }
  else if (e.key === 'End') { e.preventDefault(); goto(maxStage() - 1); }   // the last bird; → once more opens the final stage
});

// Drag & drop anywhere on the window
let dragDepth = 0;
document.addEventListener('dragenter', (e) => { e.preventDefault(); dragDepth++; document.body.classList.add('dragging'); });
document.addEventListener('dragover', (e) => e.preventDefault());
document.addEventListener('dragleave', () => { dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) document.body.classList.remove('dragging'); });
document.addEventListener('drop', (e) => {
  e.preventDefault();
  dragDepth = 0;
  document.body.classList.remove('dragging');
  if (e.dataTransfer && e.dataTransfer.files.length) {
    showPage('import');
    importFiles(e.dataTransfer.files);
  }
});

// ---------------------------------------------------------------- init
function init(data) {
  indexMaster(data);
  teams = sanitizeStored(load(TEAMS_KEY, {}));

  const pager = $('pager');
  for (const p of PAGES) {
    const b = el('button');
    b.type = 'button';
    b.dataset.page = p.id;
    b.innerHTML = p.icon;
    b.append(document.createTextNode(p.label));
    b.addEventListener('click', () => showPage(p.id));
    pager.append(b);
  }

  $('fsBtn').innerHTML = ICON_FULLSCREEN;
  $('prevBtn').innerHTML = ICON_PREV;
  $('nextBtn').innerHTML = ICON_NEXT;
  $('fsBtn').addEventListener('click', toggleFullscreen);
  $('statsFsBtn').innerHTML = ICON_FULLSCREEN;
  $('statsFsBtn').addEventListener('click', toggleFullscreen);
  $('exportBirdsBtn').addEventListener('click', exportBirdList);
  $('prevBtn').addEventListener('click', () => goto(cur - 1));
  $('nextBtn').addEventListener('click', () => goto(cur + 1));
  $('pickBtn').addEventListener('click', () => $('fileInput').click());
  $('fileInput').addEventListener('change', (e) => { importFiles(e.target.files); e.target.value = ''; });
  $('csvBtn').addEventListener('click', exportCsv);
  // The numbers on this page are blurred every time the app opens, so teams can't read them off the screen.
  document.body.classList.add('numbers-hidden');
  $('blurBtn').addEventListener('click', () => {
    const hidden = document.body.classList.toggle('numbers-hidden');
    $('blurBtn').textContent = hidden ? 'Rodyti skaičius' : 'Slėpti skaičius';
    $('blurBtn').setAttribute('aria-pressed', String(hidden));
  });
  $('clearBtn').addEventListener('click', () => {
    if (!Object.keys(teams).length) return;
    if (!confirm('Išvalyti visas importuotas komandas?')) return;
    teams = {};
    save(TEAMS_KEY, teams);
    renderTeams();
    rebuildBoard();
    $('report').hidden = true;
  });

  renderTeams();
  showPage('import');                 // the app always opens on the Duomenys page
  rebuildBoard();
}

fetch('data/species.json').then((r) => r.json()).then(init);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
}
