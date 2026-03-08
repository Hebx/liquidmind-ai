# Deployment Guide

This document separates what is live now from what is still planned for the CRE milestone.

## Canonical CRE Package

Use `liquidmind/agentic-liquidity` as the source of truth for the workflow in this milestone. The older `cre-workflow/` directory is legacy reference material, not the active path for root scripts or current deployment guidance.

## Prerequisites

- Foundry
- Node.js 18+
- Bun (`npm run validate:real` shells out to `bunx cre-compile`)
- npm
- A Base Sepolia RPC URL
- A funded Base Sepolia EOA for contract deployment and any on-chain submission checks
- Optional: CRE CLI plus an authenticated session (`cre login`) if you want to run `cre workflow simulate` or prepare a real workflow deploy

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
cp liquidmind/agentic-liquidity/.env.example liquidmind/agentic-liquidity/.env
```

Use this env file for package-local RPC-backed helpers and shared workflow preparation. The current `npm run validate:real` path only compiles `main.ts`; it does not deploy a workflow and does not require a CRE wallet.

Important notes for the current package flow:

- `BASE_SEPOLIA_RPC` is the key runtime input when the canonical HTTP/shared workflow path needs live market data.
- `PRIVATE_KEY` is not required for `npm run validate:real`; it is only relevant if you reuse local wallet-based scripts outside the compile-only validation path.
- Leave `CRE_ETH_PRIVATE_KEY` unset unless you intentionally need a wallet-authenticated CRE operation. The current CLI simulation flow in `e2e-live.sh` explicitly unsets stale CRE wallet globals because they can override normal CLI auth and break simulation.

### Frontend

The frontend already ships with `frontend/.env.example`. Copy it to `frontend/.env.local` and fill in the values the current UI and server route actually read:

```bash
cp frontend/.env.example frontend/.env.local
```

Required or commonly used frontend values:

- `NEXT_PUBLIC_BASE_SEPOLIA_RPC`
- `NEXT_PUBLIC_COORDINATOR_ADDRESS`
- `NEXT_PUBLIC_HOOK_ADDRESS`
- `NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID`
- Optional: `NEXT_PUBLIC_SUBGRAPH_URL` for subgraph-backed activity panels
- Required for the server-side `/api/intent` route: `INTENT_PARSER_API_URL` or `INTENT_PARSER_BASE_URL`, plus `INTENT_PARSER_API_KEY` and `INTENT_PARSER_MODEL`
- Optional for `/api/intent`: `INTENT_PARSER_TIMEOUT_MS`

The frontend route handlers also accept `BASE_SEPOLIA_RPC` server-side, but `NEXT_PUBLIC_BASE_SEPOLIA_RPC` is enough for the current local UI if you are comfortable exposing the same public RPC URL to the browser.

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

Use this package to validate the real CRE workflow entrypoint and confirm that `main.ts` still compiles for CRE execution. The canonical output is a `rebalance` payload, with an optional `updateFee` sidecar emitted when live volatility analysis succeeds.

This command is compile-only validation. It does not deploy an HTTP-triggered workflow to Chainlink, does not provision secrets, and does not by itself prove the operator-facing intent path is live.

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

### CRE CLI simulation and future HTTP deployment prerequisites

If you move beyond compile-only validation and want to use `cre workflow simulate` or prepare a real HTTP-triggered deploy, verify these prerequisites first:

1. Install the CRE CLI and confirm your session is authenticated with `cre login` / `cre whoami`.
2. Review `liquidmind/agentic-liquidity/workflow.yaml` to make sure you are targeting the intended `staging` or `production` config file.
3. Review `liquidmind/agentic-liquidity/config.staging.json` or `config.production.json` before any real deploy. The checked-in `authorizedKeys` entry is the current repo/testnet key, not a generic production default.
4. Replace `authorizedKeys` with the EVM public key(s) that should be allowed to call the workflow's HTTP trigger. Those keys gate the CRE HTTP entrypoint; they are not automatically inferred from `AGENT_PRIVATE_KEY` or your local `.env`.
5. Keep stale root-level placeholders such as `CRE_GATEWAY_URL`, `CRE_WORKFLOW_ID`, and `CRE_API_KEY` out of your shell unless you have actually provisioned them. Placeholder globals can send the CLI down the wrong auth path and make simulation or deployment look healthier than it is.

The repo currently documents compile and simulation readiness, not a proven live HTTP-triggered CRE deployment.

### Existing end-to-end script

```bash
export AGENT_PRIVATE_KEY=<your-key>
bash e2e-live.sh
```

`AGENT_PRIVATE_KEY` must be a funded Base Sepolia EOA that the deployed `LiquidMindCoordinator` already recognizes as an authorized agent. The deploy script registers the deployer as the first agent; any different wallet must be registered on-chain first. With that variable set, `e2e-live.sh` can prove the current submission bridge for the canonical `rebalance` action and the optional `updateFee` sidecar action. Without it, the script is only partial evidence and does not prove on-chain submission.

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
