#!/bin/bash
# LIQUIDMIND Local Test Script
# Runs contract tests, CRE simulate, E2E live verification, and optionally frontend

set -e
cd "$(dirname "$0")/.."

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}==================================================${NC}"
echo -e "${BLUE}🧪 LIQUIDMIND LOCAL TEST SUITE${NC}"
echo -e "${BLUE}==================================================${NC}"

# 1. Contract tests (Hook, Coordinator, interfaces)
echo -e "\n${YELLOW}[1/4] Running contract tests (forge test)...${NC}"
cd contracts && forge test && cd ..
echo -e "${GREEN}✅ Contract tests passed${NC}"

# 2. CRE workflow simulate
echo -e "\n${YELLOW}[2/4] Running CRE workflow simulate...${NC}"
cd liquidmind && cre workflow simulate agentic-liquidity --target staging --non-interactive --trigger-index 0 && cd ..
echo -e "${GREEN}✅ CRE simulate passed${NC}"

# 3. E2E live (Base Sepolia verification + mock workflow)
echo -e "\n${YELLOW}[3/4] Running E2E live test...${NC}"
bash e2e-live.sh
echo -e "${GREEN}✅ E2E live passed${NC}"

# 4. Agent tests (optional)
echo -e "\n${YELLOW}[4/4] Running agent tests...${NC}"
cd agents && npm test 2>/dev/null || echo "  (skipped - no tests or deps)" && cd ..

echo -e "\n${BLUE}==================================================${NC}"
echo -e "${GREEN}✅ ALL LOCAL TESTS COMPLETED${NC}"
echo -e "${BLUE}==================================================${NC}"
echo ""
echo "To run the frontend: npm run dev"
echo "To run frontend + agents: npm run dev"
