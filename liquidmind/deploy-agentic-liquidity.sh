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
: "${ETH_MAINNET_RPC:?Set ETH_MAINNET_RPC in your shell or env file before CRE deploy}"

if [[ -n "${CRE_ETH_PRIVATE_KEY:-}" ]]; then
  export CRE_ETH_PRIVATE_KEY="${CRE_ETH_PRIVATE_KEY#0x}"
elif [[ -n "${PRIVATE_KEY:-}" ]]; then
  export CRE_ETH_PRIVATE_KEY="${PRIVATE_KEY#0x}"
fi

cat > "$PROJECT_FILE" <<EOF
# CRE Project Settings
# Base Sepolia remains the active CRE testnet target for this project.

staging-settings:
  rpcs:
    - chain-name: ethereum-testnet-sepolia-base-1
      url: ${BASE_SEPOLIA_RPC}
    - chain-name: ethereum-mainnet
      url: ${ETH_MAINNET_RPC}

production-settings:
  rpcs:
    - chain-name: ethereum-testnet-sepolia-base-1
      url: ${BASE_SEPOLIA_RPC}
    - chain-name: ethereum-mainnet
      url: ${ETH_MAINNET_RPC}
EOF

cd "$SCRIPT_DIR"

# The repo root `.env` still contains historical placeholder CRE variables.
# Clear them so the CLI uses the browser-authenticated session instead.
unset CRE_API_KEY CRE_GATEWAY_URL CRE_WORKFLOW_ID PRIVATE_KEY

cre workflow deploy agentic-liquidity -R "$SCRIPT_DIR" -e "$ENV_FILE" -T "${CRE_TARGET:-staging-settings}" --yes "$@"
