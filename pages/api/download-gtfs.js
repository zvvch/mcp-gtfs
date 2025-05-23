import { spawn } from 'child_process';
import path from 'path';

export default function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  console.log('GTFS-Daten werden heruntergeladen...');
  
  // Download-Prozess starten
  const download = spawn('node', [path.join(process.cwd(), 'download-gtfs.js')]);
  
  let output = '';
  let errorOutput = '';
  
  download.stdout.on('data', (data) => {
    const text = data.toString();
    output += text;
    console.log(`Download: ${text}`);
  });
  
  download.stderr.on('data', (data) => {
    const text = data.toString();
    errorOutput += text;
    console.error(`Download Error: ${text}`);
  });
  
  download.on('close', (code) => {
    console.log(`Download beendet mit Code ${code}`);
    
    if (code === 0) {
      res.status(200).json({ 
        success: true, 
        message: 'GTFS-Daten erfolgreich heruntergeladen',
        output 
      });
    } else {
      res.status(500).json({ 
        success: false, 
        message: 'Fehler beim Herunterladen der GTFS-Daten',
        error: errorOutput 
      });
    }
  });
  
  download.on('error', (error) => {
    console.error('Fehler beim Starten des Downloads:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Fehler beim Starten des Downloads',
      error: error.message 
    });
  });
} 