// =====================================================================
//  Identität / Login
//
//  Die restliche App kennt nur diese Funktionen:
//    getCurrentUser()   -> { id, name } oder null
//    signIn({ name })   -> speichert den Nutzer
//    signOut()          -> vergisst den Nutzer
//    onAuthChange(cb)   -> cb(user) bei jeder Änderung
//
//  Heute (AUTH_MODE = 'name'): Es gibt keinen echten Login, nur einen
//  Anzeigenamen im localStorage.
//
//  Login per E-Mail + Passwort nachrüsten:
//    1. In Supabase unter Authentication > Providers "Email" aktivieren
//       und die beiden Nutzer anlegen.
//    2. AUTH_MODE in config.js auf 'email' stellen.
//    3. Die mit "TODO email" markierten Stellen unten ausfüllen
//       (supabase.auth.signInWithPassword / signOut / onAuthStateChange)
//       und im Dialog in index.html Felder für E-Mail + Passwort ergänzen.
//    4. Den "anon"-Zugang in der Datenbank schließen (siehe Ende von
//       supabase/schema.sql).
// =====================================================================
import { AUTH_MODE } from './config.js';
// import { supabase } from './supabase-client.js'; // TODO email

const NAME_KEY = 'wochenendplaner.name';
const listeners = new Set();
let currentUser = null;

function readName() {
  try { return localStorage.getItem(NAME_KEY) || ''; } catch { return ''; }
}
function writeName(name) {
  try {
    if (name) localStorage.setItem(NAME_KEY, name);
    else localStorage.removeItem(NAME_KEY);
  } catch { /* privater Modus: Name gilt nur für diese Sitzung */ }
}
function emit() { listeners.forEach((cb) => cb(currentUser)); }

/** Lädt den gespeicherten Nutzer (beim App-Start einmal aufrufen). */
export async function initAuth() {
  if (AUTH_MODE === 'email') {
    // TODO email:
    // const { data } = await supabase.auth.getSession();
    // const u = data.session?.user;
    // currentUser = u ? { id: u.id, name: u.user_metadata?.name || u.email } : null;
    // supabase.auth.onAuthStateChange((_e, session) => { ...; emit(); });
    throw new Error('E-Mail-Login ist noch nicht eingebaut.');
  }
  const name = readName();
  currentUser = name ? { id: null, name } : null;
  return currentUser;
}

export function getCurrentUser() { return currentUser; }

/** Heute: { name }. Später: { email, password }. */
export async function signIn({ name }) {
  if (AUTH_MODE === 'email') {
    // TODO email: await supabase.auth.signInWithPassword({ email, password });
    throw new Error('E-Mail-Login ist noch nicht eingebaut.');
  }
  const clean = String(name || '').trim().slice(0, 40);
  if (!clean) throw new Error('Bitte einen Namen eingeben.');
  writeName(clean);
  currentUser = { id: null, name: clean };
  emit();
  return currentUser;
}

export async function signOut() {
  // TODO email: await supabase.auth.signOut();
  writeName('');
  currentUser = null;
  emit();
}

export function onAuthChange(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
