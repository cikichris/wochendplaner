// =====================================================================
//  Datenzugriff auf die Tabelle "activities"
//  day = 'JJJJ-MM-TT' -> geplante Aktivität, day = null -> Idee
// =====================================================================
import { supabase } from './supabase-client.js';

const TABLE = 'activities';

function check({ data, error }) {
  if (error) throw error;
  return data;
}

/** Alle Ideen + alle Aktivitäten ab dem angegebenen Tag. */
export async function fetchActivities(fromDay) {
  return check(
    await supabase
      .from(TABLE)
      .select('*')
      .or(`day.is.null,day.gte.${fromDay}`)
      .order('created_at', { ascending: true }),
  );
}

export async function createActivity(fields) {
  return check(await supabase.from(TABLE).insert(fields).select().single());
}

export async function updateActivity(id, patch) {
  return check(await supabase.from(TABLE).update(patch).eq('id', id).select().single());
}

export async function deleteActivity(id) {
  check(await supabase.from(TABLE).delete().eq('id', id));
}

/**
 * Live-Änderungen abonnieren.
 * onChange({ type: 'INSERT'|'UPDATE'|'DELETE', row, oldId })
 * onStatus('SUBSCRIBED'|'CHANNEL_ERROR'|'TIMED_OUT'|'CLOSED')
 * Gibt eine Funktion zum Abbestellen zurück.
 */
export function subscribeActivities(onChange, onStatus) {
  const channel = supabase
    .channel('activities-live')
    .on('postgres_changes', { event: '*', schema: 'public', table: TABLE }, (payload) => {
      onChange({
        type: payload.eventType,
        row: payload.new && Object.keys(payload.new).length ? payload.new : null,
        oldId: payload.old?.id ?? null,
      });
    })
    .subscribe((status) => onStatus?.(status));
  return () => supabase.removeChannel(channel);
}

/** Erkennt, ob die Datenbank noch nicht eingerichtet ist. */
export function isSetupError(error) {
  const code = error?.code || '';
  const msg = String(error?.message || '').toLowerCase();
  return (
    code === 'PGRST205' || code === 'PGRST106' || code === '42P01' || code === '42501' ||
    msg.includes('does not exist') || msg.includes('could not find the table') ||
    msg.includes('permission denied')
  );
}
