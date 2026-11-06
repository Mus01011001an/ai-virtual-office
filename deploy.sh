#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# AI VIRTUAL OFFICE - ULTRA-FAST 1-SCRIPT RSYNC DEPLOYMENT ENGINE
# ==============================================================================
# Target Host  : 192.168.64.10 (Debian 13 ARM64)
# Remote User  : musyan
# Frontend URL : https://office.musyan.my.id
# Backend API  : https://office-api.musyan.my.id/api/v1
# ==============================================================================

SERVER_HOST="192.168.64.10"
SERVER_USER="musyan"
SSH_IDENTITY="${HOME}/.ssh/id_musyan"

REMOTE_BE_DIR="/home/musyan/projects/apps/backend/ai-virtual-office"
REMOTE_FE_DIR="/home/musyan/projects/apps/frontend/ai-virtual-office"

GREEN="\033[0;32m"
YELLOW="\033[0;33m"
CYAN="\033[0;36m"
RED="\033[0;31m"
BOLD="\033[1m"
NC="\033[0m"

log_info()  { echo -e "${CYAN}ℹ️  ${BOLD}$*${NC}"; }
log_ok()    { echo -e "${GREEN}✅ ${BOLD}$*${NC}"; }
log_warn()  { echo -e "${YELLOW}⚠️  ${BOLD}$*${NC}"; }
log_error() { echo -e "${RED}❌ ${BOLD}$*${NC}"; }

ssh_cmd() {
  ssh -i "${SSH_IDENTITY}" -o StrictHostKeyChecking=accept-new "${SERVER_USER}@${SERVER_HOST}" "$@"
}

ensure_remote_dirs() {
  log_info "Memastikan direktori remote tersedia..."
  ssh_cmd "mkdir -p '${REMOTE_BE_DIR}' '${REMOTE_FE_DIR}/dist'"
}

# ------------------------------------------------------------------------------
# 1. DEPLOY FRONTEND
# ------------------------------------------------------------------------------
deploy_frontend() {
  log_info "Memulai proses build Frontend (3D Virtual Office)..."
  local start_time=$(date +%s)

  # Export API URL produksi untuk bundel Vite
  VITE_API_URL="https://office-api.musyan.my.id/api/v1" npm --prefix frontend run build

  log_ok "Build Frontend sukses! Memulai Rsync ke ${SERVER_HOST}..."

  rsync -avz --delete \
    -e "ssh -i ${SSH_IDENTITY} -o StrictHostKeyChecking=accept-new" \
    frontend/dist/ \
    "${SERVER_USER}@${SERVER_HOST}:${REMOTE_FE_DIR}/dist/"

  # Pastikan file dist terbaca oleh Nginx
  ssh_cmd "chmod -R 755 '${REMOTE_FE_DIR}'"

  local duration=$(( $(date +%s) - start_time ))
  log_ok "Frontend berhasil dideploy dalam ${duration} detik! URL: https://office.musyan.my.id"
}

# ------------------------------------------------------------------------------
# 2. DEPLOY BACKEND
# ------------------------------------------------------------------------------
deploy_backend() {
  log_info "Memulai proses build Backend (NestJS)..."
  local start_time=$(date +%s)

  npm --prefix backend run build

  log_ok "Build Backend sukses! Memulai Rsync ke ${SERVER_HOST}..."

  # Sinkronkan dist, package.json, prisma schema, dan konfigurasi
  rsync -avz \
    -e "ssh -i ${SSH_IDENTITY} -o StrictHostKeyChecking=accept-new" \
    --exclude="node_modules" \
    --exclude=".git" \
    backend/dist/ \
    "${SERVER_USER}@${SERVER_HOST}:${REMOTE_BE_DIR}/dist/"

  rsync -avz \
    -e "ssh -i ${SSH_IDENTITY} -o StrictHostKeyChecking=accept-new" \
    backend/package.json \
    backend/package-lock.json \
    backend/prisma \
    backend/prisma.config.ts \
    backend/tsconfig.json \
    "${SERVER_USER}@${SERVER_HOST}:${REMOTE_BE_DIR}/"

  log_info "Memeriksa dependensi dan migrasi database di server remote..."
  ssh_cmd "bash -c '
    cd \"${REMOTE_BE_DIR}\"
    if [ ! -d \"node_modules\" ]; then
      echo \"Menginstall production node_modules di remote...\"
      npm install --omit=dev --ignore-scripts
    fi
    echo \"Regenerasi Prisma Client remote...\"
    npx prisma generate
    echo \"Menjalankan migrasi skema database...\"
    npx prisma migrate deploy || true
    echo \"Reloading PM2 process (office-api)...\"
    pm2 describe office-api >/dev/null 2>&1 && pm2 reload office-api || pm2 start dist/src/main.js --name office-api --time
    pm2 save
  '"

  local duration=$(( $(date +%s) - start_time ))
  log_ok "Backend berhasil dideploy dalam ${duration} detik! API: https://office-api.musyan.my.id/api/v1"
}

# ------------------------------------------------------------------------------
# 3. REMOTE UTILITIES
# ------------------------------------------------------------------------------
run_migration() {
  log_info "Menjalankan migrasi database di remote..."
  ssh_cmd "cd '${REMOTE_BE_DIR}' && npx prisma migrate deploy"
  log_ok "Migrasi database selesai!"
}

check_status() {
  log_info "Memeriksa status layanan di ${SERVER_HOST}..."
  ssh_cmd "pm2 status office-api; echo '--- NGINX STATUS ---'; systemctl status nginx --no-pager | head -n 5; echo '--- CLOUDFLARED STATUS ---'; systemctl status cloudflared --no-pager | head -n 5"
}

view_logs() {
  log_info "Streaming log office-api dari remote (Ctrl+C untuk keluar)..."
  ssh_cmd "pm2 logs office-api --lines 50"
}

# ------------------------------------------------------------------------------
# MAIN ENTRYPOINT
# ------------------------------------------------------------------------------
COMMAND="${1:-all}"

case "$COMMAND" in
  fe|frontend)
    ensure_remote_dirs
    deploy_frontend
    ;;
  be|backend)
    ensure_remote_dirs
    deploy_backend
    ;;
  all)
    ensure_remote_dirs
    deploy_frontend
    deploy_backend
    echo ""
    log_ok "🎉 SELURUH SISTEM AI VIRTUAL OFFICE BERHASIL DIDELPOY!"
    log_info "Frontend 3D Canvas : https://office.musyan.my.id"
    log_info "Backend API Health : https://office-api.musyan.my.id/api/v1/health"
    log_info "Swagger API Docs   : https://office-api.musyan.my.id/api/docs"
    ;;
  migrate)
    run_migration
    ;;
  status)
    check_status
    ;;
  logs)
    view_logs
    ;;
  *)
    echo "Penggunaan: $0 {all|fe|be|migrate|status|logs}"
    exit 1
    ;;
esac
