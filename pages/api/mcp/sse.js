import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import Database from 'better-sqlite3';

// Datenbankverbindung erstellen
const db = new Database(path.join(process.cwd(), 'db', 'gtfs.db'));

// SSE-Handler für MCP
export default function handler(req, res) {
  // POST-Anfragen für Tool-Aufrufe direkt verarbeiten
  if (req.method === 'POST') {
    console.log('MCP-POST-Anfrage erhalten');
    
    // Einfach mit 200 OK antworten, die eigentliche Verarbeitung 
    // erfolgt über die bestehende SSE-Verbindung
    return res.status(200).json({ status: 'ok' });
  }
  
  // GET-Anfragen für SSE-Verbindung
  // SSE-Header setzen
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  
  console.log('MCP-SSE-Verbindung hergestellt');
  
  // MCP-Server-Info für Cursor und andere Clients
  const mcpServerInfo = {
    type: 'info',
    version: '1.0',
    protocol: 'mcp',
    tools: [
      {
        id: 'gtfs_routes',
        name: 'GTFS Routen',
        description: 'Liefert Informationen zu GTFS-Routen aus dem ZVV-Datensatz',
        parameters: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Suchbegriff für Routen'
            }
          },
          required: ['query']
        }
      },
      {
        id: 'gtfs_stops',
        name: 'GTFS Haltestellen',
        description: 'Liefert Informationen zu GTFS-Haltestellen aus dem ZVV-Datensatz',
        parameters: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Suchbegriff für Haltestellen'
            }
          },
          required: ['query']
        }
      }
    ]
  };
  
  // Sende MCP-Server-Info
  res.write(`data: ${JSON.stringify({ type: 'mcp_server_info', data: mcpServerInfo })}\n\n`);
  
  // Ping-Interval, um die Verbindung offen zu halten
  const pingInterval = setInterval(() => {
    res.write(`data: ${JSON.stringify({ type: 'ping', timestamp: new Date().toISOString() })}\n\n`);
  }, 30000);
  
  // Tool-Handler
  req.on('data', async (chunk) => {
    try {
      const data = JSON.parse(chunk.toString());
      
      if (data.type === 'tool_call' && data.tool_id) {
        console.log(`MCP-Tool-Aufruf: ${data.tool_id}`, data);
        
        let response = null;
        
        if (data.tool_id === 'gtfs_routes') {
          response = await handleGtfsRoutes(data.parameters?.query || '');
        } else if (data.tool_id === 'gtfs_stops') {
          response = await handleGtfsStops(data.parameters?.query || '');
        }
        
        if (response) {
          res.write(`data: ${JSON.stringify({ 
            type: 'tool_response', 
            request_id: data.request_id,
            data: response
          })}\n\n`);
        }
      }
    } catch (error) {
      console.error('Fehler bei der Verarbeitung des MCP-Tool-Aufrufs:', error);
    }
  });
  
  // Wenn der Client die Verbindung schließt, Intervalle beenden
  req.on('close', () => {
    console.log('MCP-SSE-Verbindung geschlossen');
    clearInterval(pingInterval);
  });
}

// GTFS-Routen-Handler
async function handleGtfsRoutes(query) {
  console.log(`Suche nach GTFS-Routen für Query: "${query}"`);
  
  try {
    // Vereinfachter Mock-Ansatz - in der Produktion würdest du 
    // tatsächlich deine GTFS-Daten abfragen
    return {
      routes: [
        { route_id: "1", route_short_name: "1", route_long_name: "Zürich HB - Flughafen", route_type: 3 },
        { route_id: "2", route_short_name: "2", route_long_name: "Zürich HB - Oerlikon", route_type: 3 },
        { route_id: "10", route_short_name: "10", route_long_name: "Zürich HB - Bahnhofplatz", route_type: 0 }
      ],
      query: query
    };
  } catch (error) {
    console.error('Fehler beim Abrufen der GTFS-Routen:', error);
    return { error: 'Fehler beim Abrufen der GTFS-Routen' };
  }
}

// GTFS-Haltestellen-Handler
async function handleGtfsStops(query) {
  console.log(`Suche nach GTFS-Haltestellen für Query: "${query}"`);
  
  try {
    // Suche in der SQLite-Datenbank
    const searchQuery = `
      SELECT * FROM stops 
      WHERE stop_name LIKE ? 
      ORDER BY stop_name 
      LIMIT 10
    `;
    
    const stops = db.prepare(searchQuery).all(`%${query}%`);
    
    return {
      stops: stops.map(stop => ({
        stop_id: stop.stop_id,
        stop_name: stop.stop_name,
        stop_lat: stop.stop_lat,
        stop_lon: stop.stop_lon
      })),
      query: query
    };
  } catch (error) {
    console.error('Fehler beim Abrufen der GTFS-Haltestellen:', error);
    return { error: 'Fehler beim Abrufen der GTFS-Haltestellen' };
  }
} 