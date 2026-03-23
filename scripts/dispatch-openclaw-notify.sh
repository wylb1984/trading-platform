#!/bin/zsh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${ROOT_DIR}/.env.local"

if [[ -f "${ENV_FILE}" ]]; then
  set -a
  source "${ENV_FILE}"
  set +a
fi

SCOPE="${1:-MIXED}"
APP_URL="${OPENCLAW_NOTIFY_APP_URL:-http://127.0.0.1:3000}"
CRON_SECRET="${OPENCLAW_NOTIFY_CRON_SECRET:-}"

ARGS=(
  -sS
  -X POST
  "${APP_URL}/api/cron/openclaw-notify?scope=${SCOPE}"
  -H "Content-Type: application/json"
)

if [[ -n "${CRON_SECRET}" ]]; then
  ARGS+=(-H "x-cron-secret: ${CRON_SECRET}")
fi

curl "${ARGS[@]}"
