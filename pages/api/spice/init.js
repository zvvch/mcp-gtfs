import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

export default function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  console.log('Spice.ai wird initialisiert...');
  
  // Prüfen, ob Spice.ai bereits initialisiert wurde
  const spiceDir = path.join(process.cwd(), '.spice');
  if (fs.existsSync(spiceDir)) {
    return res.status(200).json({ 
      success: true, 
      message: 'Spice.ai wurde bereits initialisiert',
      alreadyInitialized: true 
    });
  }
  
  // Spice.ai initialisieren
  const init = spawn('spice', ['init', 'mcp-gtfs'], { cwd: process.cwd() });
  
  let output = '';
  let errorOutput = '';
  
  init.stdout.on('data', (data) => {
    const text = data.toString();
    output += text;
    console.log(`Spice Init: ${text}`);
  });
  
  init.stderr.on('data', (data) => {
    const text = data.toString();
    errorOutput += text;
    console.error(`Spice Init Error: ${text}`);
  });
  
  init.on('close', (code) => {
    console.log(`Spice Init beendet mit Code ${code}`);
    
    if (code === 0) {
      // Spicepod-Konfiguration kopieren, falls vorhanden
      const sourcePod = path.join(process.cwd(), 'spicepod.yaml');
      if (fs.existsSync(sourcePod)) {
        try {
          const targetPod = path.join(process.cwd(), 'spicepod.yaml');
          fs.copyFileSync(sourcePod, targetPod);
          console.log('Spicepod-Konfiguration kopiert');
        } catch (error) {
          console.error('Fehler beim Kopieren der Spicepod-Konfiguration:', error);
        }
      }
      
      res.status(200).json({ 
        success: true, 
        message: 'Spice.ai erfolgreich initialisiert',
        output 
      });
    } else {
      res.status(500).json({ 
        success: false, 
        message: 'Fehler bei der Initialisierung von Spice.ai',
        error: errorOutput 
      });
    }
  });
  
  init.on('error', (error) => {
    console.error('Fehler beim Starten der Initialisierung:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Fehler beim Starten der Initialisierung',
      error: error.message 
    });
  });
} 