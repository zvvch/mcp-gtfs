import { useState, useEffect } from 'react';
import Head from 'next/head';

export default function McpTest() {
  const [logs, setLogs] = useState([]);
  const [input, setInput] = useState('');
  const [toolType, setToolType] = useState('gtfs_routes');
  const [isConnected, setIsConnected] = useState(false);
  
  useEffect(() => {
    let eventSource;
    let requestId = 1;
    
    // MCP SSE-Verbindung herstellen
    const connectToMCP = () => {
      setLogs(prev => [...prev, "Verbinde mit MCP-Server..."]);
      
      eventSource = new EventSource('/api/mcp/sse');
      
      eventSource.onopen = () => {
        setIsConnected(true);
        setLogs(prev => [...prev, "✅ Verbindung zum MCP-Server hergestellt"]);
      };
      
      eventSource.onerror = (error) => {
        setIsConnected(false);
        setLogs(prev => [...prev, `❌ Fehler bei der MCP-Verbindung: ${error}`]);
        eventSource.close();
        
        // Nach 5 Sekunden erneut verbinden
        setTimeout(connectToMCP, 5000);
      };
      
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'mcp_server_info') {
            setLogs(prev => [...prev, `📊 MCP-Server-Info erhalten: ${JSON.stringify(data.data.tools.length)} Tools verfügbar`]);
          } else if (data.type === 'tool_response') {
            setLogs(prev => [...prev, `🔍 Tool-Antwort erhalten für Request ${data.request_id}:`]);
            setLogs(prev => [...prev, JSON.stringify(data.data, null, 2)]);
          } else if (data.type === 'ping') {
            // Pings ignorieren, um die Logs nicht zu überfüllen
          } else {
            setLogs(prev => [...prev, `📩 Nachricht vom MCP-Server: ${event.data}`]);
          }
        } catch (error) {
          setLogs(prev => [...prev, `❌ Fehler beim Parsen der MCP-Nachricht: ${error}`]);
        }
      };
    };
    
    connectToMCP();
    
    // Tool-Aufruf senden
    window.callMcpTool = (toolId, parameters) => {
      if (!eventSource) {
        setLogs(prev => [...prev, "❌ Keine Verbindung zum MCP-Server"]);
        return;
      }
      
      const toolCall = {
        type: 'tool_call',
        tool_id: toolId,
        request_id: `req-${requestId++}`,
        parameters: parameters
      };
      
      setLogs(prev => [...prev, `📤 Sende Tool-Aufruf: ${JSON.stringify(toolCall)}`]);
      
      // SSE unterstützt keine bidirektionale Kommunikation, daher müssen wir 
      // einen separaten Fetch-Aufruf machen
      fetch('/api/mcp/sse', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(toolCall)
      }).catch(error => {
        setLogs(prev => [...prev, `❌ Fehler beim Senden des Tool-Aufrufs: ${error}`]);
      });
    };
    
    return () => {
      if (eventSource) {
        eventSource.close();
      }
      
      delete window.callMcpTool;
    };
  }, []);
  
  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!input.trim()) return;
    
    window.callMcpTool(toolType, { query: input });
    setInput('');
  };
  
  return (
    <div className="container">
      <Head>
        <title>MCP-Server Test</title>
        <meta name="description" content="Test für den MCP-Server" />
      </Head>
      
      <main>
        <h1>MCP-Server Test</h1>
        
        <div className="status">
          <h2>Status: 
            <span className={isConnected ? 'online' : 'offline'}>
              {isConnected ? ' Online' : ' Offline'}
            </span>
          </h2>
        </div>
        
        <div className="tools">
          <h2>Tool-Aufruf testen:</h2>
          
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>
                Tool:
                <select 
                  value={toolType} 
                  onChange={(e) => setToolType(e.target.value)}
                >
                  <option value="gtfs_routes">GTFS Routen</option>
                  <option value="gtfs_stops">GTFS Haltestellen</option>
                </select>
              </label>
            </div>
            
            <div className="form-group">
              <label>
                Suchanfrage:
                <input 
                  type="text" 
                  value={input} 
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="z.B. Zürich"
                />
              </label>
            </div>
            
            <button type="submit" disabled={!isConnected || !input.trim()}>
              Anfrage senden
            </button>
          </form>
        </div>
        
        <div className="logs">
          <h2>Server-Logs:</h2>
          <pre>
            {logs.map((log, i) => (
              <div key={i} className="log-entry">
                {log}
              </div>
            ))}
          </pre>
        </div>
      </main>
      
      <style jsx>{`
        .container {
          max-width: 800px;
          margin: 0 auto;
          padding: 2rem;
        }
        
        h1 {
          font-size: 2rem;
          margin-bottom: 1rem;
        }
        
        h2 {
          font-size: 1.5rem;
          margin-bottom: 1rem;
        }
        
        .status {
          margin-bottom: 2rem;
        }
        
        .online {
          color: green;
          font-weight: bold;
        }
        
        .offline {
          color: red;
          font-weight: bold;
        }
        
        .tools {
          margin-bottom: 2rem;
          padding: 1rem;
          border: 1px solid #eaeaea;
          border-radius: 5px;
        }
        
        .form-group {
          margin-bottom: 1rem;
        }
        
        label {
          display: block;
          margin-bottom: 0.5rem;
        }
        
        input, select {
          width: 100%;
          padding: 0.5rem;
          font-size: 1rem;
        }
        
        button {
          padding: 0.5rem 1rem;
          background-color: #0070f3;
          color: white;
          border: none;
          border-radius: 5px;
          cursor: pointer;
        }
        
        button:disabled {
          background-color: #cccccc;
          cursor: not-allowed;
        }
        
        .logs {
          margin-top: 2rem;
          padding: 1rem;
          background-color: #f0f0f0;
          border-radius: 5px;
          max-height: 400px;
          overflow-y: auto;
        }
        
        pre {
          margin: 0;
          white-space: pre-wrap;
          word-wrap: break-word;
        }
        
        .log-entry {
          margin-bottom: 0.5rem;
          font-family: monospace;
        }
      `}</style>
    </div>
  );
} 