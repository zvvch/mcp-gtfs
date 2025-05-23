const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');

// Datenbank initialisieren
const db = new Database(path.join(__dirname, 'gtfs.db'));

// Stops-Tabelle erstellen
db.exec(`
  CREATE TABLE IF NOT EXISTS stops (
    stop_id TEXT PRIMARY KEY,
    stop_code TEXT,
    stop_name TEXT,
    stop_desc TEXT,
    stop_lat REAL,
    stop_lon REAL,
    zone_id TEXT,
    stop_url TEXT,
    location_type INTEGER,
    parent_station TEXT
  )
`);

// CSV-Datei einlesen und in die Datenbank importieren
function importStops() {
  const stopsPath = path.join(__dirname, '..', 'zvv-data', 'gtfs', 'stops.txt');
  const fileContent = fs.readFileSync(stopsPath, 'utf-8');
  
  // CSV parsen
  const records = parse(fileContent, {
    columns: true,
    skip_empty_lines: true
  });

  // Transaktion für bessere Performance
  const insert = db.prepare(`
    INSERT OR REPLACE INTO stops (
      stop_id, stop_code, stop_name, stop_desc, 
      stop_lat, stop_lon, zone_id, stop_url, 
      location_type, parent_station
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertMany = db.transaction((records) => {
    for (const record of records) {
      insert.run(
        record.stop_id,
        record.stop_code,
        record.stop_name,
        record.stop_desc,
        record.stop_lat,
        record.stop_lon,
        record.zone_id,
        record.stop_url,
        record.location_type,
        record.parent_station
      );
    }
  });

  // Daten importieren
  insertMany(records);
  console.log(`Importierte ${records.length} Haltestellen`);
}

// Index für die Suche erstellen
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_stops_name 
  ON stops(stop_name)
`);

// Import durchführen
importStops();

// Datenbank schließen
db.close(); 