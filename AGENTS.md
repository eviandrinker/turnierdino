# AGENTS.md – Regeln und Projektinformationen für KI-Agenten

## Projekt

**Turnierdino** ist ein Turnier-Manager für Plauschturniere (Grümpel-, Unihockey-, Jassturniere), entwickelt als Einzelprojekt im Modul Prototyping (ZHAW).

- **Zielgruppe:** ehrenamtliche Organisator:innen ohne Technik-Erfahrung; dazu Teams und Zuschauer:innen, die am Turniertag auf dem Handy Spielplan und Tabelle sehen
- **Hauptworkflow:** Turnier erstellen (1/3 Allgemein → 2/3 Teams → 3/3 Ablauf) → Spielplan erstellen → Resultate pro Spieltag eintragen → Live-Tabelle → Turniersieger
- **Weitere Workflows:** Turnier beitreten per Code, Turnier suchen, Meine Turniere, Login/Registrierung
- **Referenz:** klickbares Mockup unter `docs/mockup/`. Abweichungen sind erlaubt, wenn sie begründet sind.

## Technik

- **SvelteKit 3.4** mit **Svelte 5 (Runes:** `$state`, `$derived`, `$props`**)**, **JavaScript** (kein TypeScript)
- Konventionen von SvelteKit 3 verwenden, nicht von SvelteKit 2:
  - Imports aus `src/lib` über `#lib/…` (nicht `$lib`)
  - Umgebungsvariablen in `src/env.js` mit `defineEnvVars` deklarieren und aus `$app/env/private` importieren (nicht `$env/…`)
  - Konfiguration in `vite.config.js` (es gibt keine `svelte.config.js`)
- **MongoDB Atlas** über den offiziellen Treiber `mongodb`; Zugriff nur in `src/lib/server/`
- **Deployment:** Netlify mit `@sveltejs/adapter-netlify` als Node-Function (`edge: false`, weil der MongoDB-Treiber Node braucht)
- **Tests:** `node:test` ohne zusätzliche Pakete

## Befehle

```bash
npm run dev                  # Dev-Server, http://localhost:5173
npm run build                # Produktionsbuild
node --test tests/*.test.js  # alle Tests
```

## Struktur

| Ordner | Inhalt |
|---|---|
| `src/routes/` | Seiten, Form Actions und API-Routen (`src/routes/api/…`) |
| `src/lib/` | reine Funktionen (Regeln, Validierung, Berechnungen), von Browser und Server genutzt, ohne DB-Zugriff |
| `src/lib/server/` | Datenbank (`db.js`), Auth, Berechtigungen, Spielplan- und Resultatlogik |
| `src/lib/components/` | wiederverwendbare Svelte-Komponenten |
| `tests/` | automatisierte Tests (`*.test.js`) |
| `docs/` | Mockup, Artefakte, KI-Einsatz-Protokoll |

## Datenmodell (Collections)

- `tournaments`: Name, Modus (`liga` | `gruppen_ko` | `ko`), Teamzahl, Gruppen, Ablauf, Status (`Entwurf` | `Bereit` | `Läuft` | `Abgeschlossen`), `ownerId`, `teamEntry`, `joinCode`, `currentRound`
- `teams`: `tournamentId`, Name, Gruppe, `registeredBy`
- `matches`: `tournamentId`, Nummer, Phase, Gruppe, Runde, Teams, Herkunft (bei K.-o.), Zeit, Feld, Resultat, Status
- `users`, `sessions`
- Die Tabelle wird **nie gespeichert**, sondern immer aus `matches` berechnet (`src/lib/standings.js`)

## Regeln

### Verboten
- **Kein Playwright**, keine E2E-Tests, keine Browser-Testframeworks installieren oder konfigurieren
- **Keine neuen Pakete** ohne ausdrückliche Rückfrage
- **Keine Zugangsdaten im Code** oder in Commits: nur in `.env` (lokal) bzw. in Netlify; `.env.example` ohne echte Werte
- **Nicht committen, nicht pushen, nicht deployen** – das macht der Entwickler nach eigenem Test

### Code
- Fachliche Regeln als **reine Funktionen** in `src/lib` und mit `node:test` testen; Formular und Server nutzen dieselbe Funktion
- **Server prüft immer:** Validierung und Berechtigung (Besitzer) bei jeder Änderung, auch wenn die Oberfläche schon prüft
- Öffentliche Daten (Suche, offene Turniere) enthalten **nie** `joinCode`, `ownerId` oder andere Benutzer-IDs
- Änderungen am Turnier in **Transaktionen** (Atlas ist ein Replica Set)
- Benutzereingaben in Suchabfragen escapen, keine ungeprüften RegExp

### Oberfläche
- Alle Texte auf **Deutsch** mit Schweizer Rechtschreibung (ss statt ß)
- Stil: schwarz-weiss, eckige Buttons und Felder (`border-radius: 0`), viel Weissraum, Systemschrift; Grün/Rot nur für Team hinzufügen/entfernen
- **Mobile-first**, Touch-Flächen mind. 44 px, sichtbarer Tastaturfokus
- Feedback bei jeder Aktion: Fehler direkt beim Feld, Erfolgsmeldungen, leere Zustände mit Hinweis

### Arbeitsweise
- Für jede Code-Änderung den Ablauf im Skill **`aenderung-umsetzen`** befolgen (`.claude/skills/aenderung-umsetzen/SKILL.md`)
- Bei grösseren Aufträgen nach den genannten Haltepunkten **anhalten** und berichten
- Nach jedem Auftrag: geänderte Dateien kurz erklären, ehrlich angeben, was **nicht** getestet wurde (z. B. echte Datenbank, Browser), und eine **Commit-Message** im Stil Conventional Commits vorschlagen (`feat:`, `fix:`, `chore:`)
- Bei Unsicherheit über SvelteKit-3-Syntax die installierte Version in `node_modules/@sveltejs/kit` prüfen statt zu raten
