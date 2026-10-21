# Pizzeria Adriano – Website (Entwurf)

Neue Website für die Pizzeria Adriano, Wallensteinstraße 54, 1200 Wien.

- **Startseite** mit 3D-Holzofen (Three.js): Beim Scrollen dreht sich der Ofen, die Kamera fährt an die Öffnung. Mit Maus, Finger oder Pfeiltasten lässt er sich frei drehen. Die Flammen, die Glut und der Funkenflug sind animiert. Der Ofen ist dem echten Ofen im Lokal nachempfunden: Sandsteinkuppel, Ziegelbogen, Relief-Medaillon, Holzlager.
- **Interaktive Speisekarte** unter `/speisekarte/` mit Kategorienleiste, Suche, Filtern (fleischlos, vegan möglich, scharf, „ohne Allergen …“) und Allergenlegende. Die Seite ist für einen QR-Code am Tisch geeignet.
- **Admin** unter `/admin/` mit Login. Der Kunde bearbeitet dort Gerichte, Preise, Allergene, Hinweise, Hervorhebungen, Reihenfolge und Sichtbarkeit („ausverkauft“). Dazu gehören ein Versionsverlauf mit Wiederherstellen, eine Rückgängig-Funktion und ein automatischer Entwurf im Browser.
- **Druckversion** unter `/admin/druck/`: Die Karte wird automatisch auf A4 gesetzt, mit Seitenziel (Standard 4 Seiten) und automatischer Schriftanpassung. Speichern als PDF geht über den Druckdialog.

Es gibt keine Build-Pipeline, keine Cookies für Besucher und kein Tracking. Schriften und Three.js liegen im Projekt.

## Branding anpassen

**Alle Farben und Schriften stehen in [`assets/css/brand.css`](assets/css/brand.css).** Aktuell sind Standard-Systemschriften gesetzt. Für die Hausschrift die `.woff2`-Dateien nach `assets/fonts/` legen und den kommentierten `@font-face`-Block in `brand.css` aktivieren. Website, Speisekarte, Admin und Druckversion übernehmen die Werte automatisch.

## Auf Netlify veröffentlichen

1. In Netlify „Add new site → Import from Git“ wählen und dieses Repository verbinden. Es gibt keinen Build-Befehl, das Publish-Verzeichnis ist `.`.
2. Unter **Site configuration → Environment variables** zwei Werte setzen:
   - `ADMIN_PASSWORD`: das Passwort für den Kunden, mindestens 8 Zeichen, besser 12 oder mehr
   - `SESSION_SECRET`: eine zufällige Zeichenkette mit mindestens 32 Zeichen, z. B. aus `openssl rand -hex 32`
3. Neu deployen. Die Speisekarte wird in **Netlify Blobs** gespeichert, das läuft automatisch und braucht keine Datenbank. Solange noch nichts gespeichert wurde, gilt `data/menu.json`.
4. Unter **Forms → Notifications** die E-Mail für Feier-Anfragen eintragen, z. B. `info@pizzeria-adriano.at`.
5. Die Domain `pizzeria-adriano.at` verbinden. Die alten WordPress-Adressen werden über `netlify.toml` umgeleitet.

## Lokal testen

```bash
npm install
npm run dev            # http://localhost:8888 – Admin-Passwort lokal: adriano-lokal
npm run check          # Shipcheck (SEO, Struktur, Rechtstexte)
```

Ohne Backend, etwa als reine Dateivorschau, läuft der Admin im **Demo-Modus**. Das Passwort ist dann `demo`, und Änderungen bleiben nur im Browser.

## Aufbau

| Pfad | Inhalt |
|---|---|
| `index.html`, `assets/js/site.js` | Startseite |
| `assets/js/oven.js` | 3D-Ofen (prozedural, ohne Modelldatei) |
| `speisekarte/`, `assets/js/speisekarte.js` | interaktive Karte |
| `admin/`, `assets/js/admin.js` | Editor |
| `admin/druck/`, `assets/js/print.js` | A4-Druck/PDF |
| `data/menu.json` | Startdaten der Karte |
| `netlify/functions/` | `/api/menu` (öffentlich) und `/api/admin/*` (Login, Speichern, Versionen) |

## Noch offen

- Im Impressum UID-Nummer, Gewerbe, Kammer und Behörde ergänzen bzw. prüfen. Die Stellen sind mit „[bitte ergänzen]“ und „[bitte prüfen]“ markiert.
- Die Datenschutzerklärung rechtlich prüfen lassen.
- Die Fotos stammen von der bisherigen Website. Neue Fotos und Reels sollen ersetzt werden.
- Die Allergenangaben in der Karte von der Küche bestätigen lassen.
