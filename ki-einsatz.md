# KI-Einsatz – laufendes Protokoll

Grundlage für Kapitel 6 «KI-Deklaration» der README. Wird laufend ergänzt.

> _Entwurf: Formulierungen in eigenen Worten anpassen, TODO-Stellen ergänzen._

## Eingesetzte Tools

| Tool | Modell / Variante | Wofür |
|---|---|---|
| Claude (Anthropic), Chat | Claude Opus 5.5 | Ideenfindung, Recherche, Aufträge für die Coding-Agenten formulieren, Fehlersuche, Textentwürfe (Abgaben, README) |
| OpenAI Codex in VS Code | GPT-6 Astra, Stufe light | Implementierung |
| Claude Code | Claude Opus 5.5, Stufe medium | Implementierung, hat abgebrochene Arbeit von Codex fortgesetzt |
| ChatGPT (chatgpt.com) | GPT-6, Bildgenerierung | Dino-Logo |
## KI nach Phase

| Phase | KI eingesetzt? | Wie |
|---|---|---|
| Understand & Define (Woche 8) | ja | Ideen besprochen, Recherche zu bestehenden Tools, Entwurf der Abgabe; Problemräume und Wahl des Themas von mir |
| Sketch / Mockup (Woche 9–10) | **bewusst nein** | Mockup selbst in PowerPoint erstellt (laut Übung keine KI-Funktionen); nur der Begleittext (Designentscheide, Workflow-Diagramme) mit Claude ausformuliert |
| Prototype (Woche 11 ff.) | ja | Code grösstenteils von Coding-Agenten; Aufträge, Reihenfolge, Produktentscheide und Tests von mir |
| Dokumentation | ja | README-Entwurf mit Claude, von mir geprüft und ergänzt |
| Validate (Woche 14) | _TODO_ | _TODO_ |

## Arbeitsweise mit den Coding-Agenten

1. Pro Funktion einen Auftrag formulieren (mit Hilfe von Claude): Kontext, Datenmodell, Regeln, Seiten, Stil, Tests, Haltepunkte
2. Agent arbeitet; er darf Dateien ändern sowie Tests und Build ausführen, aber **nicht committen oder deployen**
3. Bericht lesen: Was wurde geändert, was **nicht** getestet?
4. Selbst im Browser testen (Desktop und Handy-Ansicht) und Daten in MongoDB Compass kontrollieren
5. Erst dann committen und pushen

**Warum so:** Die Agenten haben keinen Zugriff auf meine echte Datenbank und haben die Oberfläche meist nicht im Browser angeschaut. Ohne eigenen Test wären Fehler unbemerkt in die Commits gekommen. Ein Commit pro Funktion macht die Arbeitsweise im Repository nachvollziehbar.

## Konkrete Situationen

### Ideenfindung: KI-Vorschlag hielt der Recherche nicht stand (Woche 8)
- **Situation:** Claude schlug als Nische vor: «Turnier in 5 Minuten, ohne Account, QR-Code für Zuschauer».
- **Problem:** Die anschliessende Recherche zeigte, dass genau das bereits existiert (TurnierBuilder).
- **Reaktion:** Vorschlag verworfen; die Lücken als Hypothesen formuliert, die noch zu prüfen sind (Gratis-Limit 8 Teams, App-Installation, Plausch-Elemente).
- **Lehre:** KI-Aussagen über den Markt immer mit echten Quellen prüfen.

### Erster Implementierungsversuch verworfen (18.11.)
- **Situation:** Erste Version entstand vor dem fertigen Mockup und wich davon ab (ein langes Formular statt Wizard, getrennte Seiten statt Turnier-Ansicht).
- **Reaktion:** Neu begonnen und das Mockup als Vorgabe in jeden Auftrag aufgenommen.
- **Lehre:** Erst Mockup, dann Code – sonst baut der Agent «irgendetwas Sinnvolles», aber nicht das Geplante.

### Agent arbeitete ungefragt an Playwright
- **Situation:** Beim Umbau der Startseite passte der Agent auch Playwright-Tests an, brach das dann ab und stellte die Testdatei wieder her. Ich wollte keine E2E-Tests.
- **Reaktion:** Playwright komplett entfernt und eine Regel in `AGENTS.md` aufgenommen; jeder Auftrag verweist seither darauf.
- **Beleg:** Commit «feat: Turniererstellung Schritt 1 umsetzen, Playwright entfernen und AGENTS.md ergänzen», `AGENTS.md`

### Veraltete Syntax: SvelteKit 2 statt 3
- **Situation:** Der von Claude vorgeschlagene Code für die DB-Verbindung nutzte `$env/static/private` (SvelteKit 2). Installiert war SvelteKit 3.4.
- **Reaktion:** In der offiziellen Dokumentation nachgeschaut: In SvelteKit 3 werden Variablen in `src/env.js` mit `defineEnvVars` deklariert und aus `$app/env/private` importiert. Code angepasst, Regel in `AGENTS.md` ergänzt.
- **Lehre:** Bei neuen Versionen kennt die KI die Syntax nicht sicher – Dokumentation prüfen.

### Dev-Server hing – Ursache war nicht der Code
- **Situation:** `npm run dev` startete nicht, ohne Fehlermeldung. Die Fehlersuche mit Claude dauerte lange (Node-Version, `env.js`, Debug-Ausgabe).
- **Ursache:** Das Projekt lag im iCloud-synchronisierten Schreibtisch bzw. Dokumente-Ordner; macOS verweigerte dem Terminal den Zugriff (`Operation not permitted`).
- **Reaktion:** Projekt nach `~/Projekte` verschoben – danach lief alles.
- **Lehre:** Die KI suchte zuerst im Code; den entscheidenden Hinweis lieferte erst eine echte Fehlermeldung des Systems.

### Agent brach bei grossem Auftrag ab
- **Situation:** Beim Auftrag «Spieltage, automatisches Speichern, Live-Tabelle» hörte der Agent mittendrin auf und meldete offene Punkte.
- **Reaktion:** Zwischenstand gesichert, Rest in Teilschritte mit Haltepunkt nach Punkt 3 aufgeteilt; Hauptfunktion nach dem Haltepunkt im Browser getestet, dann den Rest fertigstellen lassen.
- **Lehre:** Grosse Aufträge von Anfang an aufteilen; seither enthält jeder Auftrag Haltepunkte.

### Agentenwechsel: Codex brach ab, zweiter Agent machte weiter
- **Situation:** Bei «Turnier beitreten» brach Codex ab. _TODO: zweiter Agent_ übernahm, prüfte den vorhandenen Stand und ergänzte die fehlenden Teile.
- **Beobachtung:** Der zweite Agent gab offen an, was die Tests **nicht** abdecken (API-Endpunkt, gleichzeitige Anmeldungen).
- **Reaktion:** Diese Punkte selbst mit zwei Konten im Browser getestet.

### «Keine Einträge in der Datenbank»
- **Situation:** Nach einem Test fand ich die Turniere nicht in Compass und vermutete einen Fehler im Code.
- **Ursache:** Compass zeigte die neue Collection erst nach «Aktualisieren».
- **Lehre:** Eigene Prüfung ist nötig, aber auch die Prüfwerkzeuge muss man richtig bedienen.

### Gestaltung iterativ mit Screenshots
- **Situation:** Die Turnier-Ansicht hatte zuerst zu viel Weissraum (Scrollen nötig), nach der Korrektur war sie zu kompakt.
- **Reaktion:** Mit Screenshots und konkreten Massangaben (Abstände in px, keine Umbrüche, Tabs eindeutig) in zwei Runden nachgesteuert.

### Eigene Produktentscheide gegen das Mockup
- Resultate werden **automatisch gespeichert** statt per Button wie im Mockup – meine Entscheidung nach dem ersten Test, weil man am Spielfeldrand das Speichern vergisst.
- Resultate **pro Spieltag** statt ganzer Spielplan – ebenfalls meine Idee; der Agent hat sie umgesetzt.

### Was gut funktioniert hat
- Komplexe Logik (Spielplan mit Kreismethode, K.-o.-Baum, Kreuzvergleich, Transaktionen) wäre allein kaum machbar gewesen; über 100 automatisierte Tests sichern sie ab.
- Die Berichte der Agenten mit «nicht getestet»-Hinweisen machten klar, wo ich selbst prüfen muss.
- Klare Aufträge mit Datenmodell, Regeln und Tests führten meist im ersten Durchgang zu funktionierendem Code.

## Was ich beim nächsten Mal anders machen würde
- `AGENTS.md` von Anfang an ausführlich anlegen, nicht erst nach dem ersten Problem
- Aufträge von Beginn an klein halten und Haltepunkte einbauen
- Dieses Protokoll laufend führen statt im Nachhinein zu rekonstruieren
- _TODO: eigene Punkte ergänzen_
