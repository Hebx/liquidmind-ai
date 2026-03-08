# LiquidMind CRE Workflow Package

Canonical CRE package for the current milestone.

This directory, `liquidmind/agentic-liquidity`, is the active workflow path for LiquidMind. It is the package used to validate real Chainlink reads, compute liquidity management actions, and prepare the next HTTP-triggered intent milestone.

## Milestone Status

### Live Today

- Real Chainlink price reads are implemented through `src/utils/price-feed.ts`.
- Historical round reads for volatility are implemented and used for fee selection.
- The workflow computes `rebalance` and `updateFee` action payloads for the deployed Base Sepolia contracts.
- Base Sepolia contract execution is validated elsewhere in the repo through the coordinator and hook flows.

### Current Dev/Test Flow

- Local development and testing use this package directly.
- `npm run simulate` is the current package-level validation path.
- `npm run cre-compile` is available when you want to compile the workflow entrypoint for CRE-oriented validation.
- Cron-style scheduling is part of the current simulation and configuration path for development, not the final operator-facing architecture.

### Next Milestone

- Accept HTTP-triggered intent payloads into the workflow.
- Make intent ingestion the primary operator-facing entrypoint.
- Carry validated intents through to coordinator execution on Base Sepolia.

### Deferred

- Real A2A orchestration is not part of the current live path.
- `x402` payment flows are not part of the current live path.
- Production cross-chain automation is not part of the current live path unless separately proven.

## Quick Start

### Install

```bash
cd liquidmind/agentic-liquidity
npm install
```

### Simulate Current Workflow Logic

```bash
cd liquidmind/agentic-liquidity
npm run simulate
```

Use this to validate the current development flow and inspect computed outputs locally.

### Compile the Workflow Entry Point

```bash
cd liquidmind/agentic-liquidity
npm run cre-compile
```

This compiles `main.ts` to a CRE workflow artifact for further validation.

## Current Workflow Shape

The current package focuses on:

1. Reading live ETH/USD data from Chainlink.
2. Reading historical feed rounds to compute volatility.
3. Mapping volatility and risk settings into fee and tick guidance.
4. Producing action payloads for coordinator-driven `rebalance` and `updateFee` execution.

The package should not be read as evidence that A2A or `x402` execution is already part of the live milestone.

## Package Structure

```text
liquidmind/agentic-liquidity/
|- main.ts                     # CRE workflow entrypoint
|- workflow.yaml               # CRE workflow config
|- config.staging.json         # Current dev/test trigger config
|- config.production.json      # Production-oriented config scaffold
|- src/utils/price-feed.ts     # Chainlink price and volatility reads
|- src/mock-workflow.ts        # Local simulation flow
`- package.json                # Package scripts and dependencies
```

## Configuration Notes

- `workflow.yaml` points CRE builds at `main.ts`.
- `config.staging.json` currently supports the development/test trigger configuration.
- The repo includes HTTP-trigger configuration scaffolding, but the operator-facing HTTP intent flow is still the next milestone rather than a completed live path.

## Validation Guidance

- Use `npm run simulate` for package-level validation.
- Use the repo-level deployment and status docs for live Base Sepolia contract evidence.
- Treat `cre-workflow/` as legacy material if you encounter it elsewhere in the repo.

## Resources

- [Chainlink CRE Docs](https://docs.chain.link/cre)
- [Root README](../../README.md)
- [Deployment Guide](../../docs/DEPLOYMENT.md)
- [Deployment Status](../../docs/DEPLOYMENT_STATUS.md)

## License

MIT License - see [LICENSE](../../LICENSE).
