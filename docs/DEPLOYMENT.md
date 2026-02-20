# Deployment — LIQUIDMIND (MVP)

## Overview
Single-chain MVP on **Base Sepolia** with Goldsky subgraph + Next.js frontend.

## Prereqs
- Node.js 20+
- Foundry
- Goldsky CLI (`@goldskycom/cli`)
- WalletConnect project id

## Environment
Create `.env` at repo root (for contracts/subgraph) and `.env.local` in frontend.

### Root `.env` (contracts)
```
BASE_SEPOLIA_RPC=<rpc>
PRIVATE_KEY=<deployer>
BASESCAN_API_KEY=<optional>
```

### Frontend `.env.local`
```
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=<wc_id>
NEXT_PUBLIC_SUBGRAPH_URL=<goldsky_subgraph_url>
NEXT_PUBLIC_COORDINATOR_ADDRESS=<addr>
NEXT_PUBLIC_HOOK_ADDRESS=<addr>
NEXT_PUBLIC_BASE_SEPOLIA_RPC=<rpc>
```

## Deploy Contracts (Base Sepolia)
```
cd contracts
forge script script/Deploy.s.sol:DeployLiquidMind --rpc-url $BASE_SEPOLIA_RPC --broadcast --verify
```

## Deploy Subgraph (Goldsky)
```
cd subgraph
npm i
npm run codegen
npm run build
npm run deploy
```

## Frontend
```
cd frontend
npm i
npm run dev
```

## Notes
- MVP is **single-chain** (Base Sepolia)
- Subgraph endpoint wired into frontend (`NEXT_PUBLIC_SUBGRAPH_URL`)
