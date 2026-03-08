# Deployment Guide

This document separates what is live now from what is still planned for the CRE milestone.

## Canonical CRE Package

Use `liquidmind/agentic-liquidity` as the source of truth for the workflow in this milestone. The older `cre-workflow/` directory is legacy reference material, not the active path for root scripts or current deployment guidance.

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
npm run simulate
```

Use this package to validate the current workflow logic and real Chainlink feed reads. If you need a compiled workflow artifact, run:

```bash
cd liquidmind/agentic-liquidity
npm run cre-compile
```

### Existing end-to-end script

```bash
export AGENT_PRIVATE_KEY=<your-key>
bash e2e-live.sh
```

This is the current milestone evidence path: contract wiring, simulated CRE output, and on-chain rebalance or fee update execution.

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
cp .env.example .env.local
npm install
npm run dev
```

Use the frontend for local inspection and demos. Do not treat it as evidence that the HTTP-triggered workflow milestone is already deployed.
