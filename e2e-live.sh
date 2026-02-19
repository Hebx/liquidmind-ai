#!/bin/bash

# LIQUIDMIND E2E Live Test Script
# Verifies deployment on Base Sepolia and runs workflow simulation

# Load environment variables
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
fi

# Configuration
RPC_URL="https://base-sepolia.g.alchemy.com/v2/REDACTED_ALCHEMY_KEY"
COORDINATOR="0x0fd80F163d9D1a62f77bd88db2eb9fd91471DddA"
HOOK="0x15b60e98a00d83BA4B010CceDb09864d1d93d0c0"
POOL_MANAGER="0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408"
LINK_TOKEN="0xE4aB69C077896252FAFBD49EFD26B5D171A32410"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}==================================================${NC}"
echo -e "${BLUE}🚀 LIQUIDMIND E2E LIVE TEST: BASE SEPOLIA${NC}"
echo -e "${BLUE}==================================================${NC}"

# Step 1: Verify Coordinator
echo -e "\n${YELLOW}🔍 [STEP 1] Verifying LiquidMindCoordinator...${NC}"
OWNER=$(cast call $COORDINATOR "owner()(address)" --rpc-url $RPC_URL)
echo -e "  Owner: ${GREEN}$OWNER${NC}"

LOCAL_HOOK=$(cast call $COORDINATOR "localHook()(address)" --rpc-url $RPC_URL)
echo -e "  Local Hook: ${GREEN}$LOCAL_HOOK${NC}"

if [ "$LOCAL_HOOK" == "$HOOK" ]; then
    echo -e "  ${GREEN}✅ Connection Coordinator -> Hook verified${NC}"
else
    echo -e "  ${RED}❌ Connection mismatch: Expected $HOOK, got $LOCAL_HOOK${NC}"
fi

# Step 2: Verify Hook
echo -e "\n${YELLOW}🔍 [STEP 2] Verifying AgenticLiquidityHook...${NC}"
HOOK_OWNER=$(cast call $HOOK "owner()(address)" --rpc-url $RPC_URL)
echo -e "  Owner: ${GREEN}$HOOK_OWNER${NC}"

HOOK_COORDINATOR=$(cast call $HOOK "agentCoordinator()(address)" --rpc-url $RPC_URL)
echo -e "  Coordinator: ${GREEN}$HOOK_COORDINATOR${NC}"

HOOK_PM=$(cast call $HOOK "poolManager()(address)" --rpc-url $RPC_URL)
echo -e "  PoolManager: ${GREEN}$HOOK_PM${NC}"

if [ "$HOOK_COORDINATOR" == "$COORDINATOR" ]; then
    echo -e "  ${GREEN}✅ Connection Hook -> Coordinator verified${NC}"
else
    echo -e "  ${RED}❌ Connection mismatch: Expected $COORDINATOR, got $HOOK_COORDINATOR${NC}"
fi

if [ "${HOOK_PM,,}" == "${POOL_MANAGER,,}" ]; then
    echo -e "  ${GREEN}✅ PoolManager configuration verified${NC}"
else
    echo -e "  ${RED}❌ PoolManager mismatch: Expected $POOL_MANAGER, got $HOOK_PM${NC}"
fi

# Step 3: Check LINK Balance
echo -e "\n${YELLOW}🔍 [STEP 3] Checking LINK Balance...${NC}"
LINK_BAL=$(cast call $LINK_TOKEN "balanceOf(address)(uint256)" $COORDINATOR --rpc-url $RPC_URL)
echo -e "  Coordinator LINK Balance: ${GREEN}$((LINK_BAL / 10**18)) LINK${NC}"

# Step 4: Run CRE Workflow Simulation (Live Addresses)
echo -e "\n${YELLOW}🤖 [STEP 4] Running CRE Workflow Simulation...${NC}"
echo -e "  (Points to live addresses on Base Sepolia)\n"

cd cre-workflow && npm run simulate

echo -e "\n${BLUE}==================================================${NC}"
echo -e "${GREEN}✅ E2E LIVE TEST COMPLETED${NC}"
echo -e "${BLUE}==================================================${NC}"
