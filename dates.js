// Datums-Hilfsfunktionen (immer lokale Zeit, nie UTC).

const fmtWeekday = new Intl.DateTimeFormat('de-DE', { weekday: 'long' });
const fmtWeekdayShort = new Intl.DateTimeFormat('de-DE', { weekday: 'short' });
const fmtMonth = new Intl.DateTimeFormat('de-DE', { month: 'long' });
const fmtMonthYear = new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric' });
const fmtDateTime = new Intl.DateTimeFormat('de-DE', {
  day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
});

const pad = (n) => String(n).padStart(2, '0');

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

/**
 * Alle Wochenenden (Fr, Sa, So) vom aktuellen bzw. nächsten bis zum Enddatum.
 * Ist heute Fr/Sa/So, beginnt die Liste mit dem laufenden Wochenende.
 */
export function getWeekends(today, endISO) {
  const t = startOfDay(today);
  const dow = t.getDay(); // 0 = So, 5 = Fr, 6 = Sa
  const backToFriday = { 5: 0, 6: 1, 0: 2 }[dow];
  let friday = backToFriday !== undefined ? addDays(t, -backToFriday) : addDays(t, (5 - dow + 7) % 7);
  const end = parseISODate(endISO);
  const result = [];
  while (friday <= end) {
    const days = [friday, addDays(friday, 1), addDays(friday, 2)];
    result.push({
      key: toISODate(friday),
      days: days.map((d) => ({ date: d, iso: toISODate(d) })),
      monthKey: toISODate(days[1]).slice(0, 7), // Gruppierung nach dem Samstag
    });
    friday = addDays(friday, 7);
  }
  return result;
}

export const weekdayLong = (d) => fmtWeekday.format(d);
export const weekdayShort = (d) => fmtWeekdayShort.format(d).replace('.', '');
export const dayMonth = (d) => `${d.getDate()}.${d.getMonth() + 1}.`;
export const monthYear = (d) => fmtMonthYear.format(d);

/** "13.–15. November" bzw. "30. Oktober – 1. November" */
export function weekendRange(fri, sun) {
  if (fri.getMonth() === sun.getMonth()) {
    return `${fri.getDate()}.–${sun.getDate()}. ${fmtMonth.format(sun)}`;
  }
  return `${fri.getDate()}. ${fmtMonth.format(fri)} – ${sun.getDate()}. ${fmtMonth.format(sun)}`;
}

/** "18:30:00" -> "18:30" */
export const shortTime = (t) => (t ? String(t).slice(0, 5) : '');

export const formatTimestamp = (iso) => (iso ? fmtDateTime.format(new Date(iso)) : '');
