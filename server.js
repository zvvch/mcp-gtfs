const express = require('express');
const path = require('path');
const fs = require('fs');
const fetch = require('node-fetch');

// Express-Server für API und Fallback
const app = express();
const PORT = process.env.PORT || 3000;

// Konfiguration
const GTFS_DIR = path.join(__dirname, 'zvv-data', 'gtfs');
const SPICE_ENDPOINT = `http://localhost:${PORT}`;
const SSE_ENDPOINT = `${SPICE_ENDPOINT}/v1/mcp/sse`;

console.log(`🔧 Server-Konfiguration:`);
console.log(`- PORT: ${PORT}`);
console.log(`- GTFS_DIR: ${GTFS_DIR}`);
console.log(`- SPICE_ENDPOINT: ${SPICE_ENDPOINT}`);
console.log(`- SSE_ENDPOINT: ${SSE_ENDPOINT}`);

// Middleware für CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

// Status-Endpunkt
app.get('/status', async (req, res) => {
  console.log('Status-Endpunkt aufgerufen');
  
  // Prüfen, ob GTFS-Daten vorhanden sind
  const hasGtfsData = fs.existsSync(path.join(GTFS_DIR, 'routes.txt'));
  console.log(`GTFS-Daten vorhanden: ${hasGtfsData}`);
  
  // Prüfen, ob Spice.ai läuft
  let spiceRunning = false;
  try {
    console.log(`Prüfe Spice.ai auf: ${SPICE_ENDPOINT}/v1/status`);
    const response = await fetch(`${SPICE_ENDPOINT}/v1/status`, { 
      method: 'GET',
      timeout: 3000
    });
    spiceRunning = response.ok;
    console.log(`Spice.ai Status-Code: ${response.status}`);
  } catch (error) {
    console.error(`Fehler beim Prüfen von Spice.ai: ${error.message}`);
  }
  
  const status = {
    express: true,
    gtfs_data: hasGtfsData,
    spice: spiceRunning
  };
  
  console.log(`Status-Antwort: ${JSON.stringify(status)}`);
  res.json(status);
});

// Fallback SSE-Endpunkt
app.get('/v1/mcp/sse', (req, res) => {
  console.log('SSE-Endpunkt aufgerufen');
  
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  
  // Versuche zuerst Spice.ai MCP-Endpoint zu verwenden
  fetch(SSE_ENDPOINT)
    .then(response => {
      if (response.ok) {
        console.log('Spice.ai MCP-Endpoint ist verfügbar, leite weiter...');
        // Weiterleitung zum Spice.ai-Endpoint
        res.write('data: {"message": "Spice.ai MCP-Endpoint ist verfügbar."}\n\n');
      } else {
        console.log('Spice.ai MCP-Endpoint ist nicht verfügbar, verwende Fallback...');
        // Fallback-Antwort
        res.write('data: {"message": "Fallback-Modus aktiv. Spice.ai ist nicht verfügbar."}\n\n');
      }
    })
    .catch(error => {
      console.error(`Fehler beim Zugriff auf Spice.ai: ${error.message}`);
      // Fallback-Antwort
      res.write('data: {"message": "Fallback-Modus aktiv. Spice.ai ist nicht verfügbar."}\n\n');
    });
  
  // Verbindung offenhalten
  const interval = setInterval(() => {
    res.write('data: {"type": "ping"}\n\n');
  }, 30000);
  
  req.on('close', () => {
    console.log('Client-Verbindung geschlossen');
    clearInterval(interval);
  });
});

// Frontend (einfache HTML-Seite)
app.get('/', (req, res) => {
  console.log('Frontend aufgerufen');
  
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>GTFS-MCP Server</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }
        h1 { color: #333; }
        .status { margin: 20px 0; }
        .online { color: green; }
        .offline { color: red; }
        code { background: #f4f4f4; padding: 2px 5px; border-radius: 3px; }
      </style>
    </head>
    <body>
      <h1>GTFS-MCP Server</h1>
      <div class="status" id="status">Status wird geladen...</div>
      <h2>API-Endpunkte:</h2>
      <ul>
        <li><code>${SPICE_ENDPOINT}/v1/mcp/sse</code> - MCP-SSE-Endpoint</li>
        <li><code>${SPICE_ENDPOINT}/status</code> - Status-API</li>
      </ul>
      
      <script>
        // Status abfragen
        fetch('/status')
          .then(response => response.json())
          .then(data => {
            const statusEl = document.getElementById('status');
            statusEl.innerHTML = \`
              <p>Express-Server: <span class="\${data.express ? 'online' : 'offline'}">\${data.express ? 'Online' : 'Offline'}</span></p>
              <p>GTFS-Daten: <span class="\${data.gtfs_data ? 'online' : 'offline'}">\${data.gtfs_data ? 'Verfügbar' : 'Nicht verfügbar'}</span></p>
              <p>Spice.ai: <span class="\${data.spice ? 'online' : 'offline'}">\${data.spice ? 'Online' : 'Offline'}</span></p>
            \`;
          })
          .catch(error => {
            console.error('Fehler beim Abrufen des Status:', error);
            document.getElementById('status').innerHTML = '<p class="offline">Fehler beim Abrufen des Status</p>';
          });
      </script>
    </body>
    </html>
  `);
});

// Starte den Server
app.listen(PORT, () => {
  console.log(`🔄 Server läuft auf Port ${PORT}`);
  console.log(`📡 SSE-Endpoint: http://localhost:${PORT}/v1/mcp/sse`);
  console.log(`🌐 Frontend: http://localhost:${PORT}/`);
}); 