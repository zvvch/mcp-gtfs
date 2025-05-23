import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

// Globale Variable, um den Spice-Prozess zu verfolgen
let spiceProcess = null;

export default function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  // Falls Spice.ai bereits läuft, Statusmeldung zurückgeben
  if (spiceProcess && !spiceProcess.killed) {
    return res.status(200).json({
      success: true,
      message: 'Spice.ai läuft bereits',
      pid: spiceProcess.pid
    });
  }
  
  console.log('Spice.ai wird gestartet...');
  
  // Prüfen, ob Spice.ai initialisiert wurde
  const spiceDir = path.join(process.cwd(), '.spice');
  if (!fs.existsSync(spiceDir)) {
    return res.status(500).json({
      success: false,
      message: 'Spice.ai wurde noch nicht initialisiert. Bitte zuerst initialisieren.'
    });
  }
  
  // Spice.ai starten
  try {
    spiceProcess = spawn('spice', ['run', '--http-endpoint', 'http://localhost:3000', '--very-verbose'], {
      cwd: process.cwd(),
      detached: true, // Prozess vom Elternprozess trennen
      stdio: ['ignore', 'pipe', 'pipe'] // stdin ignorieren, stdout und stderr pipen
    });
    
    console.log(`Spice.ai gestartet mit PID ${spiceProcess.pid}`);
    
    let output = '';
    let errorOutput = '';
    
    spiceProcess.stdout.on('data', (data) => {
      const text = data.toString();
      output += text;
      console.log(`Spice: ${text}`);
    });
    
    spiceProcess.stderr.on('data', (data) => {
      const text = data.toString();
      errorOutput += text;
      console.error(`Spice Error: ${text}`);
    });
    
    // Prozess unref(), damit Node.js beendet werden kann, auch wenn der Spice-Prozess noch läuft
    spiceProcess.unref();
    
    // Event-Handler für den Fall, dass Spice.ai beendet wird
    spiceProcess.on('close', (code) => {
      console.log(`Spice.ai beendet mit Code ${code}`);
      spiceProcess = null;
    });
    
    // Antwort zurückgeben, ohne auf das Ende des Prozesses zu warten
    setTimeout(() => {
      res.status(200).json({
        success: true,
        message: 'Spice.ai wurde gestartet',
        pid: spiceProcess.pid,
        initialOutput: output
      });
    }, 1000); // 1 Sekunde warten, um etwas Ausgabe zu erhalten
    
  } catch (error) {
    console.error('Fehler beim Starten von Spice.ai:', error);
    res.status(500).json({
      success: false,
      message: 'Fehler beim Starten von Spice.ai',
      error: error.message
    });
  }
} 