# Pola Dockerfile backend Musyan. Build dari root repo:
#   docker build -f backend/Dockerfile -t avo-backend .
# Migrasi TIDAK dijalankan saat build — jalankan `npx prisma migrate deploy` sebelum container baru dinyalakan.

# ==========================
# Build Stage
# ==========================
FROM node:22-alpine AS builder
WORKDIR /app
ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy"

COPY backend/package*.json ./
COPY backend/prisma ./prisma
COPY backend/prisma.config.ts ./
RUN npm ci
COPY backend/ .
RUN npx prisma generate
RUN npm run build

# ==========================
# Production Stage
# ==========================
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./

EXPOSE 8010
# /api/v1/health publik & tanpa DB
HEALTHCHECK --interval=10s --timeout=5s --start-period=60s --retries=6 \
  CMD wget -qO /dev/null http://127.0.0.1:8010/api/v1/health || exit 1
CMD ["npm", "run", "start:prod"]
