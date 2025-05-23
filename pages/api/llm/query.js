import fetch from 'node-fetch';

// OpenAI API Key aus der Umgebungsvariable
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { query } = req.body;

  if (!query) {
    return res.status(400).json({ error: 'Query ist erforderlich' });
  }

  console.log(`LLM-Anfrage: "${query}"`);

  try {
    // Direkt mit OpenAI kommunizieren
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { 
            role: 'system', 
            content: 'Du bist ein hilfreicher Assistent für GTFS-Daten des ZVV. GTFS steht für General Transit Feed Specification und wird für Fahrplandaten im öffentlichen Verkehr verwendet. Der ZVV ist der Zürcher Verkehrsverbund. Die GTFS-Daten enthalten Informationen zu Linien (routes.txt), Haltestellen (stops.txt), Fahrten (trips.txt) und Fahrplänen (stop_times.txt).' 
          },
          { role: 'user', content: query }
        ],
        temperature: 0.7,
        max_tokens: 500
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Fehler bei der Anfrage an OpenAI:', errorText);
      return res.status(500).json({ 
        error: 'Fehler bei der Anfrage an OpenAI',
        details: errorText
      });
    }

    const data = await response.json();
    console.log('LLM-Antwort erhalten');
    
    res.status(200).json(data);
  } catch (error) {
    console.error('Fehler bei der LLM-Anfrage:', error);
    res.status(500).json({ 
      error: 'Fehler bei der LLM-Anfrage',
      details: error.message
    });
  }
} 