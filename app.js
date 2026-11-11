// =====================================================================
//  Wochenendplaner – Hauptlogik
// =====================================================================
import {
  END_DATE, SUGGESTED_NAMES, PERSON_COLORS, FALLBACK_PERSON_COLOR, CATEGORIES,
} from './config.js';
import { initAuth, getCurrentUser, signIn, onAuthChange } from './auth.js';
import {
  fetchActivities, createActivity, updateActivity, deleteActivity,
  fetchPhotos, uploadPhoto, deletePhoto, photoUrl,
  subscribeChanges, isSetupError,
} from './api.js';
import { prepareImage } from './images.js';
import {
  getWeekends, getPastWeekends, thursdayOnOrBefore, makeWeekend, parseISODate, toISODate,
  startOfDay, daysBetween, weekdayLong, weekdayShort, dayMonth, monthYear, weekendRange,
  shortTime, formatTimestamp,
} from './dates.js';

// Wie viele vergangene Wochenenden immer unter "Erinnerungen" stehen
const RECENT_PAST_WEEKENDS = 4;

// ---------------------------------------------------------------------
// Zustand
// ---------------------------------------------------------------------
const state = {
  activities: new Map(), // id -> Zeile
  photos: new Map(), // id -> Zeile
  photosReady: true, // false, wenn Tabelle/Bucket noch fehlen
  uploading: new Map(), // activityId -> Anzahl laufender Uploads
  weekends: [],
  todayISO: '',
  view: 'weekends',
  memMode: 'weekends',
  ideaFilter: null, // Kategorie-Filter in der Ideensammlung
  loaded: false,
};

const $ = (sel) => document.querySelector(sel);
const els = {
  main: $('#main'),
  weekendList: $('#weekendList'),
  ideaList: $('#ideaList'),
  memoryList: $('#memoryList'),
  countdown: $('#countdown'),
  ideaCount: $('#ideaCount'),
  photoCount: $('#photoCount'),
  live: $('#live'),
  banner: $('#banner'),
  userName: $('#userName'),
  userBtn: $('#userBtn'),
  themeBtn: $('#themeBtn'),
  toast: $('#toast'),
  nameDialog: $('#nameDialog'),
  nameForm: $('#nameForm'),
  nameInput: $('#nameInput'),
  nameCancel: $('#nameCancel'),
  nameSuggestions: $('#nameSuggestions'),
  editDialog: $('#editDialog'),
  editForm: $('#editForm'),
  editTitle: $('#editTitle'),
  editContext: $('#editContext'),
  editMeta: $('#editMeta'),
  editPhotosWrap: $('#editPhotosWrap'),
  editPhotos: $('#editPhotos'),
  editExtra: $('#editExtra'),
  editMove: $('#editMove'),
  editToIdeas: $('#editToIdeas'),
  editDelete: $('#editDelete'),
  planDialog: $('#planDialog'),
  planTitle: $('#planTitle'),
  planList: $('#planList'),
  lightbox: $('#lightbox'),
  lbImg: $('#lbImg'),
  lbCounter: $('#lbCounter'),
  lbCaption: $('#lbCaption'),
  lbPrev: $('#lbPrev'),
  lbNext: $('#lbNext'),
  lbSave: $('#lbSave'),
  lbDelete: $('#lbDelete'),
  photoInput: $('#photoInput'),
  ownerWrap: $('#ownerWrap'),
  ownerMeLabel: $('#ownerMeLabel'),
  ownerButtons: [...document.querySelectorAll('[data-owner]')],
  editOverlap: $('#editOverlap'),
  fixedWrap: $('#fixedWrap'),
  challenge: $('#challenge'),
  challengeCount: $('#challengeCount'),
  memStats: $('#memStats'),
  photoCheck: $('#photoCheck'),
  pcText: $('#pcText'),
  pcPhoto: $('#pcPhoto'),
  pcSkip: $('#pcSkip'),
  categoryPicker: $('#categoryPicker'),
};

// ---------------------------------------------------------------------
// Hilfsfunktionen
// ---------------------------------------------------------------------
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

const ICONS = {
  plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  clock: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  pin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>',
  camera: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="6" width="18" height="14" rx="3"/><circle cx="12" cy="13" r="3.5"/><path d="M8.5 6l1.5-2h4l1.5 2"/></svg>',
  download: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>',
  sun: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  moon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/></svg>',
  warn: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l9.5 17h-19z"/><path d="M12 10v4M12 17.5v.01"/></svg>',
  auto: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor"/></svg>',
};

let toastTimer;
function toast(msg, isError = false, ms) {
  els.toast.textContent = msg;
  els.toast.classList.toggle('error', isError);
  els.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => els.toast.classList.remove('show'), ms ?? (isError ? 4500 : 2200));
}

function showError(err, fallback = 'Das hat leider nicht geklappt.') {
  console.error(err);
  if (err?.code === 'PGRST204' || /column .* (does not exist|of '.*' in the schema cache)/i.test(err?.message || '')) showSetupBanner('update');
  else if (isSetupError(err)) showSetupBanner();
  else if (!navigator.onLine) toast('Keine Internetverbindung.', true);
  else toast(fallback, true);
}

function showSetupBanner(kind = 'db') {
  els.banner.innerHTML = kind === 'update'
    ? '<b>Neue Funktionen noch nicht eingerichtet</b>Bitte die aktuelle Datei <code>supabase/schema.sql</code> noch einmal im SQL-Editor von Supabase ausführen (siehe README) und die Seite neu laden. Eure Einträge bleiben dabei erhalten.'
    : kind === 'photos'
    ? '<b>Fotos sind noch nicht eingerichtet</b>Bitte die aktuelle Datei <code>supabase/schema.sql</code> noch einmal im SQL-Editor von Supabase ausführen (siehe README) und die Seite neu laden. Eure Einträge bleiben dabei erhalten.'
    : '<b>Datenbank noch nicht eingerichtet</b>Bitte die Datei <code>supabase/schema.sql</code> im SQL-Editor von Supabase ausführen (siehe Anleitung in der README) und die Seite neu laden.';
  els.banner.hidden = false;
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/** Sortierung innerhalb eines Tages: ohne Uhrzeit zuerst, dann nach Uhrzeit. */
function byTimeThenCreated(a, b) {
  const ta = a.start_time || '';
  const tb = b.start_time || '';
  if (ta !== tb) return ta < tb ? -1 : 1;
  return String(a.created_at).localeCompare(String(b.created_at));
}

const byCreated = (a, b) => String(a.created_at).localeCompare(String(b.created_at));

function activitiesForDay(iso) {
  return [...state.activities.values()].filter((a) => a.day === iso).sort(byTimeThenCreated);
}

function ideas() {
  return [...state.activities.values()]
    .filter((a) => !a.day)
    .sort((a, b) => byCreated(b, a));
}

function photosFor(activityId) {
  return [...state.photos.values()].filter((p) => p.activity_id === activityId).sort(byCreated);
}

/** Alle Fotos für die Galerie: neueste Tage zuerst, innerhalb eines Tages chronologisch. */
function galleryPhotos() {
  return [...state.photos.values()]
    .filter((p) => state.activities.has(p.activity_id))
    .sort((a, b) => {
      const da = state.activities.get(a.activity_id).day || '';
      const db = state.activities.get(b.activity_id).day || '';
      if (da !== db) return da < db ? 1 : -1;
      return byCreated(a, b);
    });
}

// ---------- Kategorien ----------
const CATEGORY_BY_KEY = new Map(CATEGORIES.map((c) => [c.key, c]));
const categoryOf = (a) => (a?.category ? CATEGORY_BY_KEY.get(a.category) : null);

/** Titel mit vorangestelltem Kategorie-Emoji (HTML). */
function titleHTML(a) {
  const c = categoryOf(a);
  return c ? `<span class="cat-emoji" role="img" aria-label="${esc(c.label)}">${c.emoji}</span> ${esc(a.title)}` : esc(a.title);
}

// ---------- Personen & Farben ----------
const me = () => getCurrentUser()?.name || 'Unbekannt';

function personColor(name) {
  return PERSON_COLORS[name] || FALLBACK_PERSON_COLOR;
}

/** Inline-Style mit den Farben einer Person (hell/dunkel), für CSS-Variablen. */
function personStyle(name) {
  const c = personColor(name);
  return `--pc-l:${c.light};--pc-d:${c.dark}`;
}

// ---------- Uhrzeiten & Überschneidungen ----------
const toMin = (t) => { const [h, m] = String(t).split(':').map(Number); return h * 60 + m; };

function timeLabel(a) {
  if (a.start_time && a.end_time) return `${shortTime(a.start_time)}–${shortTime(a.end_time)} Uhr`;
  if (a.start_time) return `${shortTime(a.start_time)} Uhr`;
  if (a.end_time) return `bis ${shortTime(a.end_time)} Uhr`;
  return '';
}

/** Zeitraum in Minuten; ohne Ende wird 1 Stunde angenommen. */
function span(a) {
  if (!a.start_time) return null;
  const s = toMin(a.start_time);
  let e = a.end_time ? toMin(a.end_time) : s + 60;
  if (e <= s) e = s + 60;
  return [s, e];
}

/** Stören sich zwei Termine? Persönliche Termine verschiedener Personen nicht. */
function clashes(a, b) {
  if (a.owner && b.owner && a.owner !== b.owner) return false;
  const x = span(a);
  const y = span(b);
  return Boolean(x && y && x[0] < y[1] && y[0] < x[1]);
}

function conflictsFor(a) {
  if (!a.day) return [];
  return activitiesForDay(a.day).filter((b) => b.id !== a.id && clashes(a, b));
}

// ---------- Foto-Challenge ----------
/** Gemeinsamer Termin, der noch auf ein Foto wartet. */
function needsPhoto(a) {
  return Boolean(state.photosReady && !a.owner && a.day && !a.photo_skipped && photosFor(a.id).length === 0);
}

/** Vergangene gemeinsame Termine ohne Foto (neueste zuerst). */
function pendingPhotos() {
  return [...state.activities.values()]
    .filter((a) => needsPhoto(a) && a.day < state.todayISO)
    .sort((x, y) => (x.day < y.day ? 1 : x.day > y.day ? -1 : 0));
}

/** Serie: Wochenenden in Folge (mit gemeinsamen Terminen), an denen es Fotos gibt. */
function photoStreak() {
  const currentKey = state.weekends[0]?.key ?? state.todayISO;
  const byWeekend = new Map();
  for (const a of state.activities.values()) {
    if (!a.day) continue;
    const key = toISODate(thursdayOnOrBefore(parseISODate(a.day)));
    const e = byWeekend.get(key) || { shared: false, photos: 0 };
    e.shared ||= !a.owner;
    e.photos += photosFor(a.id).length;
    byWeekend.set(key, e);
  }
  let streak = 0;
  for (const key of [...byWeekend.keys()].sort().reverse()) {
    if (key > currentKey) continue; // Zukunft zählt nicht
    const e = byWeekend.get(key);
    if (key === currentKey) { if (e.photos) streak++; continue; } // laufendes Wochenende: nur Bonus
    if (!e.shared && !e.photos) continue;
    if (e.photos) streak++;
    else break;
  }
  return streak;
}

function dayLabel(iso) {
  const d = parseISODate(iso);
  return `${weekdayLong(d)}, ${dayMonth(d)}`;
}

function slug(s) {
  return String(s).toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'foto';
}

function photoFileName(p) {
  const a = state.activities.get(p.activity_id);
  const index = photosFor(p.activity_id).findIndex((x) => x.id === p.id) + 1;
  return `${a?.day || 'idee'}-${slug(a?.title || 'foto')}-${index || 1}.jpg`;
}

// ---------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------
function thumbHTML(p, ctx) {
  return `<button class="thumb" type="button" data-action="photo" data-photo="${p.id}" data-ctx="${ctx}" aria-label="Foto ansehen">
    <img src="${esc(photoUrl(p.thumb_path))}" alt="" loading="lazy" decoding="async"></button>`;
}

function uploadingHTML(activityId) {
  const n = state.uploading.get(activityId) || 0;
  return Array.from({ length: n }, () => '<span class="thumb uploading" aria-label="Foto wird hochgeladen"></span>').join('');
}

/** Fotoreihe unter einer Aktivität. Im Erinnerungs-Modus mit "+"-Kachel. */
function itemPhotosHTML(a, { memory }) {
  const photos = photosFor(a.id);
  const uploading = state.uploading.get(a.id) || 0;
  if (!memory && !photos.length && !uploading) return '';
  const max = memory ? photos.length : 4;
  const shown = photos.slice(0, max).map((p) => thumbHTML(p, `activity:${a.id}`)).join('');
  const more = photos.length > max
    ? `<button class="thumb more" type="button" data-action="photo" data-photo="${photos[max].id}" data-ctx="activity:${a.id}" aria-label="Weitere Fotos">+${photos.length - max}</button>`
    : '';
  const add = memory && state.photosReady
    ? `<button class="thumb add" type="button" data-action="add-photo" data-id="${a.id}" aria-label="Foto zu ${esc(a.title)} hinzufügen">${ICONS.camera}</button>`
    : '';
  const skip = memory && needsPhoto(a) && a.day < state.todayISO && !uploading
    ? `<button class="skip-link" type="button" data-action="skip-photo" data-id="${a.id}">Ohne Foto abschließen</button>`
    : '';
  return `<div class="item-photos">${shown}${more}${uploadingHTML(a.id)}${add}${skip}</div>`;
}

function itemHTML(a, { idea = false, memory = false } = {}) {
  const personal = Boolean(a.owner) && !idea;
  const meta = [];
  const time = timeLabel(a);
  if (time) meta.push(`<span>${ICONS.clock}${esc(time)}</span>`);
  if (a.location) meta.push(`<span>${ICONS.pin}${esc(a.location)}</span>`);

  const chips = [];
  if (personal) chips.push(`<span class="chip-person"><i class="person-dot"></i>${esc(a.owner)}</span>`);
  if (a.is_fixed) chips.push('<span class="chip-tag fixed">📌 Fix</span>');
  if (!idea && needsPhoto(a)) {
    if (a.day === state.todayISO && !a.done) chips.push('<span class="chip-tag photo">📸 Foto nicht vergessen!</span>');
    else if (a.day < state.todayISO) chips.push('<span class="chip-tag photo">📸 Foto fehlt</span>');
  }
  const conflicts = idea ? [] : conflictsFor(a);
  const conflictLine = conflicts.length
    ? `<div class="item-conflict">${ICONS.warn}Zeitgleich mit ${conflicts.map((b) => `„${esc(b.title)}“${b.owner ? ` (${esc(b.owner)})` : ''}`).join(', ')}</div>`
    : '';

  // Persönliche Termine sind Info für den anderen – ohne Abhaken
  const check = idea || personal ? '' : `
    <button class="check" type="button" data-action="toggle" data-id="${a.id}"
      role="checkbox" aria-checked="${a.done ? 'true' : 'false'}"
      aria-label="${esc(a.title)} ${a.done ? 'als offen markieren' : 'abhaken'}">
      <span>${ICONS.check}</span>
    </button>`;
  const plan = idea
    ? `<button class="plan-btn" type="button" data-action="plan" data-id="${a.id}">Einplanen</button>`
    : '';
  const classes = ['item'];
  if (a.done && !idea && !personal) classes.push('done');
  if (check) classes.push('has-check');
  if (personal) classes.push('personal');
  if (a.is_fixed) classes.push('fixed');
  return `
    <li class="${classes.join(' ')}"${personal ? ` style="${personStyle(a.owner)}"` : ''}>
      ${check}
      <button class="item-body" type="button" data-action="edit" data-id="${a.id}" aria-label="${esc(a.title)} bearbeiten">
        ${chips.length ? `<div class="item-chips">${chips.join('')}</div>` : ''}
        <div class="item-title">${titleHTML(a)}</div>
        ${meta.length ? `<div class="item-meta">${meta.join('')}</div>` : ''}
        ${conflictLine}
        ${a.note ? `<div class="item-note">${esc(a.note)}</div>` : ''}
        <div class="item-by">eingetragen von ${esc(a.created_by || 'Unbekannt')}</div>
      </button>
      ${plan}
      ${idea ? '' : itemPhotosHTML(a, { memory })}
    </li>`;
}

function renderCountdown() {
  const w = state.weekends[0];
  if (!w) { els.countdown.textContent = ''; return; }
  const n = daysBetween(new Date(), w.first);
  let text = n <= 0 ? 'Es ist Wochenende! 🎉'
    : n === 1 ? 'Morgen geht’s los'
      : `Noch ${n} Tage bis zum Wochenende`;
  const planned = w.days.reduce((sum, d) => sum + activitiesForDay(d.iso).length, 0);
  if (planned) text += ` · ${plural(planned, 'Plan', 'Pläne')}`;
  const sharedToday = activitiesForDay(state.todayISO).some((a) => !a.owner);
  if (n <= 0 && sharedToday && state.photosReady) text += ' · Fotos nicht vergessen 📸';
  els.countdown.textContent = text;
}

function renderChallenge() {
  const pending = pendingPhotos();
  els.challengeCount.textContent = pending.length;
  els.challengeCount.hidden = pending.length === 0;
  if (!pending.length) { els.challenge.innerHTML = ''; return; }
  const shown = pending.slice(0, 3);
  els.challenge.innerHTML = `
    <section class="challenge" aria-label="Foto-Challenge">
      <div class="challenge-head">
        <span class="challenge-emoji" aria-hidden="true">📸</span>
        <div>
          <h3>Foto-Challenge</h3>
          <p>${pending.length === 1 ? 'Ein Erlebnis wartet' : `${pending.length} Erlebnisse warten`} noch auf ein Foto</p>
        </div>
      </div>
      <ul class="challenge-list">
        ${shown.map((a) => `
          <li>
            <div class="challenge-text"><b>${titleHTML(a)}</b><small>${esc(dayLabel(a.day))}</small></div>
            ${(state.uploading.get(a.id) || 0) ? '<span class="thumb uploading small" aria-label="Wird hochgeladen"></span>' : `
            <button class="challenge-photo" type="button" data-action="add-photo" data-id="${a.id}" aria-label="Foto zu ${esc(a.title)} hinzufügen">${ICONS.camera}Foto</button>
            <button class="challenge-skip" type="button" data-action="skip-photo" data-id="${a.id}" aria-label="${esc(a.title)} ohne Foto abschließen">Ohne</button>`}
          </li>`).join('')}
      </ul>
      ${pending.length > shown.length ? `<button class="challenge-more" type="button" data-action="go-memories">Alle ${pending.length} anzeigen</button>` : ''}
    </section>`;
}

function renderMemStats() {
  if (!state.photosReady) { els.memStats.innerHTML = ''; return; }
  const streak = photoStreak();
  const total = galleryPhotos().length;
  const pending = pendingPhotos().length;
  const chips = [
    streak
      ? `<span class="stat hot">🔥 ${streak === 1 ? '1 Wochenende' : `${streak} Wochenenden`} in Folge mit Fotos</span>`
      : '<span class="stat">🔥 Startet eure Foto-Serie!</span>',
    `<span class="stat">📷 ${plural(total, 'Foto', 'Fotos')}</span>`,
  ];
  if (pending) chips.push(`<span class="stat warn">⏳ ${pending} ohne Foto</span>`);
  // Häufigste Kategorie bisher erlebter Termine
  const counts = new Map();
  for (const a of state.activities.values()) {
    if (a.day && a.day <= state.todayISO && categoryOf(a)) counts.set(a.category, (counts.get(a.category) || 0) + 1);
  }
  const top = [...counts].sort((x, y) => y[1] - x[1])[0];
  if (top) {
    const c = CATEGORY_BY_KEY.get(top[0]);
    chips.push(`<span class="stat">Am häufigsten: ${c.emoji} ${esc(c.label)} (${top[1]}×)</span>`);
  }
  els.memStats.innerHTML = chips.join('');
}

function renderWeekends() {
  if (!state.weekends.length) {
    els.weekendList.innerHTML = `<p class="empty">Bis zum ${esc(dayMonth(parseISODate(END_DATE)))}${parseISODate(END_DATE).getFullYear()} gibt es keine Wochenenden mehr.<br>Das Enddatum lässt sich in <code>config.js</code> ändern.</p>`;
    return;
  }
  const months = new Map();
  for (const w of state.weekends) {
    if (!months.has(w.monthKey)) months.set(w.monthKey, []);
    months.get(w.monthKey).push(w);
  }
  let html = '';
  let first = true;
  for (const [monthKey, list] of months) {
    html += `<section class="month"><h2 class="month-title">${esc(monthYear(parseISODate(`${monthKey}-01`)))}</h2>`;
    for (const w of list) {
      const isCurrent = first;
      first = false;
      const total = w.days.reduce((n, d) => n + activitiesForDay(d.iso).length, 0);
      const badge = isCurrent
        ? '<span class="badge">Dieses Wochenende</span>'
        : (total ? `<span class="badge soft">${total} geplant</span>` : '');
      html += `
        <article class="weekend${isCurrent ? ' current' : ''}" id="we-${w.key}">
          <header class="weekend-head">
            <h3>${esc(weekendRange(w.first, w.last))}</h3>
            ${badge}
          </header>
          ${w.days.map((d) => dayHTML(d)).join('')}
        </article>`;
    }
    html += '</section>';
  }
  els.weekendList.innerHTML = html;
}

function dayHTML(d) {
  const items = activitiesForDay(d.iso);
  const isToday = d.iso === state.todayISO;
  return `
    <div class="day">
      <div class="day-head">
        <div class="day-name">${esc(weekdayLong(d.date))} <small>${esc(dayMonth(d.date))}</small>
          ${isToday ? '<span class="badge soft">Heute</span>' : ''}</div>
        <button class="add-btn" type="button" data-action="add" data-day="${d.iso}"
          aria-label="Aktivität am ${esc(dayLabel(d.iso))} hinzufügen">${ICONS.plus}Neu</button>
      </div>
      ${items.length
        ? `<ul class="items">${items.map((a) => itemHTML(a)).join('')}</ul>`
        : (state.loaded ? '<p class="nothing">Noch nichts geplant</p>' : '')}
    </div>`;
}

function renderIdeas() {
  const all = ideas();
  els.ideaCount.textContent = all.length;
  els.ideaCount.hidden = all.length === 0;
  // Filter nur mit Kategorien anbieten, die bei Ideen vorkommen
  const counts = new Map();
  for (const a of all) if (categoryOf(a)) counts.set(a.category, (counts.get(a.category) || 0) + 1);
  if (state.ideaFilter && !counts.has(state.ideaFilter)) state.ideaFilter = null;
  const list = state.ideaFilter ? all.filter((a) => a.category === state.ideaFilter) : all;
  const filter = counts.size
    ? `<div class="filter-row" role="group" aria-label="Nach Kategorie filtern">
        <button type="button" class="filter-chip" data-action="idea-filter" data-cat="" aria-pressed="${!state.ideaFilter}">Alle <small>${all.length}</small></button>
        ${CATEGORIES.filter((c) => counts.has(c.key)).map((c) => `
          <button type="button" class="filter-chip" data-action="idea-filter" data-cat="${c.key}" aria-pressed="${state.ideaFilter === c.key}">${c.emoji} ${esc(c.label)} <small>${counts.get(c.key)}</small></button>`).join('')}
      </div>`
    : '';
  els.ideaList.innerHTML = `
    <div class="ideas">
      <button class="big-add" type="button" data-action="add-idea">${ICONS.plus}Idee hinzufügen</button>
      ${filter}
      ${list.length
        ? `<ul class="items">${list.map((a) => itemHTML(a, { idea: true })).join('')}</ul>`
        : `<p class="empty">${state.loaded ? 'Noch keine Ideen. Wie wär’s mit „Therme besuchen“ oder „Weihnachtsmarkt“?' : 'Lade Ideen …'}</p>`}
    </div>`;
}

function renderMemories() {
  const photos = galleryPhotos();
  els.photoCount.textContent = photos.length;
  els.photoCount.hidden = photos.length === 0;
  document.querySelectorAll('[data-mem]').forEach((b) => {
    b.setAttribute('aria-selected', String(b.dataset.mem === state.memMode));
  });
  els.memoryList.innerHTML = state.memMode === 'photos' ? galleryHTML(photos) : pastWeekendsHTML();
}

function pastWeekendsHTML() {
  const days = [...state.activities.values()].map((a) => a.day).filter(Boolean);
  const past = getPastWeekends(new Date(), RECENT_PAST_WEEKENDS, days);
  if (!past.length) return '<p class="empty">Noch keine vergangenen Wochenenden.</p>';
  const hint = state.photosReady ? '' : '<p class="nothing">Fotos sind noch nicht eingerichtet (siehe README).</p>';
  return hint + past.map((w, i) => {
    const groups = w.days.map((d) => ({ d, items: activitiesForDay(d.iso) })).filter((g) => g.items.length);
    const photoTotal = groups.reduce((n, g) => n + g.items.reduce((m, a) => m + photosFor(a.id).length, 0), 0);
    const badge = i === 0 && daysBetween(w.last, new Date()) <= 7
      ? '<span class="badge soft">Letztes Wochenende</span>'
      : (photoTotal ? `<span class="badge soft">${plural(photoTotal, 'Foto', 'Fotos')}</span>` : '');
    return `
      <article class="weekend past">
        <header class="weekend-head">
          <h3>${esc(weekendRange(w.first, w.last))}</h3>
          ${badge}
        </header>
        <div class="past-body">
          ${groups.length
            ? groups.map((g) => `
                <p class="day-label">${esc(dayLabel(g.d.iso))}</p>
                <ul class="items">${g.items.map((a) => itemHTML(a, { memory: true })).join('')}</ul>`).join('')
            : '<p class="past-empty">Nichts eingetragen.</p>'}
        </div>
        <div class="catchup">
          <span>Nachtragen:</span>
          ${w.days.map((d) => `<button type="button" data-action="add" data-day="${d.iso}" aria-label="Aktivität am ${esc(dayLabel(d.iso))} nachtragen">${esc(weekdayShort(d.date))}</button>`).join('')}
        </div>
      </article>`;
  }).join('');
}

function galleryHTML(photos) {
  if (!state.photosReady) {
    return '<p class="empty">Fotos sind noch nicht eingerichtet.<br>Bitte <code>supabase/schema.sql</code> noch einmal in Supabase ausführen (siehe README).</p>';
  }
  if (!photos.length) {
    return '<p class="empty">Noch keine Fotos.<br>Öffne eine Aktivität oder ein vergangenes Wochenende und tippe auf das Kamera-Symbol.</p>';
  }
  const groups = new Map();
  for (const p of photos) {
    const day = state.activities.get(p.activity_id).day;
    const key = day ? toISODate(thursdayOnOrBefore(parseISODate(day))) : 'ohne-datum';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(p);
  }
  let html = `<div class="gallery-actions">
    <button class="add-photo-btn" type="button" data-action="download-all">${ICONS.download}Alle herunterladen (${photos.length})</button>
  </div>`;
  for (const [key, list] of groups) {
    const title = key === 'ohne-datum' ? 'Ohne Datum' : (() => {
      const w = makeWeekend(parseISODate(key));
      return `${weekendRange(w.first, w.last)} ${w.last.getFullYear()}`;
    })();
    html += `<section class="gallery-group"><h3>${esc(title)}</h3>
      <div class="gallery">${list.map((p) => thumbHTML(p, 'all')).join('')}</div></section>`;
  }
  return html;
}

let renderQueued = false;
function render() {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => {
    renderQueued = false;
    renderCountdown();
    renderChallenge();
    renderWeekends();
    renderIdeas();
    renderMemories();
    renderMemStats();
    if (els.editDialog.open) { renderEditorPhotos(); updateOverlapHint(); }
    if (els.lightbox.open) refreshLightbox();
  });
}

function setView(view) {
  state.view = view;
  els.main.querySelectorAll('.view').forEach((v) => { v.hidden = v.id !== `view-${view}`; });
  document.querySelectorAll('.tab').forEach((t) => {
    if (t.dataset.view === view) t.setAttribute('aria-current', 'page');
    else t.removeAttribute('aria-current');
  });
  window.scrollTo({ top: 0 });
}

// ---------------------------------------------------------------------
// Daten laden & live halten
// ---------------------------------------------------------------------
function computeWeekends() {
  const today = startOfDay(new Date());
  state.todayISO = toISODate(today);
  state.weekends = getWeekends(today, END_DATE);
}

async function loadAll() {
  computeWeekends();
  const [acts, photos] = await Promise.allSettled([fetchActivities(), fetchPhotos()]);
  if (acts.status === 'fulfilled') {
    state.activities = new Map(acts.value.map((r) => [r.id, r]));
    els.banner.hidden = true;
  } else {
    showError(acts.reason, 'Daten konnten nicht geladen werden.');
  }
  if (photos.status === 'fulfilled') {
    state.photos = new Map(photos.value.map((r) => [r.id, r]));
    state.photosReady = true;
  } else {
    console.warn('Fotos nicht verfügbar', photos.reason);
    state.photosReady = !isSetupError(photos.reason);
  }
  state.loaded = true;
  render();
}

function startRealtime() {
  subscribeChanges(
    ({ table, type, row, oldId }) => {
      const map = table === 'photos' ? state.photos : state.activities;
      if (type === 'DELETE') map.delete(oldId);
      else if (row) map.set(row.id, row);
      render();
    },
    (status) => {
      const on = status === 'SUBSCRIBED';
      els.live.classList.toggle('on', on);
      els.live.title = on ? 'Live: Änderungen erscheinen sofort' : 'Live-Verbindung getrennt';
      els.live.querySelector('.sr-only').textContent = on ? 'Live verbunden' : 'Nicht live verbunden';
      // Nach einem Wiederverbinden verpasste Änderungen nachladen
      if (on && state.loaded) loadAll();
    },
  );
}

// ---------------------------------------------------------------------
// Name (später: Login)
// ---------------------------------------------------------------------
function renderUser(user) {
  els.userName.textContent = user?.name || '…';
  els.userBtn.setAttribute('style', user ? personStyle(user.name) : '');
  els.userBtn.classList.toggle('has-person', Boolean(user));
}

function openNameDialog({ cancellable }) {
  els.nameSuggestions.innerHTML = SUGGESTED_NAMES
    .map((n) => `<button class="btn person-btn" type="button" data-name="${esc(n)}" style="${personStyle(n)}"><i class="person-dot"></i>Ich bin ${esc(n)}</button>`)
    .join('');
  const current = getCurrentUser()?.name || '';
  els.nameInput.value = SUGGESTED_NAMES.includes(current) ? '' : current;
  els.nameCancel.hidden = !cancellable;
  els.nameDialog.dataset.cancellable = cancellable ? '1' : '';
  els.nameDialog.showModal();
}

async function chooseName(name) {
  try {
    await signIn({ name });
    els.nameDialog.close();
    toast(`Hallo ${getCurrentUser().name}!`);
  } catch (err) {
    toast(err.message, true);
    els.nameInput.focus();
  }
}

els.nameSuggestions.addEventListener('click', (e) => {
  const b = e.target.closest('[data-name]');
  if (b) chooseName(b.dataset.name);
});
els.nameForm.addEventListener('submit', (e) => {
  e.preventDefault();
  chooseName(els.nameInput.value);
});
els.nameCancel.addEventListener('click', () => els.nameDialog.close());
els.nameDialog.addEventListener('cancel', (e) => {
  if (!els.nameDialog.dataset.cancellable) e.preventDefault();
});
els.userBtn.addEventListener('click', () => openNameDialog({ cancellable: true }));
onAuthChange(renderUser);

// ---------------------------------------------------------------------
// Bearbeiten-Dialog
// ---------------------------------------------------------------------
let editing = null; // { id?, day, personal, ownerName }
let deleteArmed = false;
let deleteTimer;

function resetDeleteButton() {
  deleteArmed = false;
  clearTimeout(deleteTimer);
  els.editDelete.textContent = 'Löschen';
  els.editDelete.classList.remove('confirm');
}

function renderEditorPhotos() {
  const show = Boolean(editing?.id && editing.day);
  els.editPhotosWrap.hidden = !show;
  if (!show) return;
  if (!state.photosReady) {
    els.editPhotos.innerHTML = '<p class="nothing">Fotos sind noch nicht eingerichtet (siehe README).</p>';
    return;
  }
  els.editPhotos.innerHTML =
    photosFor(editing.id).map((p) => thumbHTML(p, `activity:${editing.id}`)).join('') +
    uploadingHTML(editing.id) +
    `<button class="thumb add" type="button" data-action="add-photo" data-id="${editing.id}" aria-label="Fotos hinzufügen">${ICONS.camera}</button>`;
}

function openEditor({ id = null, day = null }) {
  const a = id ? state.activities.get(id) : null;
  if (id && !a) { toast('Dieser Eintrag existiert nicht mehr.', true); return; }
  editing = { id, day: a ? a.day : day, personal: Boolean(a?.owner), ownerName: a?.owner || me() };
  const isIdea = !editing.day;
  const f = els.editForm.elements;
  f.title.value = a?.title || '';
  f.start_time.value = a?.start_time ? shortTime(a.start_time) : '';
  f.end_time.value = a?.end_time ? shortTime(a.end_time) : '';
  f.is_fixed.checked = Boolean(a?.is_fixed);
  editing.category = a?.category || null;
  renderCategoryPicker();
  els.ownerWrap.hidden = isIdea;
  els.fixedWrap.hidden = isIdea;
  renderOwnerToggle();
  f.location.value = a?.location || '';
  f.note.value = a?.note || '';
  f.title.closest('.field').classList.remove('invalid');

  els.editTitle.textContent = a
    ? (isIdea ? 'Idee bearbeiten' : 'Aktivität bearbeiten')
    : (isIdea ? 'Neue Idee' : 'Neue Aktivität');
  els.editContext.textContent = isIdea ? 'Ideensammlung' : dayLabel(editing.day);
  els.editMeta.textContent = a
    ? `Eingetragen von ${a.created_by || 'Unbekannt'} · ${formatTimestamp(a.created_at)}`
    : (isIdea ? '' : 'Fotos kannst du nach dem Speichern hinzufügen.');
  els.editExtra.hidden = !a;
  els.editMove.textContent = isIdea ? 'Einem Tag zuordnen' : 'Auf anderen Tag verschieben';
  els.editToIdeas.hidden = isIdea;
  resetDeleteButton();
  renderEditorPhotos();
  updateOverlapHint();
  els.editDialog.showModal();
  if (!a) setTimeout(() => f.title.focus(), 50);
}

function readEditor() {
  const f = els.editForm.elements;
  const clean = (v) => { const t = v.trim(); return t ? t : null; };
  const fields = {
    title: f.title.value.trim(),
    start_time: f.start_time.value || null,
    location: clean(f.location.value),
    note: clean(f.note.value),
  };
  // Neue Felder nur mitschicken, wenn sie gebraucht werden bzw. schon existieren –
  // so funktioniert die App auch, bevor das Update-SQL ausgeführt wurde.
  const existing = editing?.id ? state.activities.get(editing.id) : null;
  const extra = {
    owner: editing?.day && editing.personal ? editing.ownerName : null,
    is_fixed: Boolean(editing?.day && f.is_fixed.checked),
    end_time: f.end_time.value || null,
    category: editing?.category || null,
  };
  for (const [k, v] of Object.entries(extra)) {
    if (v || (existing && k in existing)) fields[k] = v;
  }
  return fields;
}

function renderCategoryPicker() {
  els.categoryPicker.innerHTML = CATEGORIES.map((c) => `
    <button type="button" class="cat-option" role="radio" data-cat="${c.key}"
      aria-checked="${editing?.category === c.key}"><span class="cat-emoji" aria-hidden="true">${c.emoji}</span>${esc(c.label)}</button>`).join('');
}

els.categoryPicker.addEventListener('click', (e) => {
  const b = e.target.closest('[data-cat]');
  if (!b || !editing) return;
  // Nochmal tippen = Kategorie entfernen
  editing.category = editing.category === b.dataset.cat ? null : b.dataset.cat;
  els.categoryPicker.querySelectorAll('[data-cat]').forEach((x) => {
    x.setAttribute('aria-checked', String(x.dataset.cat === editing.category));
  });
});

function renderOwnerToggle() {
  const label = editing.ownerName === me() ? 'Nur ich' : `Nur ${editing.ownerName}`;
  els.ownerMeLabel.textContent = label;
  els.ownerWrap.setAttribute('style', personStyle(editing.ownerName));
  els.ownerButtons.forEach((b) => {
    const on = (b.dataset.owner === 'me') === editing.personal;
    b.setAttribute('aria-checked', String(on));
  });
}

els.ownerButtons.forEach((b) => b.addEventListener('click', () => {
  if (!editing) return;
  editing.personal = b.dataset.owner === 'me';
  if (editing.personal && !state.activities.get(editing.id)?.owner) editing.ownerName = me();
  renderOwnerToggle();
  updateOverlapHint();
}));

/** Live-Hinweis im Dialog, wenn sich der Termin mit einem anderen überschneidet. */
function updateOverlapHint() {
  if (!editing?.day) { els.editOverlap.hidden = true; return; }
  const f = els.editForm.elements;
  const draft = {
    id: editing.id,
    day: editing.day,
    owner: editing.personal ? editing.ownerName : null,
    start_time: f.start_time.value || null,
    end_time: f.end_time.value || null,
  };
  const list = conflictsFor(draft);
  els.editOverlap.hidden = list.length === 0;
  els.editOverlap.innerHTML = list.length
    ? `${ICONS.warn}<span>Überschneidet sich mit ${list.map((b) => `„${esc(b.title)}“ (${esc(timeLabel(b))}${b.owner ? `, ${esc(b.owner)}` : ''})`).join(', ')}</span>`
    : '';
}
els.editForm.elements.start_time.addEventListener('input', updateOverlapHint);
els.editForm.elements.end_time.addEventListener('input', updateOverlapHint);

/** Nimmt ungespeicherte Änderungen beim Verschieben mit, sofern ein Titel da ist. */
function readEditorIfValid() {
  const fields = readEditor();
  return fields.title ? fields : {};
}

function applyRow(row) {
  if (row) state.activities.set(row.id, row);
  render();
}

els.editForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const fields = readEditor();
  if (!fields.title) {
    const field = els.editForm.elements.title;
    field.closest('.field').classList.add('invalid');
    field.focus();
    toast('Bitte einen Titel eingeben.', true);
    return;
  }
  if (fields.start_time && fields.end_time && fields.end_time <= fields.start_time) {
    toast('Das Ende muss nach dem Beginn liegen.', true);
    els.editForm.elements.end_time.focus();
    return;
  }
  const submit = els.editForm.querySelector('[type="submit"]');
  submit.disabled = true;
  try {
    if (editing.id) {
      applyRow(await updateActivity(editing.id, fields));
      toast('Gespeichert');
    } else {
      applyRow(await createActivity({
        ...fields,
        day: editing.day,
        created_by: getCurrentUser()?.name || 'Unbekannt',
      }));
      toast(editing.day ? 'Aktivität hinzugefügt' : 'Idee gespeichert');
    }
    els.editDialog.close();
  } catch (err) {
    showError(err, 'Speichern hat nicht geklappt.');
  } finally {
    submit.disabled = false;
  }
});

els.editToIdeas.addEventListener('click', async () => {
  if (!editing?.id) return;
  try {
    const reset = 'owner' in (state.activities.get(editing.id) || {}) ? { owner: null, is_fixed: false } : {};
    applyRow(await updateActivity(editing.id, { ...readEditorIfValid(), ...reset, day: null, done: false }));
    els.editDialog.close();
    toast('In die Ideensammlung verschoben');
  } catch (err) {
    showError(err);
  }
});

els.editMove.addEventListener('click', () => {
  if (!editing?.id) return;
  const id = editing.id;
  const pending = readEditorIfValid();
  els.editDialog.close();
  openPlanner(id, pending);
});

els.editDelete.addEventListener('click', async () => {
  if (!editing?.id) return;
  if (!deleteArmed) {
    deleteArmed = true;
    const n = photosFor(editing.id).length;
    els.editDelete.textContent = n ? `Mit ${plural(n, 'Foto', 'Fotos')} löschen? Nochmal tippen` : 'Wirklich löschen? Nochmal tippen';
    els.editDelete.classList.add('confirm');
    deleteTimer = setTimeout(resetDeleteButton, 4000);
    return;
  }
  const id = editing.id;
  const photos = photosFor(id);
  try {
    await deleteActivity(id, photos);
    state.activities.delete(id);
    photos.forEach((p) => state.photos.delete(p.id));
    render();
    els.editDialog.close();
    toast('Gelöscht');
  } catch (err) {
    showError(err, 'Löschen hat nicht geklappt.');
  }
});

// ---------------------------------------------------------------------
// Einplanen-Dialog (Idee -> Tag, oder Aktivität auf anderen Tag)
// ---------------------------------------------------------------------
let planning = null; // { id, extra }

function openPlanner(id, extra = {}) {
  const a = state.activities.get(id);
  if (!a) return;
  planning = { id, extra };
  els.planTitle.textContent = `„${a.title}“ einplanen`;
  let html = '';
  let lastMonth = '';
  state.weekends.forEach((w, i) => {
    if (w.monthKey !== lastMonth) {
      lastMonth = w.monthKey;
      html += `<h3 class="plan-month">${esc(monthYear(parseISODate(`${w.monthKey}-01`)))}</h3>`;
    }
    html += `
      <div class="plan-week${i === 0 ? ' current' : ''}">
        <div class="plan-week-title">
          <span>${esc(weekendRange(w.first, w.last))}</span>
          ${i === 0 ? '<span class="badge">Dieses Wochenende</span>' : ''}
        </div>
        <div class="plan-days">
          ${w.days.map((d) => `
            <button class="plan-day${d.iso === a.day ? ' selected' : ''}" type="button" data-day="${d.iso}"
              aria-label="${esc(dayLabel(d.iso))}">
              <b>${esc(weekdayShort(d.date))}</b><small>${esc(dayMonth(d.date))}</small>
            </button>`).join('')}
        </div>
      </div>`;
  });
  els.planList.innerHTML = html || '<p class="empty">Keine Wochenenden verfügbar.</p>';
  els.planDialog.showModal();
  els.planList.scrollTop = 0;
}

els.planList.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-day]');
  if (!b || !planning) return;
  const { id, extra } = planning;
  const wasIdea = !state.activities.get(id)?.day;
  try {
    applyRow(await updateActivity(id, { ...extra, day: b.dataset.day, ...(wasIdea ? { done: false } : {}) }));
    els.planDialog.close();
    toast(`Eingeplant: ${dayLabel(b.dataset.day)}`);
  } catch (err) {
    showError(err, 'Einplanen hat nicht geklappt.');
  }
});

// ---------------------------------------------------------------------
// Fotos hochladen
// ---------------------------------------------------------------------
let photoTarget = null;
const completeAfterUpload = new Set(); // Termine, die nach dem Foto-Upload abgehakt werden

function pickPhotos(activityId) {
  if (!state.photosReady) { showSetupBanner('photos'); toast('Fotos sind noch nicht eingerichtet.', true); return; }
  photoTarget = activityId;
  els.photoInput.value = '';
  els.photoInput.click();
}

els.photoInput.addEventListener('change', () => {
  const files = [...els.photoInput.files];
  if (photoTarget && files.length) addPhotos(photoTarget, files);
});

async function addPhotos(activityId, files) {
  const bump = (d) => {
    const n = (state.uploading.get(activityId) || 0) + d;
    if (n > 0) state.uploading.set(activityId, n); else state.uploading.delete(activityId);
    render();
  };
  bump(files.length);
  toast(files.length === 1 ? 'Foto wird hochgeladen …' : `${files.length} Fotos werden hochgeladen …`, false, 60000);
  let ok = 0;
  let lastError = null;
  for (const file of files) {
    try {
      const img = await prepareImage(file);
      const row = await uploadPhoto({
        activityId, ...img, createdBy: getCurrentUser()?.name || 'Unbekannt',
      });
      state.photos.set(row.id, row);
      ok++;
    } catch (err) {
      lastError = err;
      console.error(err);
    } finally {
      bump(-1);
    }
  }
  if (lastError && isSetupError(lastError)) { state.photosReady = false; showSetupBanner('photos'); }
  // Foto-Challenge: vergangene (oder gerade abgehakte) gemeinsame Termine gelten damit als erledigt
  const a = state.activities.get(activityId);
  if (ok && a && !a.done && !a.owner && (completeAfterUpload.has(activityId) || (a.day && a.day <= state.todayISO))) {
    try { applyRow(await updateActivity(activityId, { done: true })); } catch (err) { console.error(err); }
  }
  completeAfterUpload.delete(activityId);
  if (!lastError) toast(ok === 1 ? 'Foto gespeichert' : `${ok} Fotos gespeichert`);
  else if (ok) toast(`${ok} von ${files.length} Fotos gespeichert – der Rest hat nicht geklappt.`, true);
  else toast('Foto konnte nicht hochgeladen werden.', true);
}

// ---------------------------------------------------------------------
// Foto-Ansicht (Lightbox), Speichern & Herunterladen
// ---------------------------------------------------------------------
const lb = { ids: [], index: 0 };
let lbDeleteArmed = false;
let lbDeleteTimer;
const blobCache = new Map(); // photoId -> Promise<Blob>

function fetchBlob(p) {
  if (!blobCache.has(p.id)) {
    const promise = fetch(photoUrl(p.storage_path)).then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.blob();
    });
    promise.catch(() => blobCache.delete(p.id));
    blobCache.set(p.id, promise);
  }
  return blobCache.get(p.id);
}

function contextIds(ctx) {
  if (ctx === 'all') return galleryPhotos().map((p) => p.id);
  const activityId = ctx.split(':')[1];
  return photosFor(activityId).map((p) => p.id);
}

function openLightbox(ctx, photoId) {
  lb.ctx = ctx;
  lb.ids = contextIds(ctx);
  lb.index = Math.max(0, lb.ids.indexOf(photoId));
  showLightboxPhoto();
  els.lightbox.showModal();
}

function resetLbDelete() {
  lbDeleteArmed = false;
  clearTimeout(lbDeleteTimer);
  els.lbDelete.textContent = 'Löschen';
  els.lbDelete.classList.remove('confirm');
}

function showLightboxPhoto() {
  const p = state.photos.get(lb.ids[lb.index]);
  if (!p) { els.lightbox.close(); return; }
  const a = state.activities.get(p.activity_id);
  els.lbImg.src = photoUrl(p.storage_path);
  els.lbImg.alt = a ? `Foto: ${a.title}` : 'Foto';
  els.lbCounter.textContent = lb.ids.length > 1 ? `${lb.index + 1} / ${lb.ids.length}` : '';
  els.lbCaption.innerHTML = `<b>${a ? titleHTML(a) : ''}</b>${a?.day ? esc(dayLabel(a.day)) + ' · ' : ''}Foto von ${esc(p.created_by || 'Unbekannt')}`;
  els.lbPrev.hidden = lb.index === 0;
  els.lbNext.hidden = lb.index >= lb.ids.length - 1;
  resetLbDelete();
  fetchBlob(p).catch(() => {}); // fürs Speichern schon vorladen
}

function refreshLightbox() {
  const current = lb.ids[lb.index];
  lb.ids = contextIds(lb.ctx);
  if (!lb.ids.length) { els.lightbox.close(); return; }
  const i = lb.ids.indexOf(current);
  lb.index = i >= 0 ? i : Math.min(lb.index, lb.ids.length - 1);
  showLightboxPhoto();
}

function stepLightbox(delta) {
  const next = lb.index + delta;
  if (next < 0 || next >= lb.ids.length) return;
  lb.index = next;
  showLightboxPhoto();
}

els.lbPrev.addEventListener('click', () => stepLightbox(-1));
els.lbNext.addEventListener('click', () => stepLightbox(1));
els.lightbox.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowLeft') stepLightbox(-1);
  if (e.key === 'ArrowRight') stepLightbox(1);
});
let touchX = null;
els.lbImg.parentElement.addEventListener('touchstart', (e) => { touchX = e.touches[0].clientX; }, { passive: true });
els.lbImg.parentElement.addEventListener('touchend', (e) => {
  if (touchX === null) return;
  const dx = e.changedTouches[0].clientX - touchX;
  touchX = null;
  if (Math.abs(dx) > 50) stepLightbox(dx < 0 ? 1 : -1);
});

function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

const isTouchDevice = () => matchMedia('(pointer: coarse)').matches;

els.lbSave.addEventListener('click', async () => {
  const p = state.photos.get(lb.ids[lb.index]);
  if (!p) return;
  const name = photoFileName(p);
  let blob;
  try {
    blob = await fetchBlob(p);
  } catch (err) {
    showError(err, 'Foto konnte nicht geladen werden.');
    return;
  }
  // Auf dem Handy: Teilen-Menü (dort "Bild sichern" für die Fotos-App)
  const file = new File([blob], name, { type: blob.type || 'image/jpeg' });
  if (isTouchDevice() && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return;
    } catch (err) {
      if (err.name === 'AbortError') return;
    }
  }
  downloadBlob(blob, name);
});

els.lbDelete.addEventListener('click', async () => {
  const p = state.photos.get(lb.ids[lb.index]);
  if (!p) return;
  if (!lbDeleteArmed) {
    lbDeleteArmed = true;
    els.lbDelete.textContent = 'Wirklich löschen?';
    els.lbDelete.classList.add('confirm');
    lbDeleteTimer = setTimeout(resetLbDelete, 4000);
    return;
  }
  try {
    await deletePhoto(p);
    state.photos.delete(p.id);
    toast('Foto gelöscht');
    render();
  } catch (err) {
    showError(err, 'Foto konnte nicht gelöscht werden.');
  }
});

let jszipPromise;
function loadJSZip() {
  jszipPromise ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
    s.onload = () => resolve(window.JSZip);
    s.onerror = () => { jszipPromise = null; reject(new Error('JSZip konnte nicht geladen werden.')); };
    document.head.append(s);
  });
  return jszipPromise;
}

let zipping = false;
async function downloadAll() {
  const photos = galleryPhotos();
  if (!photos.length || zipping) return;
  zipping = true;
  toast(`${plural(photos.length, 'Foto wird', 'Fotos werden')} vorbereitet …`, false, 60000);
  try {
    const JSZip = await loadJSZip();
    const zip = new JSZip();
    const used = new Set();
    for (const p of photos) {
      let name = photoFileName(p);
      for (let i = 2; used.has(name); i++) name = name.replace(/(-\d+)?\.jpg$/, `-${i}.jpg`);
      used.add(name);
      zip.file(name, await fetchBlob(p));
    }
    const blob = await zip.generateAsync({ type: 'blob' });
    downloadBlob(blob, `wochenendplaner-fotos-${state.todayISO}.zip`);
    toast('Download gestartet');
  } catch (err) {
    showError(err, 'Download hat nicht geklappt.');
  } finally {
    zipping = false;
  }
}

// ---------------------------------------------------------------------
// Dialoge schließen
// ---------------------------------------------------------------------
document.querySelectorAll('dialog').forEach((dlg) => {
  dlg.addEventListener('click', (e) => {
    if (e.target.closest('[data-close]')) { dlg.close(); return; }
    if (e.target === dlg && dlg !== els.nameDialog && dlg !== els.lightbox) {
      const r = dlg.getBoundingClientRect();
      const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
      if (!inside) dlg.close();
    }
  });
});

// ---------------------------------------------------------------------
// Klicks in den Listen
// ---------------------------------------------------------------------
let photoCheckId = null;

async function toggleDone(id) {
  const a = state.activities.get(id);
  if (!a) return;
  const done = !a.done;
  // Foto-Challenge: gemeinsamer Termin ohne Foto -> erst fragen
  if (done && needsPhoto(a)) {
    photoCheckId = id;
    els.pcText.textContent = `Für „${a.title}“ gibt es noch kein Foto. Haltet den Moment für eure Erinnerungen fest – oder schließt ihn ohne Foto ab.`;
    els.photoCheck.showModal();
    return;
  }
  state.activities.set(id, { ...a, done }); // sofort anzeigen
  render();
  try {
    applyRow(await updateActivity(id, { done }));
  } catch (err) {
    state.activities.set(id, a);
    render();
    showError(err);
  }
}

els.pcPhoto.addEventListener('click', () => {
  const id = photoCheckId;
  els.photoCheck.close();
  if (!id) return;
  completeAfterUpload.add(id);
  pickPhotos(id);
});
els.pcSkip.addEventListener('click', () => {
  const id = photoCheckId;
  els.photoCheck.close();
  if (id) skipPhoto(id);
});

async function skipPhoto(id) {
  try {
    applyRow(await updateActivity(id, { photo_skipped: true, done: true }));
    toast('Abgeschlossen – ohne Foto');
  } catch (err) {
    showError(err, 'Das hat leider nicht geklappt.');
  }
}

function handleAction(e) {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const { action, id, day } = el.dataset;
  if (action === 'add') openEditor({ day });
  else if (action === 'add-idea') openEditor({ day: null });
  else if (action === 'edit') openEditor({ id });
  else if (action === 'toggle') toggleDone(id);
  else if (action === 'plan') openPlanner(id);
  else if (action === 'add-photo') pickPhotos(id);
  else if (action === 'photo') openLightbox(el.dataset.ctx, el.dataset.photo);
  else if (action === 'download-all') downloadAll();
  else if (action === 'skip-photo') skipPhoto(id);
  else if (action === 'idea-filter') { state.ideaFilter = el.dataset.cat || null; renderIdeas(); }
  else if (action === 'go-memories') { state.memMode = 'weekends'; setView('memories'); renderMemories(); }
}

els.main.addEventListener('click', handleAction);
els.editPhotos.addEventListener('click', handleAction);

document.querySelectorAll('[data-mem]').forEach((b) => b.addEventListener('click', () => {
  state.memMode = b.dataset.mem;
  renderMemories();
}));

document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => setView(t.dataset.view)));

// ---------------------------------------------------------------------
// Hell / Dunkel
// ---------------------------------------------------------------------
const THEME_KEY = 'wochenendplaner.theme';
// Standard ist dunkel. Reihenfolge beim Tippen: dunkel -> hell -> automatisch
const DEFAULT_THEME = 'dark';
const THEMES = ['dark', 'light', 'auto'];
const THEME_LABEL = { auto: 'automatisch', light: 'hell', dark: 'dunkel' };

function getTheme() {
  try { return THEMES.includes(localStorage.getItem(THEME_KEY)) ? localStorage.getItem(THEME_KEY) : DEFAULT_THEME; } catch { return DEFAULT_THEME; }
}

function applyTheme(theme) {
  if (theme === 'auto') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
  els.themeBtn.innerHTML = ICONS[theme === 'light' ? 'sun' : theme === 'dark' ? 'moon' : 'auto'];
  els.themeBtn.setAttribute('aria-label', `Farbschema: ${THEME_LABEL[theme]} (tippen zum Wechseln)`);
  els.themeBtn.title = `Farbschema: ${THEME_LABEL[theme]}`;
  const dark = theme === 'dark' || (theme === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => {
    m.setAttribute('content', dark ? '#16141a' : '#fbf7f2');
  });
}

els.themeBtn.addEventListener('click', () => {
  const next = THEMES[(THEMES.indexOf(getTheme()) + 1) % THEMES.length];
  try { localStorage.setItem(THEME_KEY, next); } catch { /* egal */ }
  applyTheme(next);
  toast(`Farbschema: ${THEME_LABEL[next]}`);
});
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => applyTheme(getTheme()));

// ---------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------
async function main() {
  applyTheme(getTheme());
  computeWeekends();
  render();
  const user = await initAuth();
  renderUser(user);
  if (!user) openNameDialog({ cancellable: false });
  await loadAll();
  startRealtime();

  // Wenn die App wieder in den Vordergrund kommt (z. B. iPhone entsperrt):
  // neu laden – auch das "aktuelle Wochenende" kann sich geändert haben.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') loadAll();
  });
  window.addEventListener('online', loadAll);
}

main();
