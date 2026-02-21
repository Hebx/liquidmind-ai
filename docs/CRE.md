# CRE Workflow Guide

Reference: [CRE docs](https://docs.chain.link/cre)

## Overview

The LiquidMind CRE workflow runs as a WASM module on the Chainlink DON. It reads live Chainlink price feeds via `EVMClient`, computes optimal liquidity parameters, and outputs calldata for on-chain execution.

## Simulate

```bash
cd liquidmind
cre login
cre workflow simulate agentic-liquidity --target staging --non-interactive --trigger-index 0
```

Trigger index `0` = cron (the only handler). Simulation compiles to WASM and executes real on-chain reads.

## Deploy (Early Access)

```bash
cd liquidmind
cre account link-key --owner-label "Liquidmind" --yes
cre workflow deploy agentic-liquidity --target staging
```

Requires `CRE_ETH_PRIVATE_KEY` with ETH on Ethereum Mainnet (for CRE registry gas).

## Workflow Steps

1. **analyzeIntent** — Fetch live ETH/USD from Chainlink, compute tick range from price + risk tolerance
2. **Volatility Oracle** — Read 5+ historical `getRoundData()` rounds, compute annualized volatility, map to fee tier
3. **coordinateAgents** — Multi-agent consensus (route optimizer, risk analyzer, yield aggregator)
4. **assessRisk** — Validate risk score against tolerance threshold
5. **executeWithPayment** — x402 escrow lock + liquidity deployment
6. **monitorPosition** — Output rebalance + updateFee calldata for on-chain submission

## Configuration

- **Workflow code:** `liquidmind/agentic-liquidity/main.ts`
- **Price feeds:** `liquidmind/agentic-liquidity/src/utils/price-feed.ts`
- **Target config:** `liquidmind/project.yaml` (RPCs for Base Sepolia + Ethereum Mainnet)
- **Schedule:** `liquidmind/agentic-liquidity/config.staging.json`

## Chain Names

- Base Sepolia: `ethereum-testnet-sepolia-base-1`
- Ethereum Mainnet: `ethereum-mainnet` (required for CRE registry when deploying)
