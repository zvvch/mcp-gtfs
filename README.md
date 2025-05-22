# ZVV-GTS-MCP Server

## Übersicht

**ZVV-GTS-MCP** ist ein serverseitiges Projekt zur Aufbereitung und Bereitstellung von ÖV-Daten des **Zürcher Verkehrsverbunds (ZVV)** auf Basis der GTFS-Daten von [opentransportdata.swiss](https://data.opentransportdata.swiss/dataset/timetable-2025-gtfs2020).

Das Ziel ist es, diese Daten strukturiert über die **Spice.ai MCP Engine** zugänglich zu machen – als Schnittstelle für nachgelagerte AI-Projekte, Datenanalysen oder LLM-Abfragen.

> ✳️ **Hinweis:** Dieses Projekt stellt kein Chat-Interface oder Frontend bereit. Es fokussiert sich ausschliesslich auf die Datenverfügbarkeit über MCP.

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
- `stops.txt` – Haltestellen
- `routes.txt` – Linien
- `trips.txt` – Fahrten
- `stop_times.txt` – Haltestellenzeiten
- `calendar.txt` – Betriebstage
- `calendar_dates.txt` – Ausnahmen
- `feed_info.txt` – Metadaten
- `transfers.txt` – Umsteigebeziehungen

> **Hinweis:** `shapes.txt` (Linienführungen) ist in der Schweizer GTFS-Implementierung nicht enthalten.

## Deployment

### Docker-Konfiguration

Das Projekt verwendet Docker für eine konsistente Entwicklungsumgebung. Die Konfiguration besteht aus zwei Hauptdateien:

#### Dockerfile
```dockerfile
# Basis-Image mit Node.js
FROM node:20-slim

# Spice.ai Installation
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Spice.ai CLI installieren
RUN curl -L https://github.com/spiceai/spiceai/releases/latest/download/spice_linux_amd64.tar.gz | tar xz \
    && mv spice /usr/local/bin/ \
    && chmod +x /usr/local/bin/spice

# Arbeitsverzeichnis
WORKDIR /app

# Dependencies installieren
COPY package*.json ./
RUN npm install

# Quellcode kopieren
COPY . .

# Port freigeben
EXPOSE 3000

# Startbefehl
CMD ["npm", "start"]
```

#### docker-compose.yml
```yaml
version: '3.8'

services:
  mcp-gtfs:
    build: .
    ports:
      - "3000:3000"
    volumes:
      - .:/app
      - /app/node_modules
    environment:
      - NODE_ENV=development
    command: npm start
```

### Lokale Entwicklung

#### Voraussetzungen
- Docker Desktop (Windows/Mac) oder Docker Engine (Linux)
- Docker Compose
- Mindestens 2GB freier RAM
- Mindestens 1GB freier Festplattenspeicher

#### Erste Schritte
1. **Docker installieren:**
   - Windows/Mac: [Docker Desktop](https://www.docker.com/products/docker-desktop)
   - Linux: [Docker Engine](https://docs.docker.com/engine/install/)

2. **Projekt starten:**
```bash
# Container bauen und starten
docker-compose up --build

# Oder im Hintergrund
docker-compose up -d
```

3. **Status prüfen:**
```bash
# Container-Status anzeigen
docker-compose ps

# Logs anzeigen
docker-compose logs -f
```

4. **Container stoppen:**
```bash
# Container beenden
docker-compose down

# Container und Volumes entfernen
docker-compose down -v
```

#### Wichtige Docker-Befehle
```bash
# Container neu bauen
docker-compose build

# Container neu starten
docker-compose restart

# Logs anzeigen
docker-compose logs -f

# Shell im Container öffnen
docker-compose exec mcp-gtfs sh
```

#### Entwicklungshinweise
- Der Code wird über ein Volume gemountet, Änderungen sind sofort sichtbar
- `node_modules` ist in einem separaten Volume, um Konflikte zu vermeiden
- Die GTFS-Daten werden automatisch heruntergeladen beim ersten Start
- Der Server ist über `http://localhost:3000/v1/mcp/sse` erreichbar

### Vercel Deployment
Das Projekt ist für Vercel optimiert:
- Verwendet das gleiche Docker-Image wie lokal
- Automatische GTFS-Datenaktualisierung
- Serverless-Funktionen für die API

### Datenverwaltung

#### Automatische GTFS-Datenaktualisierung
Das System prüft bei jedem Start, ob alle erforderlichen GTFS-Dateien vorhanden sind:

**Erforderliche Dateien:**
- `agency.txt` – Verkehrsunternehmen
- `stops.txt` – Haltestellen
- `routes.txt` – Linien
- `trips.txt` – Fahrten
- `stop_times.txt` – Haltestellenzeiten
- `calendar.txt` – Betriebstage
- `calendar_dates.txt` – Ausnahmen
- `feed_info.txt` – Metadaten
- `transfers.txt` – Umsteigebeziehungen

**Intelligenter Download:**
- ✅ Prüft zuerst, ob alle Dateien vorhanden sind
- ✅ Lädt nur bei fehlenden Dateien neu
- ✅ Spart Bandbreite und Zeit
- ✅ Verhindert unnötige Downloads

#### Server starten
```bash
npm start
```

Der Server ist dann über `http://localhost:3000/v1/mcp/sse` erreichbar.

### Status-Tracking
Nach jedem erfolgreichen Download wird eine `gtfs-status.json` erzeugt mit:
- Dateiname
- Download-URL
- Zeitstempel
- Quelle

## Lizenz & Quellen

- GTFS-Daten: [opentransportdata.swiss – Fahrplan 2025 (GTFS2020)](https://data.opentransportdata.swiss/de/dataset/timetable-2025-gtfs2020)
- Spice.ai MCP: [Dokumentation](https://docs.spiceai.org/)
