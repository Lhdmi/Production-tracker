# syntax=docker/dockerfile:1

# --- Étape 1 : installation des dépendances + build du frontend ---
FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
COPY backend/package.json ./backend/package.json
COPY frontend/package.json ./frontend/package.json
RUN npm ci

COPY backend ./backend
COPY frontend ./frontend
RUN npm run build

# --- Étape 2 : image d'exécution (backend Express + SPA + uploads) ---
FROM node:20-alpine AS runner
ENV NODE_ENV=production
WORKDIR /app

COPY package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/backend ./backend
COPY --from=builder /app/frontend/dist ./frontend/dist

RUN mkdir -p /app/uploads

EXPOSE 3001
CMD ["node", "backend/src/index.js"]
