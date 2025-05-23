export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Nur POST-Anfragen sind erlaubt' });
  }

  const { query } = req.body;

  if (!query) {
    return res.status(400).json({ error: 'Keine Abfrage angegeben' });
  }

  try {
    // Stelle sicher, dass die Abfrage mit SELECT beginnt
    const sqlQuery = query.trim().toLowerCase().startsWith('select') 
      ? query 
      : `SELECT * FROM stops WHERE stop_name LIKE '%${query}%' LIMIT 5`;

    const response = await fetch('http://localhost:8090/v1/sql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        sql: sqlQuery,
        parameters: {}
      }),
    });

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text();
      throw new Error(`Unerwartete Antwort von Spice.ai: ${text}`);
    }

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Spice.ai-Fehler: ${errorData.error || response.statusText}`);
    }

    const data = await response.json();
    res.status(200).json({ response: data });
  } catch (error) {
    console.error('Fehler bei der Spice.ai-Abfrage:', error);
    res.status(500).json({ error: error.message });
  }
} 