const Database = require('better-sqlite3');
const path = require('path');

// Datenbankverbindung erstellen
const db = new Database(path.join(__dirname, 'gtfs.db'));

// Haltestellen suchen
function searchStops(query, limit = 10) {
  const searchQuery = `
    SELECT * FROM stops 
    WHERE stop_name LIKE ? 
    ORDER BY stop_name 
    LIMIT ?
  `;
  
  return db.prepare(searchQuery).all(`%${query}%`, limit);
}

module.exports = {
  searchStops
}; 