# Deployment Guide

This document separates what is live now from what is still planned for the CRE milestone.

## Canonical CRE Package

Use `liquidmind/agentic-liquidity` as the source of truth for the workflow in this milestone. The older `cre-workflow/` directory is legacy reference material, not the active path for root scripts or current deployment guidance.

## Prerequisites

- Foundry
- Node.js 18+
- npm
- A Base Sepolia RPC URL
- A funded private key for testnet contract actions
- Optional: CRE CLI if you want to compile or validate CRE artifacts locally

## Environment Setup

### Contracts

Create `contracts/.env` from the example values:

```bash
cat > contracts/.env <<'EOF'
BASE_SEPOLIA_RPC=https://base-sepolia.g.alchemy.com/v2/YOUR_KEY
PRIVATE_KEY=0xYOUR_PRIVATE_KEY
BASESCAN_API_KEY=YOUR_BASESCAN_API_KEY
EOF
```

Minimum required for the documented contract commands:

- `BASE_SEPOLIA_RPC`
- `PRIVATE_KEY`

### Canonical CRE package

Create `liquidmind/agentic-liquidity/.env` from the package example:

```bash
cat > liquidmind/agentic-liquidity/.env <<'EOF'
BASE_SEPOLIA_RPC=https://base-sepolia.g.alchemy.com/v2/YOUR_KEY
PRIVATE_KEY=0xYOUR_PRIVATE_KEY
CRE_ETH_PRIVATE_KEY=0xYOUR_PRIVATE_KEY
EOF
```

Use this env file for local simulation and CRE-oriented validation work. It supports the current development flow; it does not mean the HTTP-triggered operator path is already live.

### Frontend

The frontend does not ship with an `.env.example`, so set the values it currently reads in `frontend/.env.local`:

```bash
cat > frontend/.env.local <<'EOF'
NEXT_PUBLIC_BASE_SEPOLIA_RPC=https://base-sepolia.g.alchemy.com/v2/YOUR_KEY
NEXT_PUBLIC_COORDINATOR_ADDRESS=0x268c2E3D23f5cDDAA0D0B40142053414cC05991b
NEXT_PUBLIC_HOOK_ADDRESS=0xC28ed0595D42ec01A2F7546f39Cf27Ea798598C0
NEXT_PUBLIC_SUBGRAPH_URL=https://YOUR_SUBGRAPH_URL
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=YOUR_PROJECT_ID
EOF
```

The frontend also accepts `BASE_SEPOLIA_RPC` server-side, but the `NEXT_PUBLIC_*` variables above are the clearest way to run the current UI locally.

## Live Now

### Base Sepolia contracts

```bash
cd contracts
forge script script/Deploy.s.sol:DeployLiquidMind \
  --rpc-url "$BASE_SEPOLIA_RPC" \
  --broadcast
```

This deploys `LiquidMindCoordinator` and `AgenticLiquidityHook`, wires them together, and registers the deployer as the first agent.

### Current CRE validation path

```bash
cd liquidmind/agentic-liquidity
npm install
npm run validate:real
```

Use this package to validate the real CRE workflow entrypoint and confirm that `main.ts` still compiles for CRE execution.

If you need a compiled workflow artifact, run:

```bash
cd liquidmind/agentic-liquidity
npm run cre-compile
```

If you want the root-script equivalent, you can also run:

```bash
npm run validate:cre
```

`npm run simulate:mock` remains available only for the legacy local-demo flow and should not be used as the primary validation command for the live milestone path.

### Existing end-to-end script

```bash
export AGENT_PRIVATE_KEY=<your-key>
bash e2e-live.sh
```

`AGENT_PRIVATE_KEY` should correspond to the test wallet you want the script to use. With that variable set, `e2e-live.sh` can prove the current submission bridge for rebalance or `updateFee` actions. Without it, the script is only partial evidence and does not prove on-chain submission.

## Next Milestone

### HTTP-triggered intent flow

The next delivery is an HTTP-triggered CRE flow that accepts intent payloads and turns them into coordinator calls from `liquidmind/agentic-liquidity`. That flow is not the live deployment path yet, so this document does not present it as deployed.

## Deferred / Not Live

- `x402` payment flows are deferred.
- Real A2A orchestration is deferred.
- Production cross-chain or CCIP-triggered automation is deferred unless independently proven live.
- Frontend and subgraph work may still be useful locally, but they are not part of the milestone's live deployment claims.

## Local Frontend Development

```bash
cd frontend
npm install
npm run dev
```

Use the frontend for local inspection and demos after creating `frontend/.env.local` with the variables listed above. Do not treat it as evidence that the HTTP-triggered workflow milestone is already deployed.
