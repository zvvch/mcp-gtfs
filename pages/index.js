import { useState, useEffect } from 'react';
import styles from '../styles/Home.module.css';

export default function Home() {
  const [status, setStatus] = useState({
    express: false,
    gtfs_data: false,
    spice: false
  });
  const [spiceQuery, setSpiceQuery] = useState('');
  const [spiceResponse, setSpiceResponse] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Status regelmäßig aktualisieren
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const response = await fetch('/api/status');
        const data = await response.json();
        setStatus(data);
      } catch (error) {
        console.error('Fehler beim Prüfen des Status:', error);
      }
    };

    checkStatus();
    const interval = setInterval(checkStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  // Spice.ai-Abfrage senden
  const handleSpiceSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const response = await fetch('/api/spice/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: spiceQuery }),
      });
      const data = await response.json();
      setSpiceResponse(data.response);
    } catch (error) {
      console.error('Fehler bei der Spice.ai-Abfrage:', error);
      setSpiceResponse('Fehler bei der Abfrage: ' + error.message);
    }
    setIsLoading(false);
  };

  return (
    <div className={styles.container}>
      <main className={styles.main}>
        <h1 className={styles.title}>
          MCP GTFS Server
        </h1>

        <div className={styles.status}>
          <h2>Status</h2>
          <ul>
            <li>Express Server: {status.express ? '✅' : '❌'}</li>
            <li>GTFS Daten: {status.gtfs_data ? '✅' : '❌'}</li>
            <li>Spice.ai: {status.spice ? '✅' : '❌'}</li>
          </ul>
        </div>

        <div className={styles.spice}>
          <h2>Spice.ai Abfrage</h2>
          <form onSubmit={handleSpiceSubmit}>
            <input
              type="text"
              value={spiceQuery}
              onChange={(e) => setSpiceQuery(e.target.value)}
              placeholder="Gib deine Spice.ai-Abfrage ein..."
              className={styles.input}
            />
            <button 
              type="submit" 
              disabled={isLoading || !status.spice}
              className={styles.button}
            >
              {isLoading ? 'Lädt...' : 'Abfrage senden'}
            </button>
          </form>
          {spiceResponse && (
            <div className={styles.response}>
              <h3>Antwort:</h3>
              <pre>{spiceResponse}</pre>
            </div>
          )}
        </div>
      </main>
    </div>
  );
} 