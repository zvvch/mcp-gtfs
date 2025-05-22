const { SpiceServer } = require('@spiceai/spice');
const path = require('path');

// MCP-Server Konfiguration
const server = new SpiceServer({
  port: process.env.PORT || 3000,
  dataDir: path.join(__dirname, 'zvv-data', 'gtfs'),
  // SQL-Schema für GTFS-Daten
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
});

// Server starten
server.start().then(() => {
  console.log('MCP-Server läuft auf Port', server.port);
  console.log('SSE-Endpoint:', `http://localhost:${server.port}/v1/mcp/sse`);
}); 