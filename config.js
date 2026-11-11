// =====================================================================
//  Einstellungen des Wochenendplaners
// =====================================================================

// Supabase-Projekt (Project URL + Publishable Key).
// Der Publishable Key darf öffentlich im Code stehen – geschützt wird
// über die RLS-Regeln in supabase/schema.sql.
export const SUPABASE_URL = 'https://lykicisycncpeuvaczhe.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_5vLsi-Cbq-CsfK1uNHMnDw_64GomEVH';

// Bis zu diesem Datum (einschließlich) werden Wochenenden angezeigt.
// Format: JJJJ-MM-TT
export const END_DATE = '2026-12-31';

// Vorschlag im "Wer bist du?"-Dialog
export const SUGGESTED_NAMES = ['Chris'];

// Login-Modus:
//   'name'  = kein Login, nur Name im Browser speichern (aktuell)
//   'email' = später: Login per E-Mail + Passwort über Supabase Auth
export const AUTH_MODE = 'name';
