// =====================================================================
//  Datenzugriff
//  activities: day = 'JJJJ-MM-TT' -> geplante Aktivität, day = null -> Idee
//  photos:     Fotos zu einer Aktivität (Dateien im Storage-Bucket "photos")
// =====================================================================
import { supabase } from './supabase-client.js';

const ACTIVITIES = 'activities';
const PHOTOS = 'photos';
const BUCKET = 'photos';

function check({ data, error }) {
  if (error) throw error;
  return data;
}

// ---------------------------- Aktivitäten ----------------------------

export async function fetchActivities() {
  return check(
    await supabase.from(ACTIVITIES).select('*').order('created_at', { ascending: true }),
  );
}

export async function createActivity(fields) {
  return check(await supabase.from(ACTIVITIES).insert(fields).select().single());
}

export async function updateActivity(id, patch) {
  return check(await supabase.from(ACTIVITIES).update(patch).eq('id', id).select().single());
}

/** Löscht die Aktivität und die Bilddateien ihrer Fotos. */
export async function deleteActivity(id, photos = []) {
  if (photos.length) await removeFiles(photos);
  check(await supabase.from(ACTIVITIES).delete().eq('id', id));
}

// ------------------------------- Fotos -------------------------------

export async function fetchPhotos() {
  return check(
    await supabase.from(PHOTOS).select('*').order('created_at', { ascending: true }),
  );
}

/** Lädt ein vorbereitetes Bild (groß + Vorschau) hoch und legt den Eintrag an. */
export async function uploadPhoto({ activityId, full, thumb, width, height, createdBy }) {
  const id = crypto.randomUUID();
  const storagePath = `${activityId}/${id}.jpg`;
  const thumbPath = `${activityId}/${id}_thumb.jpg`;
  const opts = { contentType: 'image/jpeg', cacheControl: '31536000', upsert: false };
  const bucket = supabase.storage.from(BUCKET);
  check(await bucket.upload(storagePath, full, opts));
  try {
    check(await bucket.upload(thumbPath, thumb, opts));
    return check(await supabase.from(PHOTOS).insert({
      id, activity_id: activityId, storage_path: storagePath, thumb_path: thumbPath,
      width, height, created_by: createdBy,
    }).select().single());
  } catch (err) {
    await bucket.remove([storagePath, thumbPath]); // aufräumen
    throw err;
  }
}

export async function deletePhoto(photo) {
  await removeFiles([photo]);
  check(await supabase.from(PHOTOS).delete().eq('id', photo.id));
}

async function removeFiles(photos) {
  const paths = photos.flatMap((p) => [p.storage_path, p.thumb_path]);
  const { error } = await supabase.storage.from(BUCKET).remove(paths);
  if (error) console.warn('Bilddateien konnten nicht gelöscht werden', error);
}

export function photoUrl(path) {
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

// ------------------------------ Realtime -----------------------------

/**
 * Live-Änderungen beider Tabellen abonnieren.
 * onChange({ table, type: 'INSERT'|'UPDATE'|'DELETE', row, oldId })
 * onStatus('SUBSCRIBED'|'CHANNEL_ERROR'|'TIMED_OUT'|'CLOSED')
 */
export function subscribeChanges(onChange, onStatus) {
  const handler = (payload) => onChange({
    table: payload.table,
    type: payload.eventType,
    row: payload.new && Object.keys(payload.new).length ? payload.new : null,
    oldId: payload.old?.id ?? null,
  });
  const channel = supabase
    .channel('wochenendplaner-live')
    .on('postgres_changes', { event: '*', schema: 'public', table: ACTIVITIES }, handler)
    .on('postgres_changes', { event: '*', schema: 'public', table: PHOTOS }, handler)
    .subscribe((status) => onStatus?.(status));
  return () => supabase.removeChannel(channel);
}

/** Erkennt, ob die Datenbank (bzw. eine Tabelle) noch nicht eingerichtet ist. */
export function isSetupError(error) {
  const code = error?.code || '';
  const msg = String(error?.message || '').toLowerCase();
  return (
    code === 'PGRST205' || code === 'PGRST106' || code === '42P01' || code === '42501' ||
    msg.includes('does not exist') || msg.includes('could not find the table') ||
    msg.includes('permission denied') || msg.includes('bucket not found') ||
    msg.includes('row-level security')
  );
}
