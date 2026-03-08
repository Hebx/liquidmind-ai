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

cd "$SCRIPT_DIR"
cre workflow simulate agentic-liquidity -e "$ENV_FILE" -T "${CRE_TARGET:-staging-settings}" "$@"
