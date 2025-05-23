const fs = require('fs');
const path = require('path');
const https = require('https');
const unzipper = require('unzipper');
const cheerio = require('cheerio');

// URL der Übersichtsseite mit allen GTFS-Downloads
const GTFS_PAGE = 'https://data.opentransportdata.swiss/de/dataset/timetable-2025-gtfs2020';
// Zielverzeichnis für die entpackten GTFS-Dateien
const TARGET_DIR = path.join(__dirname, 'zvv-data', 'gtfs');
// Maximale Zeit zwischen Downloads (24 Stunden in Millisekunden)
const MAX_DOWNLOAD_AGE = 24 * 60 * 60 * 1000;

// Liste der erwarteten GTFS-Dateien
const REQUIRED_GTFS_FILES = [
  'agency.txt',
  'stops.txt',
  'routes.txt',
  'trips.txt',
  'stop_times.txt',
  'calendar.txt',
  'calendar_dates.txt',
  'feed_info.txt',
  'transfers.txt'
];

/**
 * Prüft, ob die GTFS-Dateien vorhanden und aktuell sind
 */
function areGtfsFilesPresentAndCurrent() {
  if (!fs.existsSync(TARGET_DIR)) {
    return false;
  }

  // Prüfe Status-Datei
  const statusFile = path.join(TARGET_DIR, 'gtfs-status.json');
  if (fs.existsSync(statusFile)) {
    try {
      const status = JSON.parse(fs.readFileSync(statusFile, 'utf8'));
      const downloadTime = new Date(status.downloaded_at).getTime();
      const now = new Date().getTime();
      
      // Wenn die Dateien jünger als MAX_DOWNLOAD_AGE sind, sind sie aktuell
      if (now - downloadTime < MAX_DOWNLOAD_AGE) {
        return REQUIRED_GTFS_FILES.every(file => {
          const filePath = path.join(TARGET_DIR, file);
          const exists = fs.existsSync(filePath);
          if (!exists) {
            console.log(`❌ Fehlende GTFS-Datei: ${file}`);
          }
          return exists;
        });
      }
    } catch (err) {
      console.log('❌ Fehler beim Lesen der Status-Datei:', err);
    }
  }
  
  return false;
}

/**
 * Prüft, ob die Datei einen gültigen ZIP-Header besitzt (0x504b0304)
 * Dies verhindert, dass versehentlich HTML-Fehlerseiten als ZIP entpackt werden
 */
function isValidZipHeader(filePath) {
  const fd = fs.openSync(filePath, 'r');
  const buffer = Buffer.alloc(4);
  fs.readSync(fd, buffer, 0, 4, 0);
  fs.closeSync(fd);
  return buffer.equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
}

/**
 * Holt die Übersichtsseite, sucht alle Download-Links zu ZIP-Dateien,
 * sortiert sie nach Datum im Dateinamen (absteigend) und gibt den neuesten zurück.
 *
 * Rückgabe: Absoluter Download-Link zur neuesten GTFS-ZIP-Datei
 */
async function fetchLatestZipUrl() {
  return new Promise((resolve, reject) => {
    https.get(GTFS_PAGE, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const $ = cheerio.load(data);
          // Alle Download-Links sammeln, die auf eine ZIP-Datei zeigen
          const links = [];
          $('a').each((i, el) => {
            const href = $(el).attr('href');
            if (href && href.includes('/download/') && href.endsWith('.zip')) {
              links.push(href.startsWith('http') ? href : 'https://data.opentransportdata.swiss' + href);
            }
          });
          if (links.length === 0) return reject('Kein gültiger GTFS-Download-Link gefunden!');
          // Nach Datum im Dateinamen sortieren (absteigend, neueste zuerst)
          links.sort((a, b) => {
            const dateA = a.match(/(\d{4}-\d{2}-\d{2})/);
            const dateB = b.match(/(\d{4}-\d{2}-\d{2})/);
            return dateB && dateA ? dateB[0].localeCompare(dateA[0]) : 0;
          });
          const latestLink = links[0];
          resolve(latestLink);
        } catch (err) {
          reject('Fehler beim Parsen der Download-Seite: ' + err);
        }
      });
    }).on('error', err => reject('Fehler beim Laden der Download-Seite: ' + err));
  });
}

/**
 * Lädt die ZIP-Datei von der angegebenen URL herunter, folgt ggf. Redirects,
 * prüft den Header, entpackt sie ins Zielverzeichnis und entfernt die temporäre ZIP-Datei.
 * Fehlerfälle werden abgefangen und mit klaren Meldungen ausgegeben.
 */
function downloadWithRedirect(url, file, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    if (maxRedirects <= 0) return reject('Zu viele Redirects beim Download!');
    const options = new URL(url);
    options.headers = { 'User-Agent': 'Mozilla/5.0 (Node.js GTFS-Downloader)' };
    https.get(options, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        // Redirect: Folge der neuen Location
        const redirectUrl = res.headers.location.startsWith('http') ? res.headers.location : options.origin + res.headers.location;
        console.log('Redirect gefunden, folge:', redirectUrl);
        downloadWithRedirect(redirectUrl, file, maxRedirects - 1).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) {
        return reject(`Fehler beim Download: Status ${res.statusCode}`);
      }
      res.pipe(file);
      file.on('finish', () => resolve());
    }).on('error', err => reject('Fehler beim Download: ' + err));
  });
}

async function downloadAndExtractZip(zipUrl) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(TARGET_DIR)) fs.mkdirSync(TARGET_DIR, { recursive: true });
    const tmpZip = path.join(TARGET_DIR, 'gtfs-latest.zip');
    const file = fs.createWriteStream(tmpZip);
    console.log('Starte Download:', zipUrl);
    downloadWithRedirect(zipUrl, file)
      .then(() => {
        // Prüfe ZIP-Header, um HTML-Fehlerseiten zu erkennen
        if (!isValidZipHeader(tmpZip)) {
          const text = fs.readFileSync(tmpZip, 'utf8').slice(0, 500);
          fs.unlinkSync(tmpZip);
          return reject(`Die heruntergeladene Datei ist keine gültige ZIP-Datei! Inhalt:\n${text}`);
        }
        // Entpacken ins Zielverzeichnis
        fs.createReadStream(tmpZip)
          .pipe(unzipper.Extract({ path: TARGET_DIR }))
          .on('close', () => {
            // Metadaten erfassen
            const filename = path.basename(zipUrl.split('?')[0]);
            const status = {
              filename,
              url: zipUrl,
              downloaded_at: new Date().toISOString(),
              unpacked_to: TARGET_DIR,
              source_page: GTFS_PAGE
            };
            fs.writeFileSync(path.join(TARGET_DIR, 'gtfs-status.json'), JSON.stringify(status, null, 2), 'utf8');
            fs.unlinkSync(tmpZip);
            resolve();
          })
          .on('error', err => {
            fs.unlinkSync(tmpZip);
            reject('Fehler beim Entpacken: ' + err);
          });
      })
      .catch(reject);
  });
}

// Hauptablauf: Prüfe zuerst, ob alle Dateien vorhanden und aktuell sind
(async () => {
  try {
    console.log('🔍 Prüfe vorhandene GTFS-Dateien...');
    if (areGtfsFilesPresentAndCurrent()) {
      console.log('✅ GTFS-Dateien sind vorhanden und aktuell. Überspringe Download.');
      process.exit(0);
    }

    console.log('🔍 Suche nach dem neuesten GTFS-ZIP...');
    const zipUrl = await fetchLatestZipUrl();
    console.log('✅ Gefunden:', zipUrl);
    console.log('📥 Lade herunter und entpacke nach', TARGET_DIR);
    await downloadAndExtractZip(zipUrl);
    console.log('✅ GTFS-Daten erfolgreich heruntergeladen und entpackt.');
  } catch (err) {
    console.error('❌ FEHLER:', err);
    process.exit(1);
  }
})(); 