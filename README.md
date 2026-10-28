# Was esse ich heute?

Eine kleine Progressive Web App, die abends ein Gericht vorschlägt – passend zu deinen Vorlieben, deinen eigenen Gerichten und dem, was du in den letzten Tagen gegessen hast.

- Reines HTML, CSS und JavaScript, kein Build-Schritt
- Alle Daten bleiben im Browser (IndexedDB), kein Server, kein Login
- Offline nutzbar und auf dem Homescreen installierbar
- Backup als JSON-Datei exportieren und importieren (unter „Mehr“)

## Dateien

| Datei | Inhalt |
|---|---|
| `index.html` | Grundgerüst |
| `style.css` | Gestaltung, Hell-/Dunkelmodus |
| `app.js` | Oberfläche, Speicher, Navigation |
| `vorschlag.js` | Vorschlagslogik (ohne Oberfläche, testbar) – alle Stellschrauben in `KONFIG` |
| `lebensmittel.js` | Lebensmittelliste (über 200 Einträge) und Beispielgerichte |
| `gerichte-katalog.js` | Katalog mit rund 165 gängigen Gerichten (eine Zeile pro Gericht, leicht erweiterbar) |
| `sw.js`, `manifest.json`, `icons/` | PWA: Offline-Cache, Installation, Icons |
| `fonts/` | Schrift Playfair Display (lokal, SIL Open Font License) |
| `tests/` | Automatische Tests der Vorschlagslogik |
| `tools/` | Mini-Webserver für die Vorschau, Icon-Generator |

## Lokal ausprobieren

Node.js genügt (keine Abhängigkeiten):

```bash
node tools/server.js
```

Dann <http://localhost:8080> öffnen. Direkt als Datei (`file://`) funktioniert die App auch, aber ohne Offline-Modus.

## Tests

```bash
node --test
```

## Veröffentlichen über GitHub Pages

1. Auf GitHub ein neues Repository anlegen (z. B. `was-esse-ich-heute`).
2. Dieses Repo verbinden und hochladen:
   ```bash
   git remote add origin https://github.com/<dein-name>/was-esse-ich-heute.git
   git push -u origin main
   ```
3. Im Repository unter **Settings → Pages** als Quelle „Deploy from a branch“, Branch `main`, Ordner `/ (root)` wählen.
4. Nach ein bis zwei Minuten ist die App unter `https://<dein-name>.github.io/was-esse-ich-heute/` erreichbar. Auf dem Handy öffnen und „Zum Startbildschirm hinzufügen“ wählen.

Alle Pfade sind relativ, die App läuft also auch in einem Unterordner.

**Nach Änderungen:** in `sw.js` die Cache-Version erhöhen (`was-esse-ich-heute-v1` → `-v2`), damit installierte Apps sicher die neue Version laden.

**Hinweis zu den Daten:** Die Daten liegen pro Gerät und Browser. Eine neue Adresse (z. B. Umzug von localhost auf GitHub Pages) startet leer – vorher ein Backup exportieren und dort wieder importieren.
