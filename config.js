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

// Vorschläge im "Wer bist du?"-Dialog
export const SUGGESTED_NAMES = ['Chris', 'Odilia'];

// Farben für persönliche Termine ("Nur ich"), je Person.
// light = heller Modus, dark = Dunkelmodus (etwas heller, damit es lesbar bleibt)
export const PERSON_COLORS = {
  Chris: { light: '#1f3a8a', dark: '#8fb0f5' },   // Dunkelblau
  Odilia: { light: '#2e7d4f', dark: '#6fcb94' },  // Dunkelgrün
};
// Farbe für alle anderen Namen
export const FALLBACK_PERSON_COLOR = { light: '#6b4fa0', dark: '#b9a2e8' };

// Login-Modus:
//   'name'  = kein Login, nur Name im Browser speichern (aktuell)
//   'email' = später: Login per E-Mail + Passwort über Supabase Auth
export const AUTH_MODE = 'name';
