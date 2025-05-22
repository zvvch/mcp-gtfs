# ZVV-GTS-MCP Server

## Übersicht

**ZVV-GTS-MCP** ist ein serverseitiges Projekt zur Aufbereitung und Bereitstellung von ÖV-Daten des **Zürcher Verkehrsverbunds (ZVV)** auf Basis der GTFS-Daten von [opentransportdata.swiss](https://data.opentransportdata.swiss/dataset/timetable-2025-gtfs2020).

Das Ziel ist es, diese Daten strukturiert über die **Spice.ai MCP Engine** zugänglich zu machen – als Schnittstelle für nachgelagerte AI-Projekte, Datenanalysen oder LLM-Abfragen.

> ✳️ **Hinweis:** Dieses Projekt stellt kein Chat-Interface oder Frontend bereit. Es fokussiert sich ausschliesslich auf die Datenverfügbarkeit über MCP.

## Quick Start

1. **Voraussetzungen installieren:**
   ```bash
   # Docker und Docker Compose installieren
   # (falls noch nicht vorhanden)
   ```

2. **Projekt starten:**
   ```bash
   # Repository klonen
   git clone https://github.com/zvvch/mcp-gtfs.git
   cd mcp-gtfs

   # Container starten
   docker-compose up --build
   ```

3. **API testen:**
   - Server läuft auf: `http://localhost:3000/v1/mcp/sse`
   - GTFS-Daten werden automatisch heruntergeladen
   - SQL-Abfragen über die SSE-API möglich

> 💡 **Tipp:** Für detaillierte Informationen siehe die Abschnitte "Architektur" und "Deployment" weiter unten.

## Architektur

### Systemkomponenten
```mermaid
sequenceDiagram
    participant UserSystem as 🔍 AI/LLM-Consumer
    participant MCP as 🧠 Spice.ai MCP v1.1.0
    participant GTFS as 📦 GTFS-Daten (opentransportdata.swiss)

    Note over GTFS, MCP: Setup-Phase
    GTFS->>MCP: GTFS-Dateien (z.B. routes.txt)
    MCP-->>MCP: DataFusion SQL Engine
    MCP-->>MCP: SSE API (/v1/mcp/sse)

    Note over UserSystem, MCP: Laufzeit-Abfrage
    UserSystem->>MCP: SQL Query
    MCP-->>UserSystem: Arrow/JSON Response

    Note over UserSystem: Nutzbar für LLMs, Dashboards, Agents etc.
```

### Technologie-Stack
- **Spice.ai v1.1.0**: MCP-Server mit SSE-API
- **DataFusion**: Schnelle SQL-Abfragen
- **Apache Arrow**: Effiziente Datenformate
- **Node.js**: GTFS-Datenverarbeitung

### Datenfluss
1. **Datenquelle:** GTFS-Daten von opentransportdata.swiss
2. **Verarbeitung:** SQL-Transformation via DataFusion
3. **Bereitstellung:** SSE-API über Spice.ai MCP
4. **Nutzung:** Direkter SQL-Zugriff für AI/LLM-Systeme

## Features

- 🚈 Integration der offiziellen **GTFS-Daten 2025** des ZVV
- ⚙️ **Spice.ai MCP** als Daten-Backend für strukturierte AI-Zugriffe
- 🔌 Bereitstellung von MCP-kompatiblen Datasets (`routes`, `stops`, etc.)
- ☁️ Deployment-fähig auf **Vercel** (z. B. als Headless Daten-Service)

## Technische Details

### Projektstruktur
```
mcp-gtfs/
├── download-gtfs.js     # Skript zum automatischen Download der GTFS-Daten
├── package.json         # Node.js-Projektkonfiguration
├── zvv-data/           # Verzeichnis für GTFS-Daten
│   └── gtfs/           # GTFS-Rohdaten (wird automatisch gefüllt)
│       └── gtfs-status.json  # Metadaten zum letzten Download
└── README.md           # Diese Dokumentation
```

### Datenbeschaffung

#### Automatischer Download-Prozess
```mermaid
sequenceDiagram
    participant S as Skript
    participant O as opentransportdata.swiss
    participant F as Dateisystem
    participant Z as ZIP-Verarbeitung

    S->>O: 1. Lade Übersichtsseite
    O-->>S: HTML mit Download-Links
    S->>S: 2. Extrahiere neuesten ZIP-Link
    S->>O: 3. Starte Download
    O-->>S: ZIP-Datei (mit Redirects)
    S->>F: 4. Speichere temporär
    S->>F: 5. Prüfe ZIP-Header
    S->>Z: 6. Entpacke ZIP
    Z->>F: 7. Schreibe GTFS-Dateien
    S->>F: 8. Erstelle Status-Datei
    S->>F: 9. Lösche temporäre ZIP
```

#### GTFS-Datenstruktur
Die GTFS-Rohdaten werden im Verzeichnis `zvv-data/gtfs/` abgelegt und nicht versioniert. Stattdessen werden sie automatisch von [opentransportdata.swiss](https://data.opentransportdata.swiss/dataset/timetable-2025-gtfs2020) bezogen.

**Kern-Datensätze:**
- `agency.txt` – Verkehrsunternehmen
- `