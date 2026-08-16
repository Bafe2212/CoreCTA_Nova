# NOVA Frontend — Vite-Production-Build, ausgeliefert via nginx

# --- Build-Stage ---
FROM node:22-slim AS builder

WORKDIR /app

# Erst deps installieren (besserer Layer-Cache)
COPY package.json package-lock.json ./
RUN npm ci

# Restlichen Code kopieren und bauen
COPY . .
RUN npm run build

# --- Runtime-Stage ---
FROM nginx:1.27-alpine

# nginx-Konfiguration mit /api-Proxy zum Backend-Container
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Build-Output in das nginx-Webroot kopieren
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
