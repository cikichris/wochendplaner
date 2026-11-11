-- =====================================================================
--  Wochenendplaner – Datenbank-Schema für Supabase
--  Komplett in den SQL-Editor von Supabase einfügen und auf "Run" tippen.
--  Das Skript kann gefahrlos mehrfach ausgeführt werden – vorhandene
--  Einträge und Fotos bleiben dabei erhalten.
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

-- Erweiterungen (Update "Persönliche Termine & Foto-Challenge").
-- Fügt die Spalten nur hinzu, wenn sie noch fehlen – Einträge bleiben erhalten.
alter table public.activities add column if not exists owner text;          -- NULL = gemeinsam, sonst Name der Person ("Nur ich")
alter table public.activities add column if not exists is_fixed boolean not null default false;   -- 📌 Fixtermin
alter table public.activities add column if not exists end_time time;       -- optionales Ende
alter table public.activities add column if not exists photo_skipped boolean not null default false; -- "ohne Foto abgeschlossen"
alter table public.activities add column if not exists category text;       -- Kategorie, z. B. 'pferde' (Liste in config.js)

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
-- 4) Tabelle "photos": Fotos zu einzelnen Aktivitäten
--    Die Bilddateien selbst liegen im Storage-Bucket "photos" (siehe 5).
--    Wird eine Aktivität gelöscht, verschwinden auch ihre Foto-Einträge.
-- ---------------------------------------------------------------------
create table if not exists public.photos (
  id            uuid primary key default gen_random_uuid(),
  activity_id   uuid not null references public.activities (id) on delete cascade,
  storage_path  text not null,                        -- große Version
  thumb_path    text not null,                        -- kleine Vorschau
  width         integer,
  height        integer,
  created_by    text not null default 'Unbekannt',
  user_id       uuid default auth.uid(),
  created_at    timestamptz not null default now()
);

create index if not exists photos_activity_idx on public.photos (activity_id);

grant select, insert, update, delete on table public.photos to anon;
grant select, insert, update, delete on table public.photos to authenticated;

alter table public.photos enable row level security;

drop policy if exists "anon_select_photos" on public.photos;
drop policy if exists "anon_insert_photos" on public.photos;
drop policy if exists "anon_update_photos" on public.photos;
drop policy if exists "anon_delete_photos" on public.photos;
drop policy if exists "auth_all_photos" on public.photos;

create policy "anon_select_photos" on public.photos
  for select to anon using (true);
create policy "anon_insert_photos" on public.photos
  for insert to anon with check (true);
create policy "anon_update_photos" on public.photos
  for update to anon using (true) with check (true);
create policy "anon_delete_photos" on public.photos
  for delete to anon using (true);
create policy "auth_all_photos" on public.photos
  for all to authenticated using (true) with check (true);

-- ---------------------------------------------------------------------
-- 5) Storage-Bucket "photos" für die Bilddateien (max. 10 MB pro Bild)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', true, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "photos_bucket_select" on storage.objects;
drop policy if exists "photos_bucket_insert" on storage.objects;
drop policy if exists "photos_bucket_update" on storage.objects;
drop policy if exists "photos_bucket_delete" on storage.objects;

create policy "photos_bucket_select" on storage.objects
  for select to anon, authenticated using (bucket_id = 'photos');
create policy "photos_bucket_insert" on storage.objects
  for insert to anon, authenticated with check (bucket_id = 'photos');
create policy "photos_bucket_update" on storage.objects
  for update to anon, authenticated using (bucket_id = 'photos') with check (bucket_id = 'photos');
create policy "photos_bucket_delete" on storage.objects
  for delete to anon, authenticated using (bucket_id = 'photos');

-- ---------------------------------------------------------------------
-- 6) Realtime aktivieren (Änderungen erscheinen live beim anderen)
-- ---------------------------------------------------------------------
alter table public.activities replica identity full;
alter table public.photos replica identity full;

do $$
declare
  t text;
begin
  foreach t in array array['activities', 'photos'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
-- 7) API-Schema-Cache neu laden, damit die Tabellen sofort erreichbar sind
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
--    (dasselbe für die Tabelle public.photos mit den *_photos-Policies)
--    und bei den Storage-Policies "photos_bucket_*" die Rolle anon entfernen
--    sowie den Bucket auf privat stellen (public = false, Signed URLs nutzen).
--
--  Danach dürfen nur noch eingeloggte Nutzer lesen und schreiben.
-- =====================================================================
