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