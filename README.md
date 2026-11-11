# Wochenendplaner

Eine kleine Web-App, mit der wir unsere Wochenenden gemeinsam planen.

- **Übersicht aller Wochenenden** (Freitag, Samstag, Sonntag) von heute bis 31.12.2026, nach Monaten gruppiert. Das aktuelle Wochenende steht oben und ist farbig hervorgehoben.
- **Aktivitäten pro Tag:** hinzufügen, bearbeiten, löschen und abhaken. Felder: Titel, Uhrzeit (optional), Ort (optional), Notiz (optional). „Eingetragen von“ wird automatisch ausgefüllt.
- **Ideensammlung & Vorschläge:** Aktivitäten ohne Datum (z. B. „Therme besuchen“). Mit **Einplanen** ordnest du eine Idee einem Freitag, Samstag oder Sonntag zu. Sie verschwindet dann aus der Sammlung. Umgekehrt geht es auch: Eine geplante Aktivität öffnen und **In die Ideensammlung** antippen.
- **Live:** Änderungen erscheinen sofort beim anderen (grüner Punkt oben = Live-Verbindung steht).
- Für das Handy gebaut, mit Hell- und Dunkel-Modus, und lässt sich auf dem iPhone zum Home-Bildschirm hinzufügen.

---

## Schritt-für-Schritt-Anleitung (komplett im Handy-Browser)

Du brauchst dafür etwa 10 Minuten. Arbeite die Teile **der Reihe nach** ab.

> **Tipp:** Die Links unten kannst du direkt antippen. Wenn eine Seite nach einer Anmeldung fragt, melde dich mit deinem GitHub- bzw. Supabase-Konto an und tippe danach den Link noch einmal an.

### Teil 1: Den Code in den Hauptzweig („main“) übernehmen

Der Code liegt im Moment auf einem eigenen Zweig (Branch) namens `claude/github-wochenendplaner-connect-81339d`. GitHub Pages soll später den Zweig `main` veröffentlichen. Darum übernimmst du die Änderungen zuerst mit einem „Pull Request“ nach `main`.

1. Öffne diesen Link:
   **https://github.com/cikichris/wochendplaner/compare/main...claude/github-wochenendplaner-connect-81339d**
2. Du siehst oben „Comparing changes“ und darunter die geänderten Dateien. Tippe auf den grünen Knopf **„Create pull request“**.
3. Es erscheint ein Formular mit Titel und Beschreibung. Du musst nichts ändern. Tippe unten noch einmal auf den grünen Knopf **„Create pull request“**.
4. Scrolle auf der neuen Seite nach unten bis zum grünen Knopf **„Merge pull request“** und tippe darauf.
5. Tippe auf **„Confirm merge“**.
6. Es erscheint ein lila Hinweis **„Merged“**. Fertig! Der Code ist jetzt in `main`.

> Wenn in Schritt 2 statt des Knopfes „There isn't anything to compare“ steht, ist der Code schon in `main`. Dann einfach mit Teil 2 weitermachen.

### Teil 2: Die Datenbank in Supabase einrichten

#### 2a: Den SQL-Code kopieren

1. Öffne diesen Link:
   **https://raw.githubusercontent.com/cikichris/wochendplaner/main/supabase/schema.sql**
   Du siehst jetzt reinen Text, der mit `-- ====` beginnt.
2. **Halte den Finger lange auf den Text**, bis ein kleines Menü erscheint.
3. Tippe auf **„Alles auswählen“**. Der ganze Text ist jetzt blau markiert.
4. Tippe im Menü auf **„Kopieren“**.

> Alternative: Öffne https://github.com/cikichris/wochendplaner/blob/main/supabase/schema.sql. Oben rechts über dem Code gibt es ein Symbol mit zwei Rechtecken („Copy raw file“). Ein Tipp darauf kopiert alles.

#### 2b: Den SQL-Code in Supabase ausführen

1. Öffne diesen Link (er führt direkt zu einer neuen, leeren SQL-Abfrage in deinem Projekt):
   **https://supabase.com/dashboard/project/lykicisycncpeuvaczhe/sql/new**
2. Melde dich an, falls Supabase danach fragt. Öffne den Link danach noch einmal.
3. Du siehst den **SQL Editor**: ein großes Textfeld (oft steht dort schon ein Kommentar oder Beispieltext).
   - Steht schon Text im Feld: Tippe hinein, **halte den Finger lange gedrückt**, wähle **„Alles auswählen“** und dann **„Ausschneiden“** oder tippe die Löschtaste. Das Feld muss leer sein.
4. Tippe in das leere Feld, **halte den Finger lange gedrückt** und tippe auf **„Einsetzen“**. Jetzt steht der kopierte SQL-Code im Feld.
5. Tippe auf den grünen Knopf **„Run“** (unten rechts am Editor, manchmal auch oben rechts; auf manchen Handys zuerst das Feld verlassen, damit die Tastatur verschwindet).
6. Eventuell erscheint die Warnung **„Potential issue detected“** oder **„destructive operation“**. Das ist normal, weil das Skript alte Regeln vor dem Neuanlegen löscht. Tippe auf **„Run this query“**.
7. Unten im Ergebnisbereich sollte **„Success. No rows returned“** stehen. 🎉

**Kontrolle (optional):** Öffne https://supabase.com/dashboard/project/lykicisycncpeuvaczhe/editor. In der Liste der Tabellen sollte jetzt **activities** auftauchen.

> Das Skript darf beliebig oft ausgeführt werden. Es macht nichts kaputt und löscht keine Einträge.

### Teil 3: Die Website mit GitHub Pages veröffentlichen

1. Öffne diesen Link:
   **https://github.com/cikichris/wochendplaner/settings/pages**
2. Du siehst die Seite **„GitHub Pages“**. Suche den Abschnitt **„Build and deployment“**.
3. Unter **„Source“** muss **„Deploy from a branch“** ausgewählt sein. Falls nicht: Antippen und **„Deploy from a branch“** wählen.
4. Darunter unter **„Branch“** steht ein Knopf **„None“**. Tippe darauf und wähle **„main“**.
5. Daneben erscheint ein zweiter Knopf mit **„/ (root)“**. Den so lassen.
6. Tippe auf **„Save“**.
7. Warte **1–2 Minuten** und lade die Seite dann neu (Seite nach unten ziehen oder auf das Neu-laden-Symbol tippen). Oben erscheint jetzt:
   **„Your site is live at https://cikichris.github.io/wochendplaner/“**
8. Tippe auf **„Visit site“** oder öffne direkt **https://cikichris.github.io/wochendplaner/**

> **Hinweis:** Erscheint statt der Einstellungen der Hinweis **„Upgrade or make this repository public to enable Pages“**, ist dein Repository privat. Mit einem kostenlosen GitHub-Konto funktioniert Pages nur bei öffentlichen Repositories. So machst du es öffentlich: https://github.com/cikichris/wochendplaner/settings öffnen → ganz nach unten zur roten **„Danger Zone“** scrollen → **„Change visibility“** → **„Change to public“** → bestätigen. Danach Teil 3 wiederholen. (Im Code steht nur der öffentliche „Publishable Key“. Eure Einträge liegen in Supabase, nicht auf GitHub.)

### Teil 4: Die App benutzen und aufs iPhone legen

1. Öffne **https://cikichris.github.io/wochendplaner/** in **Safari**.
2. Beim ersten Öffnen fragt die App **„Hallo! Wer bist du?“**. Tippe auf **„Ich bin Chris“** oder tippe einen anderen Namen ein und dann auf **„Weiter“**.
3. **Zum Home-Bildschirm hinzufügen:**
   1. Tippe unten in Safari auf das **Teilen-Symbol** (Quadrat mit Pfeil nach oben). Bei neueren iOS-Versionen erst auf **„…“** und dann auf **„Teilen“**.
   2. Scrolle im Menü nach unten und tippe auf **„Zum Home-Bildschirm“**.
   3. Tippe oben rechts auf **„Hinzufügen“**.
   4. Auf dem Home-Bildschirm erscheint jetzt das Icon **„Wochenende“** (Kalender mit Herz). Ab jetzt öffnet sich die App ohne Browser-Leiste.
4. **Deiner Freundin den Link schicken:** `https://cikichris.github.io/wochendplaner/`. Sie gibt beim ersten Öffnen ihren eigenen Namen ein und kann die App genauso zum Home-Bildschirm hinzufügen.

---

## So funktioniert die App

| Was | Wie |
| --- | --- |
| Aktivität hinzufügen | Beim Tag auf **„+ Neu“** tippen |
| Aktivität bearbeiten | Auf die Aktivität tippen |
| Abhaken | Auf das Kästchen links tippen |
| Löschen | Aktivität öffnen → **Löschen** → zur Sicherheit noch einmal tippen |
| Auf anderen Tag verschieben | Aktivität öffnen → **Auf anderen Tag verschieben** |
| Zurück in die Ideensammlung | Aktivität öffnen → **In die Ideensammlung** |
| Idee anlegen | Unten auf **Ideen** → **Idee hinzufügen** |
| Idee einplanen | Bei der Idee auf **Einplanen** → Tag antippen |
| Hell/Dunkel | Oben rechts auf das Kreis-Symbol tippen (automatisch → hell → dunkel) |
| Namen ändern | Oben auf deinen Namen tippen |

## Hilfe bei Problemen

- **Roter Hinweis „Datenbank noch nicht eingerichtet“:** Teil 2 wurde noch nicht (vollständig) ausgeführt. Bitte wiederholen und die Seite neu laden.
- **Der Punkt oben ist grau statt grün:** Die Live-Verbindung steht gerade nicht (z. B. kein Internet). Die App verbindet sich automatisch neu und lädt beim Zurückkehren in die App alles neu.
- **Die Seite zeigt „404“:** GitHub Pages braucht nach dem Einschalten ein paar Minuten. Später noch einmal versuchen. Prüfen, ob in Teil 3 wirklich `main` und `/ (root)` gespeichert sind.
- **Nach einer Code-Änderung sieht die App noch alt aus:** Die App einmal komplett schließen und neu öffnen bzw. in Safari die Seite neu laden.

## Wichtig zur Sicherheit

Es gibt **noch keinen Login**. Jeder, der den Link kennt, kann die Einträge lesen und ändern. Teilt den Link also nur miteinander.

## Technik (für später)

- Reines HTML, CSS und JavaScript **ohne Build-Schritt**. `supabase-js` wird per CDN geladen.
- Alle Website-Dateien liegen im Hauptverzeichnis:

  | Datei | Inhalt |
  | --- | --- |
  | `index.html` | Seitengerüst und Dialoge |
  | `styles.css` | Aussehen inkl. Hell-/Dunkel-Modus |
  | `config.js` | Supabase-URL, Publishable Key, Enddatum (`END_DATE`), Namensvorschläge |
  | `app.js` | Oberfläche und Abläufe |
  | `api.js` | Alle Datenbankzugriffe + Realtime |
  | `auth.js` | Wer ist angemeldet? (heute: Name im Browser) |
  | `dates.js` | Berechnung der Wochenenden, Datumsformate |
  | `supabase-client.js` | Supabase-Verbindung |
  | `manifest.webmanifest`, `icon*.png`, `icon.svg`, `apple-touch-icon.png` | Home-Bildschirm-App |
  | `supabase/schema.sql` | Tabelle, GRANTs, RLS-Regeln, Realtime |

- **Datenmodell:** Eine Tabelle `activities`. Eine Zeile mit `day = Datum` ist eine geplante Aktivität, `day = NULL` ist eine Idee. Einplanen und Zurückschieben ändern nur `day`.
- **Später Login per E-Mail + Passwort nachrüsten:** Die App fragt den Nutzer nur über `auth.js` ab (`initAuth`, `getCurrentUser`, `signIn`, `signOut`). Dort sind die Stellen mit `TODO email` markiert. Die Tabelle hat schon eine Spalte `user_id` (wird automatisch mit `auth.uid()` gefüllt), und am Ende von `supabase/schema.sql` steht, wie man den offenen Zugang für `anon` wieder schließt.
- **Länger planen:** In `config.js` den Wert `END_DATE` ändern (z. B. `'2027-12-31'`).
- **Lokal testen (am Computer):** Im Ordner `python3 -m http.server` ausführen und http://localhost:8000 öffnen.
