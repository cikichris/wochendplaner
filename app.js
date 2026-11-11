// =====================================================================
//  Wochenendplaner – Hauptlogik
// =====================================================================
import { END_DATE, SUGGESTED_NAMES } from './config.js';
import { initAuth, getCurrentUser, signIn, onAuthChange } from './auth.js';
import {
  fetchActivities, createActivity, updateActivity, deleteActivity,
  subscribeActivities, isSetupError,
} from './api.js';
import {
  getWeekends, parseISODate, toISODate, startOfDay, weekdayLong, weekdayShort,
  dayMonth, monthYear, weekendRange, shortTime, formatTimestamp,
} from './dates.js';

// ---------------------------------------------------------------------
// Zustand
// ---------------------------------------------------------------------
const state = {
  activities: new Map(), // id -> Zeile
  weekends: [],
  todayISO: '',
  view: 'weekends',
  loaded: false,
};

const $ = (sel) => document.querySelector(sel);
const els = {
  weekends: $('#view-weekends'),
  ideas: $('#view-ideas'),
  ideaCount: $('#ideaCount'),
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
  editExtra: $('#editExtra'),
  editMove: $('#editMove'),
  editToIdeas: $('#editToIdeas'),
  editDelete: $('#editDelete'),
  planDialog: $('#planDialog'),
  planTitle: $('#planTitle'),
  planList: $('#planList'),
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
  sun: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  moon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/></svg>',
  auto: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor"/></svg>',
};

let toastTimer;
function toast(msg, isError = false) {
  els.toast.textContent = msg;
  els.toast.classList.toggle('error', isError);
  els.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => els.toast.classList.remove('show'), isError ? 4500 : 2200);
}

function showError(err, fallback = 'Das hat leider nicht geklappt.') {
  console.error(err);
  if (isSetupError(err)) showSetupBanner();
  else if (!navigator.onLine) toast('Keine Internetverbindung.', true);
  else toast(fallback, true);
}

function showSetupBanner() {
  els.banner.innerHTML =
    '<b>Datenbank noch nicht eingerichtet</b>' +
    'Bitte die Datei <code>supabase/schema.sql</code> im SQL-Editor von Supabase ausführen (siehe Anleitung in der README) und die Seite neu laden.';
  els.banner.hidden = false;
}

/** Sortierung innerhalb eines Tages: ohne Uhrzeit zuerst, dann nach Uhrzeit. */
function byTimeThenCreated(a, b) {
  const ta = a.start_time || '';
  const tb = b.start_time || '';
  if (ta !== tb) return ta < tb ? -1 : 1;
  return String(a.created_at).localeCompare(String(b.created_at));
}

function activitiesForDay(iso) {
  return [...state.activities.values()].filter((a) => a.day === iso).sort(byTimeThenCreated);
}

function ideas() {
  return [...state.activities.values()]
    .filter((a) => !a.day)
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
}

function dayLabel(iso) {
  const d = parseISODate(iso);
  return `${weekdayLong(d)}, ${dayMonth(d)}`;
}

// ---------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------
function itemHTML(a, { idea = false } = {}) {
  const meta = [];
  if (a.start_time) meta.push(`<span>${ICONS.clock}${esc(shortTime(a.start_time))} Uhr</span>`);
  if (a.location) meta.push(`<span>${ICONS.pin}${esc(a.location)}</span>`);
  const check = idea ? '' : `
    <button class="check" type="button" data-action="toggle" data-id="${a.id}"
      role="checkbox" aria-checked="${a.done ? 'true' : 'false'}"
      aria-label="${esc(a.title)} ${a.done ? 'als offen markieren' : 'abhaken'}">
      <span>${ICONS.check}</span>
    </button>`;
  const plan = idea
    ? `<button class="plan-btn" type="button" data-action="plan" data-id="${a.id}">Einplanen</button>`
    : '';
  return `
    <li class="item${a.done && !idea ? ' done' : ''}${idea ? '' : ' has-check'}">
      ${check}
      <button class="item-body" type="button" data-action="edit" data-id="${a.id}" aria-label="${esc(a.title)} bearbeiten">
        <div class="item-title">${esc(a.title)}</div>
        ${meta.length ? `<div class="item-meta">${meta.join('')}</div>` : ''}
        ${a.note ? `<div class="item-note">${esc(a.note)}</div>` : ''}
        <div class="item-by">eingetragen von ${esc(a.created_by || 'Unbekannt')}</div>
      </button>
      ${plan}
    </li>`;
}

function renderWeekends() {
  if (!state.weekends.length) {
    els.weekends.innerHTML = `<p class="empty">Bis zum ${esc(dayMonth(parseISODate(END_DATE)))}${parseISODate(END_DATE).getFullYear()} gibt es keine Wochenenden mehr.<br>Das Enddatum lässt sich in <code>config.js</code> ändern.</p>`;
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
      const [fri, , sun] = w.days;
      const total = w.days.reduce((n, d) => n + activitiesForDay(d.iso).length, 0);
      const badge = isCurrent
        ? '<span class="badge">Dieses Wochenende</span>'
        : (total ? `<span class="badge soft">${total} geplant</span>` : '');
      html += `
        <article class="weekend${isCurrent ? ' current' : ''}" id="we-${w.key}">
          <header class="weekend-head">
            <h3>${esc(weekendRange(fri.date, sun.date))}</h3>
            ${badge}
          </header>
          ${w.days.map((d) => dayHTML(d)).join('')}
        </article>`;
    }
    html += '</section>';
  }
  els.weekends.innerHTML = html;
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
  const list = ideas();
  els.ideaCount.textContent = list.length;
  els.ideaCount.hidden = list.length === 0;
  els.ideas.innerHTML = `
    <div class="ideas">
      <div class="ideas-head">
        <div>
          <h2>Ideensammlung &amp; Vorschläge</h2>
          <p>Alles, was wir irgendwann mal machen wollen.</p>
        </div>
      </div>
      <button class="big-add" type="button" data-action="add-idea">${ICONS.plus}Idee hinzufügen</button>
      ${list.length
        ? `<ul class="items">${list.map((a) => itemHTML(a, { idea: true })).join('')}</ul>`
        : `<p class="empty">${state.loaded ? 'Noch keine Ideen. Wie wär’s mit „Therme besuchen“ oder „Weihnachtsmarkt“?' : 'Lade Ideen …'}</p>`}
    </div>`;
}

let renderQueued = false;
function render() {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => {
    renderQueued = false;
    renderWeekends();
    renderIdeas();
  });
}

function setView(view) {
  state.view = view;
  els.weekends.hidden = view !== 'weekends';
  els.ideas.hidden = view !== 'ideas';
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
  const from = state.weekends[0]?.key ?? state.todayISO;
  try {
    const rows = await fetchActivities(from);
    state.activities = new Map(rows.map((r) => [r.id, r]));
    state.loaded = true;
    els.banner.hidden = true;
  } catch (err) {
    showError(err, 'Daten konnten nicht geladen werden.');
    state.loaded = true;
  }
  render();
}

function applyRow(row) {
  if (row) state.activities.set(row.id, row);
  render();
}

function startRealtime() {
  subscribeActivities(
    ({ type, row, oldId }) => {
      if (type === 'DELETE') state.activities.delete(oldId);
      else if (row) state.activities.set(row.id, row);
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
}

function openNameDialog({ cancellable }) {
  els.nameSuggestions.innerHTML = SUGGESTED_NAMES
    .map((n) => `<button class="btn" type="button" data-name="${esc(n)}">Ich bin ${esc(n)}</button>`)
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
let editing = null; // { id?: string, day: string|null }
let deleteArmed = false;
let deleteTimer;

function resetDeleteButton() {
  deleteArmed = false;
  clearTimeout(deleteTimer);
  els.editDelete.textContent = 'Löschen';
  els.editDelete.classList.remove('confirm');
}

function openEditor({ id = null, day = null }) {
  const a = id ? state.activities.get(id) : null;
  if (id && !a) { toast('Dieser Eintrag existiert nicht mehr.', true); return; }
  editing = { id, day: a ? a.day : day };
  const isIdea = !editing.day;
  const f = els.editForm.elements;
  f.title.value = a?.title || '';
  f.start_time.value = a?.start_time ? shortTime(a.start_time) : '';
  f.location.value = a?.location || '';
  f.note.value = a?.note || '';
  f.title.closest('.field').classList.remove('invalid');

  els.editTitle.textContent = a
    ? (isIdea ? 'Idee bearbeiten' : 'Aktivität bearbeiten')
    : (isIdea ? 'Neue Idee' : 'Neue Aktivität');
  els.editContext.textContent = isIdea ? 'Ideensammlung' : dayLabel(editing.day);
  els.editMeta.textContent = a
    ? `Eingetragen von ${a.created_by || 'Unbekannt'} · ${formatTimestamp(a.created_at)}`
    : '';
  els.editExtra.hidden = !a;
  els.editMove.textContent = isIdea ? 'Einem Tag zuordnen' : 'Auf anderen Tag verschieben';
  els.editToIdeas.hidden = isIdea;
  resetDeleteButton();
  els.editDialog.showModal();
  if (!a) setTimeout(() => f.title.focus(), 50);
}

function readEditor() {
  const f = els.editForm.elements;
  const clean = (v) => { const t = v.trim(); return t ? t : null; };
  return {
    title: f.title.value.trim(),
    start_time: f.start_time.value || null,
    location: clean(f.location.value),
    note: clean(f.note.value),
  };
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
    applyRow(await updateActivity(editing.id, { ...readEditorIfValid(), day: null, done: false }));
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
    els.editDelete.textContent = 'Wirklich löschen? Nochmal tippen';
    els.editDelete.classList.add('confirm');
    deleteTimer = setTimeout(resetDeleteButton, 4000);
    return;
  }
  const id = editing.id;
  try {
    await deleteActivity(id);
    state.activities.delete(id);
    render();
    els.editDialog.close();
    toast('Gelöscht');
  } catch (err) {
    showError(err, 'Löschen hat nicht geklappt.');
  }
});

/** Nimmt ungespeicherte Änderungen beim Verschieben mit, sofern ein Titel da ist. */
function readEditorIfValid() {
  const fields = readEditor();
  return fields.title ? fields : {};
}

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
    const [fri, , sun] = w.days;
    html += `
      <div class="plan-week${i === 0 ? ' current' : ''}">
        <div class="plan-week-title">
          <span>${esc(weekendRange(fri.date, sun.date))}</span>
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

// Schließen-Buttons und Tippen auf den abgedunkelten Hintergrund
document.querySelectorAll('dialog').forEach((dlg) => {
  dlg.addEventListener('click', (e) => {
    if (e.target.closest('[data-close]')) { dlg.close(); return; }
    if (e.target === dlg && dlg !== els.nameDialog) {
      const r = dlg.getBoundingClientRect();
      const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
      if (!inside) dlg.close();
    }
  });
});

// ---------------------------------------------------------------------
// Klicks in den Listen
// ---------------------------------------------------------------------
async function toggleDone(id) {
  const a = state.activities.get(id);
  if (!a) return;
  const done = !a.done;
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

document.querySelector('main').addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const { action, id, day } = el.dataset;
  if (action === 'add') openEditor({ day });
  else if (action === 'add-idea') openEditor({ day: null });
  else if (action === 'edit') openEditor({ id });
  else if (action === 'toggle') toggleDone(id);
  else if (action === 'plan') openPlanner(id);
});

document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => setView(t.dataset.view)));

// ---------------------------------------------------------------------
// Hell / Dunkel
// ---------------------------------------------------------------------
const THEME_KEY = 'wochenendplaner.theme';
const THEMES = ['auto', 'light', 'dark'];
const THEME_LABEL = { auto: 'automatisch', light: 'hell', dark: 'dunkel' };

function getTheme() {
  try { return THEMES.includes(localStorage.getItem(THEME_KEY)) ? localStorage.getItem(THEME_KEY) : 'auto'; } catch { return 'auto'; }
}

function applyTheme(theme) {
  if (theme === 'auto') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
  els.themeBtn.innerHTML = ICONS[theme === 'light' ? 'sun' : theme === 'dark' ? 'moon' : 'auto'];
  els.themeBtn.setAttribute('aria-label', `Farbschema: ${THEME_LABEL[theme]} (tippen zum Wechseln)`);
  els.themeBtn.title = `Farbschema: ${THEME_LABEL[theme]}`;
  // Statusleisten-Farbe anpassen
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
