const { spawn } = require('child_process');
const path = require('path');

// Spice.ai Konfiguration
const SPICE_CONFIG = {
  port: process.env.PORT || 3000,
  dataDir: path.join(__dirname, 'zvv-data', 'gtfs'),
  schema: {
    routes: {
      type: 'table',
      source: 'routes.txt',
      columns: {
        route_id: 'string',
        agency_id: 'string',
        route_short_name: 'string',
        route_long_name: 'string',
        route_type: 'integer'
      }
    },
    stops: {
      type: 'table',
      source: 'stops.txt',
      columns: {
        stop_id: 'string',
        stop_name: 'string',
        stop_lat: 'float',
        stop_lon: 'float'
      }
    },
    trips: {
      type: 'table',
      source: 'trips.txt',
      columns: {
        trip_id: 'string',
        route_id: 'string',
        service_id: 'string'
      }
    }
  }
};

// Spice.ai Server starten
function startSpiceServer() {
  // Prüfen ob Spice.ai installiert ist
  const spice = spawn('spice', ['--version']);
  
  spice.on('error', (err) => {
    console.error('❌ Spice.ai ist nicht installiert!');
    console.error('Bitte installiere Spice.ai v1.1.0:');
    console.error('https://docs.spiceai.org/getting-started/installation');
    process.exit(1);
  });

  // Spice.ai Server starten
  const server = spawn('spice', [
    'serve',
    '--port', SPICE_CONFIG.port,
    '--data-dir', SPICE_CONFIG.dataDir
  ]);

  server.stdout.on('data', (data) => {
    console.log(`Spice.ai: ${data}`);
  });

  server.stderr.on('data', (data) => {
    console.error(`Spice.ai Error: ${data}`);
  });

  server.on('close', (code) => {
    console.log(`Spice.ai Server beendet mit Code ${code}`);
  });

  console.log('🚀 Spice.ai Server gestartet');
  console.log(`📡 SSE-Endpoint: http://localhost:${SPICE_CONFIG.port}/v1/mcp/sse`);
}

// Server starten
startSpiceServer(); 