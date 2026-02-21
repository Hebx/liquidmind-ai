# Deployment Guide

## Prerequisites

- [Foundry](https://book.getfoundry.sh/getting-started/installation)
- [CRE CLI](https://docs.chain.link/cre)
- Node.js 18+

## Environment Setup

```bash
cp .env.example .env
# Fill in: BASE_SEPOLIA_RPC, PRIVATE_KEY
```

## Deploy Contracts

```bash
cd contracts
forge script script/Deploy.s.sol:DeployLiquidMind \
  --rpc-url $BASE_SEPOLIA_RPC \
  --broadcast
```

This deploys `LiquidMindCoordinator` and `AgenticLiquidityHook`, wires them together, and registers the deployer as the first agent.

## Initialize Pool + Test Flow

```bash
cd contracts
forge script script/TestnetFlow.s.sol:TestnetFlow \
  --rpc-url $BASE_SEPOLIA_RPC \
  --broadcast
```

Deploys test routers, initializes a USDC/WETH pool with the hook, adds liquidity, and executes swaps.

## Run E2E Tests

```bash
export AGENT_PRIVATE_KEY=<your-key>
bash e2e-live.sh
```

## Frontend

```bash
cd frontend
cp .env.example .env.local
# Fill in contract addresses and RPC
npm install
npm run dev
```

## Subgraph (Goldsky)

```bash
cd subgraph
npm install
npm run codegen
npm run build
npm run deploy
```
