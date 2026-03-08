#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${CRE_ENV_FILE:-$SCRIPT_DIR/.env}"
PROJECT_FILE="$SCRIPT_DIR/project.yaml"
BACKUP_FILE="$(mktemp)"

cleanup() {
  cp "$BACKUP_FILE" "$PROJECT_FILE"
  rm -f "$BACKUP_FILE"
}

cp "$PROJECT_FILE" "$BACKUP_FILE"
trap cleanup EXIT

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

: "${BASE_SEPOLIA_RPC:?Set BASE_SEPOLIA_RPC in $ENV_FILE}"

BASE_SEPOLIA_RPC="$BASE_SEPOLIA_RPC" envsubst '${BASE_SEPOLIA_RPC}' < "$BACKUP_FILE" > "$PROJECT_FILE"

if [[ -n "${CRE_ETH_PRIVATE_KEY:-}" ]]; then
  export CRE_ETH_PRIVATE_KEY="${CRE_ETH_PRIVATE_KEY#0x}"
elif [[ -n "${PRIVATE_KEY:-}" ]]; then
  export CRE_ETH_PRIVATE_KEY="${PRIVATE_KEY#0x}"
fi

cd "$SCRIPT_DIR"

# The repo root `.env` still contains historical placeholder CRE variables.
# Clear them so the CLI uses the browser-authenticated session instead.
unset CRE_API_KEY CRE_GATEWAY_URL CRE_WORKFLOW_ID PRIVATE_KEY

cre workflow activate agentic-liquidity -R "$SCRIPT_DIR" -e "$ENV_FILE" -T "${CRE_TARGET:-staging-settings}" --yes "$@"
