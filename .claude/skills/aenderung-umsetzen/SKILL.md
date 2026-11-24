---
name: aenderung-umsetzen
description: Fester Ablauf für jede Code-Änderung in Turnierdino. Verwenden bei neuer Funktion, Umbau einer Seite, Aufteilen in Komponenten oder Fehlerbehebung.
---

# Änderung umsetzen

## Warum es diesen Skill gibt

- **Grosse Aufträge brachen ab.** Deshalb gibt es Haltepunkte: nach dem ersten funktionsfähigen Teilschritt anhalten und berichten.
- **Ungefragte Änderungen** (z. B. Anpassungen an Playwright-Tests, die niemand verlangt hatte). Deshalb gilt: nur ändern, was zum Auftrag gehört.
- **Der Agent kann nicht mit der echten Datenbank und nicht im Browser testen.** Deshalb muss der Bericht ehrlich angeben, was nicht getestet wurde.

Hintergrund und konkrete Situationen: `docs/ki-einsatz.md`.

## Ablauf

### 1. Vorbereiten

- `AGENTS.md` lesen und einhalten.
- Betroffene Dateien **vor** dem Ändern lesen, nicht aus der Erinnerung ändern.
- Bei Unklarheit über SvelteKit-3-Syntax die installierte Version in `node_modules/@sveltejs/kit` prüfen statt zu raten.
- Kurz den Plan nennen: welche Dateien, welche Schritte.

### 2. Umsetzen in kleinen Schritten

- Fachliche Regeln als **reine Funktionen** in `src/lib` (ohne DB-Zugriff), damit sie mit `node:test` testbar sind.
- Der **Server prüft immer** Validierung und Berechtigung, auch wenn die Oberfläche schon prüft.
- Wiederverwendbare Oberfläche als Komponente in `src/lib/components` mit `$props()`.
- **Nur ändern, was zum Auftrag gehört.** Was sonst auffällt, im Bericht erwähnen statt ändern.
- **Bei Refactoring** bleiben Verhalten, Texte und Aussehen gleich.

### 3. Haltepunkt

Nach dem **ersten funktionsfähigen Teilschritt** anhalten, berichten (Format unten) und auf Rückmeldung warten – **bei Aufträgen mit mehreren Teilen oder wenn der Auftrag Haltepunkte nennt**. Kleine, einzelne Änderungen dürfen ohne Haltepunkt abgeschlossen werden.

### 4. Prüfen

Beide Befehle müssen ohne Fehler durchlaufen:

```bash
node --test tests/*.test.js
npm run build
```

Schlägt etwas fehl: beheben oder im Bericht mit der Fehlermeldung angeben, nie verschweigen.

### 5. Bericht

Immer in diesem Format:

- **Umgesetzt:** geänderte und neue Dateien, je ein kurzer Satz
- **Geprüft:** was tatsächlich gelaufen ist (Tests mit Anzahl, Build)
- **Nicht getestet – bitte selbst prüfen:** z. B. mit echter Datenbank, im Browser, auf dem Handy, Tastaturbedienung
- **Aufgefallen, aber nicht geändert:** Probleme ausserhalb des Auftrags
- **Commit-Vorschlag:** im Stil Conventional Commits mit Typ `feat`, `fix`, `refactor`, `docs` oder `chore`

### 6. Nicht selbst committen, pushen oder deployen

Das macht der Entwickler nach eigenem Test.
