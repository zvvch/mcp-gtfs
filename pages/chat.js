import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';

export default function Chat() {
  const [messages, setMessages] = useState([
    { role: 'system', content: 'Willkommen beim GTFS-MCP Chat! Ich kann dir Informationen zu GTFS-Routen und Haltestellen geben.' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const messagesEndRef = useRef(null);
  
  // SSE-Verbindung zum MCP-Server herstellen
  useEffect(() => {
    let eventSource;
    let toolRequestMap = {};
    
    const connectToMCP = () => {
      console.log('Verbinde mit MCP-Server...');
      
      eventSource = new EventSource('/api/mcp/sse');
      
      eventSource.onopen = () => {
        setIsConnected(true);
        console.log('Verbindung zum MCP-Server hergestellt');
      };
      
      eventSource.onerror = (error) => {
        setIsConnected(false);
        console.error('Fehler bei der MCP-Verbindung:', error);
        eventSource.close();
        
        // Nach 5 Sekunden erneut verbinden
        setTimeout(connectToMCP, 5000);
      };
      
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'tool_response' && data.request_id && toolRequestMap[data.request_id]) {
            // Antwort auf einen Tool-Aufruf
            const requestInfo = toolRequestMap[data.request_id];
            const formattedResponse = formatToolResponse(data.data, requestInfo.toolId);
            
            setMessages(prev => [...prev, { role: 'assistant', content: formattedResponse }]);
            setIsLoading(false);
            
            // Aufräumen
            delete toolRequestMap[data.request_id];
          }
        } catch (error) {
          console.error('Fehler beim Parsen der MCP-Nachricht:', error);
        }
      };
    };
    
    connectToMCP();
    
    // Werkzeug aufrufen
    window.callMcpTool = (toolId, parameters, userQuery) => {
      if (!eventSource) {
        console.error('Keine Verbindung zum MCP-Server');
        return;
      }
      
      const requestId = `req-${Date.now()}`;
      
      // Anfrage speichern
      toolRequestMap[requestId] = {
        toolId,
        parameters,
        timestamp: Date.now(),
        userQuery
      };
      
      const toolCall = {
        type: 'tool_call',
        tool_id: toolId,
        request_id: requestId,
        parameters
      };
      
      console.log('Sende Tool-Aufruf:', toolCall);
      
      // SSE unterstützt keine bidirektionale Kommunikation, daher müssen wir 
      // einen separaten Fetch-Aufruf machen
      fetch('/api/mcp/sse', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(toolCall)
      }).catch(error => {
        console.error('Fehler beim Senden des Tool-Aufrufs:', error);
        setIsLoading(false);
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: 'Entschuldigung, es gab ein Problem bei der Verbindung zum Server.' 
        }]);
      });
    };
    
    return () => {
      if (eventSource) {
        eventSource.close();
      }
      
      delete window.callMcpTool;
    };
  }, []);
  
  // Scroll zum Ende der Nachrichten
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  // Formatiere die Tool-Antwort
  const formatToolResponse = (data, toolId) => {
    if (toolId === 'gtfs_routes') {
      if (!data.routes || data.routes.length === 0) {
        return 'Ich habe leider keine passenden Routen gefunden.';
      }
      
      return `Hier sind die gefundenen Routen:\n\n${data.routes.map(route => 
        `🚍 **${route.route_short_name}**: ${route.route_long_name} (ID: ${route.route_id}, Typ: ${getRouteTypeName(route.route_type)})`
      ).join('\n')}`;
    } 
    else if (toolId === 'gtfs_stops') {
      if (!data.stops || data.stops.length === 0) {
        return 'Ich habe leider keine passenden Haltestellen gefunden.';
      }
      
      return `Hier sind die gefundenen Haltestellen:\n\n${data.stops.map(stop => 
        `🚏 **${stop.stop_name}** (ID: ${stop.stop_id}, Koordinaten: ${stop.stop_lat}, ${stop.stop_lon})`
      ).join('\n')}`;
    }
    
    return `Hier ist die Antwort:\n\n${JSON.stringify(data, null, 2)}`;
  };
  
  // Route-Typ in lesbare Form umwandeln
  const getRouteTypeName = (routeType) => {
    const types = {
      0: 'Straßenbahn',
      1: 'U-Bahn',
      2: 'Zug',
      3: 'Bus',
      4: 'Fähre',
      5: 'Straßenbahn',
      6: 'Gondel',
      7: 'Standseilbahn'
    };
    
    return types[routeType] || `Typ ${routeType}`;
  };
  
  // Nachricht senden
  const handleSendMessage = (e) => {
    e.preventDefault();
    
    if (!input.trim() || isLoading) return;
    
    // Benutzeranfrage hinzufügen
    const userMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    
    // Text analysieren und passende Tools aufrufen
    const query = input.toLowerCase();
    let toolCalled = false;
    
    if (query.includes('route') || query.includes('linie') || query.includes('bus') || 
        query.includes('zug') || query.includes('bahn') || query.includes('tram')) {
      // Routen-Anfrage
      window.callMcpTool('gtfs_routes', { query: input }, input);
      toolCalled = true;
    } 
    else if (query.includes('halt') || query.includes('station') || query.includes('bahnhof') || 
             query.includes('stop')) {
      // Haltestellen-Anfrage
      window.callMcpTool('gtfs_stops', { query: input }, input);
      toolCalled = true;
    }
    
    // Wenn kein passendes Tool gefunden wurde
    if (!toolCalled) {
      setTimeout(() => {
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: 'Ich verstehe deine Anfrage nicht ganz. Du kannst mich nach Routen oder Haltestellen fragen, zum Beispiel "Zeige mir Routen nach Zürich" oder "Welche Haltestellen gibt es in Oerlikon?".' 
        }]);
        setIsLoading(false);
      }, 1000);
    }
    
    setInput('');
  };
  
  return (
    <div className="container">
      <Head>
        <title>GTFS-Chat</title>
        <meta name="description" content="Chat-Interface für GTFS-Daten" />
      </Head>
      
      <main>
        <div className="chat-header">
          <h1>GTFS-Chat</h1>
          <div className="status">
            <span className={isConnected ? 'online' : 'offline'}>
              {isConnected ? '● Online' : '● Offline'}
            </span>
          </div>
        </div>
        
        <div className="chat-messages">
          {messages.map((message, index) => (
            <div key={index} className={`message ${message.role}`}>
              <div className="message-content">
                {message.content.split('\n').map((line, i) => (
                  <p key={i} dangerouslySetInnerHTML={{ __html: formatMarkdown(line) }}></p>
                ))}
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div className="message assistant">
              <div className="message-content loading">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
        
        <form className="chat-input" onSubmit={handleSendMessage}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Frage etwas zu GTFS-Routen oder Haltestellen..."
            disabled={!isConnected || isLoading}
          />
          <button type="submit" disabled={!isConnected || isLoading || !input.trim()}>
            Senden
          </button>
        </form>
        
        <div className="hint">
          <p>Beispielfragen:</p>
          <ul>
            <li>Welche Routen führen zum Flughafen?</li>
            <li>Zeige mir Haltestellen in Zürich.</li>
            <li>Gibt es eine Linie nach Oerlikon?</li>
          </ul>
        </div>
      </main>
      
      <style jsx>{`
        .container {
          max-width: 800px;
          margin: 0 auto;
          height: 100vh;
          display: flex;
          flex-direction: column;
        }
        
        main {
          flex: 1;
          display: flex;
          flex-direction: column;
          padding: 1rem;
          height: 100%;
        }
        
        .chat-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-bottom: 1rem;
          border-bottom: 1px solid #eaeaea;
          margin-bottom: 1rem;
        }
        
        h1 {
          font-size: 1.5rem;
          margin: 0;
        }
        
        .status {
          font-size: 0.875rem;
        }
        
        .online {
          color: green;
        }
        
        .offline {
          color: red;
        }
        
        .chat-messages {
          flex: 1;
          overflow-y: auto;
          padding: 1rem;
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        
        .message {
          display: flex;
          margin-bottom: 0.5rem;
        }
        
        .message.user {
          justify-content: flex-end;
        }
        
        .message.assistant .message-content,
        .message.system .message-content {
          background-color: #f0f0f0;
          color: #333;
          border-radius: 10px 10px 10px 0;
        }
        
        .message.user .message-content {
          background-color: #0070f3;
          color: white;
          border-radius: 10px 10px 0 10px;
        }
        
        .message-content {
          padding: 0.75rem 1rem;
          max-width: 80%;
          white-space: pre-wrap;
        }
        
        .message-content p {
          margin: 0.25rem 0;
        }
        
        .message-content p:first-child {
          margin-top: 0;
        }
        
        .message-content p:last-child {
          margin-bottom: 0;
        }
        
        .loading {
          display: flex;
          align-items: center;
          gap: 0.25rem;
        }
        
        .loading span {
          display: inline-block;
          width: 8px;
          height: 8px;
          background-color: #888;
          border-radius: 50%;
          animation: loading 1.4s ease-in-out infinite;
        }
        
        .loading span:nth-child(2) {
          animation-delay: 0.2s;
        }
        
        .loading span:nth-child(3) {
          animation-delay: 0.4s;
        }
        
        @keyframes loading {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-8px);
          }
        }
        
        .chat-input {
          display: flex;
          margin-top: 1rem;
          border-top: 1px solid #eaeaea;
          padding-top: 1rem;
        }
        
        input {
          flex: 1;
          padding: 0.75rem;
          border: 1px solid #eaeaea;
          border-radius: 5px 0 0 5px;
          font-size: 1rem;
        }
        
        button {
          padding: 0.75rem 1.5rem;
          background-color: #0070f3;
          color: white;
          border: none;
          border-radius: 0 5px 5px 0;
          cursor: pointer;
          font-size: 1rem;
        }
        
        button:hover {
          background-color: #005bb5;
        }
        
        button:disabled {
          background-color: #cccccc;
          cursor: not-allowed;
        }
        
        .hint {
          margin-top: 1rem;
          padding: 1rem;
          background-color: #f9f9f9;
          border-radius: 5px;
          font-size: 0.875rem;
        }
        
        .hint p {
          margin: 0 0 0.5rem 0;
          font-weight: bold;
        }
        
        .hint ul {
          margin: 0;
          padding-left: 1.5rem;
        }
        
        .hint li {
          margin-bottom: 0.25rem;
        }
      `}</style>
    </div>
  );
}

// Einfache Markdown-Formatierung für die Anzeige
function formatMarkdown(text) {
  // Fettschrift: **text** -> <strong>text</strong>
  let formatted = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  
  // Emoji hervorheben
  formatted = formatted.replace(/([\u{1F300}-\u{1F6FF}\u{2600}-\u{26FF}])/ug, '<span style="font-size: 1.2em;">$1</span>');
  
  return formatted;
} 