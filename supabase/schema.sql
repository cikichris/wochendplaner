-- =====================================================================
--  Wochenendplaner – Datenbank-Schema für Supabase
--  Komplett in den SQL-Editor von Supabase einfügen und auf "Run" tippen.
--  Das Skript kann gefahrlos mehrfach ausgeführt werden.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Tabelle "activities"
--    Eine Zeile ist entweder
--      * eine geplante Aktivität  (day = Datum des Tages) oder
--      * eine Idee/Vorschlag      (day = NULL)
--    Dadurch ist "Idee einplanen" bzw. "zurück in die Ideensammlung"
--    nur ein Update der Spalte "day".
-- ---------------------------------------------------------------------
create table if not exists public.activities (
  id          uuid primary key default gen_random_uuid(),
  day         date,                                  -- NULL = Ideensammlung
  title       text not null check (char_length(trim(title)) > 0),
  start_time  time,                                  -- optionale Uhrzeit
  location    text,                                  -- optionaler Ort
  note        text,                                  -- optionale Notiz
  done        boolean not null default false,        -- abgehakt?
  created_by  text not null default 'Unbekannt',     -- "eingetragen von" (Anzeigename)
  user_id     uuid default auth.uid(),               -- für späteren Login (heute noch NULL)
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists activities_day_idx on public.activities (day);

-- "updated_at" automatisch aktualisieren
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists activities_set_updated_at on public.activities;
create trigger activities_set_updated_at
  before update on public.activities
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 2) Freigabe für die Data API (GRANTs)
--    Neue Supabase-Projekte geben Tabellen nicht mehr automatisch frei.
--    "anon"          = jeder mit dem Link (aktuell, ohne Login)
--    "authenticated" = eingeloggte Nutzer (für den späteren Login)
-- ---------------------------------------------------------------------
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on table public.activities to anon;
grant select, insert, update, delete on table public.activities to authenticated;

-- ---------------------------------------------------------------------
-- 3) Row Level Security (RLS)
--    RLS ist aktiv, die Regeln erlauben aber vorerst allen alles.
-- ---------------------------------------------------------------------
alter table public.activities enable row level security;

drop policy if exists "anon_select_activities" on public.activities;
drop policy if exists "anon_insert_activities" on public.activities;
drop policy if exists "anon_update_activities" on public.activities;
drop policy if exists "anon_delete_activities" on public.activities;

create policy "anon_select_activities" on public.activities
  for select to anon using (true);
create policy "anon_insert_activities" on public.activities
  for insert to anon with check (true);
create policy "anon_update_activities" on public.activities
  for update to anon using (true) with check (true);
create policy "anon_delete_activities" on public.activities
  for delete to anon using (true);

-- Eingeloggte Nutzer dürfen ebenfalls alles (schadet heute nicht und
-- funktioniert sofort, sobald der Login nachgerüstet wird).
drop policy if exists "auth_all_activities" on public.activities;
create policy "auth_all_activities" on public.activities
  for all to authenticated using (true) with check (true);

-- ---------------------------------------------------------------------
-- 4) Realtime aktivieren (Änderungen erscheinen live beim anderen)
-- ---------------------------------------------------------------------
alter table public.activities replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'activities'
  ) then
    alter publication supabase_realtime add table public.activities;
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- 5) API-Schema-Cache neu laden, damit die Tabelle sofort erreichbar ist
-- ---------------------------------------------------------------------
notify pgrst, 'reload schema';

-- =====================================================================
--  SPÄTER: Login per E-Mail + Passwort nachrüsten
--  Wenn der Login eingebaut ist, den offenen Zugang für "anon" schließen:
--
--    drop policy if exists "anon_select_activities" on public.activities;
--    drop policy if exists "anon_insert_activities" on public.activities;
--    drop policy if exists "anon_update_activities" on public.activities;
--    drop policy if exists "anon_delete_activities" on public.activities;
--    revoke select, insert, update, delete on table public.activities from anon;
--
--  Danach dürfen nur noch eingeloggte Nutzer lesen und schreiben.
-- =====================================================================
