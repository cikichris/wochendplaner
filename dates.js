// Datums-Hilfsfunktionen (immer lokale Zeit, nie UTC).
// Ein "Wochenende" geht von Donnerstag bis Sonntag.

const fmtWeekday = new Intl.DateTimeFormat('de-DE', { weekday: 'long' });
const fmtWeekdayShort = new Intl.DateTimeFormat('de-DE', { weekday: 'short' });
const fmtMonth = new Intl.DateTimeFormat('de-DE', { month: 'long' });
const fmtMonthYear = new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric' });
const fmtDateTime = new Intl.DateTimeFormat('de-DE', {
  day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
});

const pad = (n) => String(n).padStart(2, '0');
const THURSDAY = 4;
export const WEEKEND_LENGTH = 4; // Do, Fr, Sa, So

export function toISODate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseISODate(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(d, n) {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  r.setDate(r.getDate() + n);
  return r;
}

export function startOfDay(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Liegt der Tag zwischen Donnerstag und Sonntag? */
export function isWeekendDay(d) {
  const dow = d.getDay();
  return dow === 0 || dow >= THURSDAY;
}

/** Donnerstag am oder vor diesem Tag. */
export function thursdayOnOrBefore(d) {
  const t = startOfDay(d);
  return addDays(t, -((t.getDay() - THURSDAY + 7) % 7));
}

/**
 * Donnerstag des "aktuellen" Wochenendes: Ist heute Do–So, das laufende,
 * sonst das kommende.
 */
export function currentWeekendStart(today) {
  const t = startOfDay(today);
  return isWeekendDay(t) ? thursdayOnOrBefore(t) : addDays(t, (THURSDAY - t.getDay() + 7) % 7);
}

export function makeWeekend(thursday) {
  const days = Array.from({ length: WEEKEND_LENGTH }, (_, i) => addDays(thursday, i));
  return {
    key: toISODate(thursday),
    days: days.map((d) => ({ date: d, iso: toISODate(d) })),
    monthKey: toISODate(days[2]).slice(0, 7), // Gruppierung nach dem Samstag
    first: days[0],
    last: days[days.length - 1],
  };
}

/** Alle Wochenenden vom aktuellen bzw. nächsten bis zum Enddatum. */
export function getWeekends(today, endISO) {
  const end = parseISODate(endISO);
  const result = [];
  for (let thu = currentWeekendStart(today); thu <= end; thu = addDays(thu, 7)) {
    result.push(makeWeekend(thu));
  }
  return result;
}

/**
 * Vergangene Wochenenden (neueste zuerst): immer die letzten `recent`
 * Wochenenden, dazu alle älteren, an denen etwas eingetragen ist.
 */
export function getPastWeekends(today, recent, activityDays) {
  const current = currentWeekendStart(today);
  const keys = new Set();
  for (let i = 1; i <= recent; i++) keys.add(toISODate(addDays(current, -7 * i)));
  for (const iso of activityDays) {
    const thu = thursdayOnOrBefore(parseISODate(iso));
    if (thu < current) keys.add(toISODate(thu));
  }
  return [...keys].sort().reverse().map((k) => makeWeekend(parseISODate(k)));
}

export const weekdayLong = (d) => fmtWeekday.format(d);
export const weekdayShort = (d) => fmtWeekdayShort.format(d).replace('.', '');
export const dayMonth = (d) => `${d.getDate()}.${d.getMonth() + 1}.`;
export const monthYear = (d) => fmtMonthYear.format(d);

/** "12.–15. November" bzw. "29. Oktober – 1. November" */
export function weekendRange(first, last) {
  if (first.getMonth() === last.getMonth()) {
    return `${first.getDate()}.–${last.getDate()}. ${fmtMonth.format(last)}`;
  }
  return `${first.getDate()}. ${fmtMonth.format(first)} – ${last.getDate()}. ${fmtMonth.format(last)}`;
}

/** Ganze Tage von a bis b (b - a). */
export function daysBetween(a, b) {
  return Math.round((startOfDay(b) - startOfDay(a)) / 86400000);
}

/** "18:30:00" -> "18:30" */
export const shortTime = (t) => (t ? String(t).slice(0, 5) : '');

export const formatTimestamp = (iso) => (iso ? fmtDateTime.format(new Date(iso)) : '');
