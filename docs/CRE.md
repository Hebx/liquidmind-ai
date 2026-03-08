# CRE Workflow Guide

Reference: [CRE docs](https://docs.chain.link/cre)

## Overview

LiquidMind's canonical CRE package is `liquidmind/agentic-liquidity`. For this milestone, the package is used to validate real Chainlink reads, compute liquidity-management actions, and support the deployed Base Sepolia hook and coordinator flow.

This document intentionally separates the current development/test trigger path from the next operator-facing milestone.

## Live Today

- Real Chainlink price reads are working through `liquidmind/agentic-liquidity/src/utils/price-feed.ts`.
- Historical round reads are used to compute volatility for fee selection.
- The workflow package produces `rebalance` and `updateFee` action payloads for the Base Sepolia contracts already documented elsewhere in the repo.
- The live truth today is Base Sepolia contract execution plus real Chainlink reads, not a fully deployed HTTP intent platform.

## Current Dev/Test Flow

### Package-level simulation

```bash
cd liquidmind/agentic-liquidity
npm install
npm run simulate
```

This is the current package-level development path.

### CRE-oriented compilation

```bash
cd liquidmind/agentic-liquidity
npm run cre-compile
```

Use this when you want to compile the workflow entrypoint for CRE validation work.

### Trigger mode today

- The current development/test configuration includes a cron-style schedule in `liquidmind/agentic-liquidity/config.staging.json`.
- Treat that scheduled trigger as the current simulation and validation path.
- Do not treat cron-only triggering as the final intended operator experience.

## Next Milestone

### HTTP-triggered intent flow

The next milestone is an HTTP-triggered intent flow for `liquidmind/agentic-liquidity`:

- accept external intent payloads
- validate and translate them into workflow inputs
- turn them into coordinator calls for rebalance and fee updates

The repo may already contain configuration scaffolding for HTTP triggers, but this document does not claim that path is the live production workflow yet.

## Deferred / Not Claimed Live

- Real A2A orchestration
- `x402` payment flows
- Production cross-chain automation

If those capabilities land later, they should be documented with separate verification evidence before being described as live.

## Workflow Files

- **Workflow code:** `liquidmind/agentic-liquidity/main.ts`
- **Price feeds:** `liquidmind/agentic-liquidity/src/utils/price-feed.ts`
- **Workflow config:** `liquidmind/agentic-liquidity/workflow.yaml`
- **Current staging config:** `liquidmind/agentic-liquidity/config.staging.json`

## Notes

- `cre-workflow/` is legacy reference material, not the current implementation target for this milestone.
- Use the deployment docs for live Base Sepolia contract evidence and current milestone status.
