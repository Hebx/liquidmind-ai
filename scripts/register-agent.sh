#!/usr/bin/env bash
# Register an agent on LiquidMindCoordinator (owner only).
# Usage:
#   export COORDINATOR_OWNER_PRIVATE_KEY=0x...  # or PRIVATE_KEY if you use that for owner
#   export AGENT_ADDRESS=0x...                 # the address to register (e.g. from cast wallet address --private-key $AGENT_PRIVATE_KEY)
#   bash scripts/register-agent.sh
#
# Or one-shot:
#   AGENT_ADDRESS=0xYourAgentAddress COORDINATOR_OWNER_PRIVATE_KEY=0xYourOwnerKey bash scripts/register-agent.sh

set -euo pipefail

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1090
  source .env
  set +a
fi

COORDINATOR="${LIQUIDMIND_COORDINATOR_ADDRESS:-0x68F321d6d33b23bAFC03CC4d84b1dBbe7cBFd063}"
RPC_URL="${BASE_SEPOLIA_RPC:?Set BASE_SEPOLIA_RPC in .env}"
AGENT_ADDRESS="${AGENT_ADDRESS:?Set AGENT_ADDRESS (the address to register as agent)}"
OWNER_KEY="${COORDINATOR_OWNER_PRIVATE_KEY:-${PRIVATE_KEY:?Set COORDINATOR_OWNER_PRIVATE_KEY or PRIVATE_KEY (coordinator owner key)}}"

echo "Registering agent $AGENT_ADDRESS on coordinator $COORDINATOR (Base Sepolia)..."
cast send "$COORDINATOR" "registerAgent(address)" "$AGENT_ADDRESS" \
  --rpc-url "$RPC_URL" \
  --private-key "$OWNER_KEY"

echo "Done. Verify with: cast call $COORDINATOR \"getAgent(address)(bool,uint256,uint256)\" $AGENT_ADDRESS --rpc-url \$BASE_SEPOLIA_RPC"
