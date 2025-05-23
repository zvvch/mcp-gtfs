import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import fetch from 'node-fetch';

// Status-API
export default function handler(req, res) {
  // GTFS-Daten prüfen
  const gtfsDir = path.join(process.cwd(), 'zvv-data', 'gtfs');
  const hasGtfsData = fs.existsSync(path.join(gtfsDir, 'routes.txt'));
  
  // Prüfe Spice.ai-Status
  checkSpiceStatus()
    .then(spiceRunning => {
      const status = {
        express: true, // Express läuft immer, wenn dieser Endpunkt angefragt wird
        gtfs_data: hasGtfsData,
        spice: spiceRunning
      };
      
      console.log('Status:', status);
      res.status(200).json(status);
    })
    .catch(error => {
      console.error('Fehler beim Prüfen des Spice.ai-Status:', error);
      res.status(200).json({
        express: true,
        gtfs_data: hasGtfsData,
        spice: false
      });
    });
}

// Prüft, ob Spice.ai läuft
async function checkSpiceStatus() {
  try {
    const spiceResponse = await fetch('http://localhost:8090/v1/status');
    const spiceData = await spiceResponse.json();
    return spiceData.some(service => service.name === 'http' && service.status === 'Ready');
  } catch (error) {
    console.error('Fehler beim Prüfen des Spice.ai-Status:', error);
    return false;
  }
} 