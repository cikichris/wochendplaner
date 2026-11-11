// Gemeinsamer Supabase-Client für die ganze App.
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.3/+esm';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './config.js';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    // Für den späteren E-Mail-Login: Sitzung im Browser merken.
    persistSession: true,
    autoRefreshToken: true,
  },
  realtime: { params: { eventsPerSecond: 10 } },
});
