# LiquidMind CRE Workflow Package

Canonical CRE package for the current milestone.

This directory, `liquidmind/agentic-liquidity`, is the active workflow path for LiquidMind. It is the package used to validate real Chainlink reads, compute liquidity management actions, and prepare the next HTTP-triggered intent milestone.

## Milestone Status

### Live Today

- Real Chainlink price reads are implemented through `src/utils/price-feed.ts`.
- Historical round reads for volatility are implemented and used for fee selection.
- The workflow computes a canonical `rebalance` action payload and may emit an `updateFee` sidecar payload from live volatility analysis for the deployed Base Sepolia contracts.
- Base Sepolia contract execution is validated elsewhere in the repo through the coordinator and hook flows.

### Current Dev/Test Flow

- Local development and testing use this package directly.
- `npm run validate:real` is the canonical package-level validation path for the real CRE workflow entrypoint.
- `npm run cre-compile` is the direct compile command behind that real-workflow validation path.
- `npm run simulate:mock` remains available only for legacy local demo output.
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

### Validate the Real CRE Workflow Entry Point

```bash
cd liquidmind/agentic-liquidity
npm run validate:real
```

Use this to validate the canonical CRE workflow entrypoint used for the current milestone.

### Legacy Local Mock Demo

```bash
cd liquidmind/agentic-liquidity
npm run simulate:mock
```

This executes `src/mock-workflow.ts`, which is retained for local demo output only. It is not evidence of the live milestone path.

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
4. Producing a coordinator-driven `rebalance` payload plus an optional `updateFee` sidecar when live volatility analysis succeeds.

The package should not be read as evidence that A2A or `x402` execution is already part of the live milestone.

## Package Structure

```text
liquidmind/agentic-liquidity/
|- main.ts                     # CRE workflow entrypoint
|- workflow.yaml               # CRE workflow config
|- config.staging.json         # Current dev/test trigger config
|- config.production.json      # Production-oriented config scaffold
|- src/utils/price-feed.ts     # Chainlink price and volatility reads
|- src/mock-workflow.ts        # Legacy local demo flow (not canonical validation)
`- package.json                # Package scripts and dependencies
```

## Configuration Notes

- `workflow.yaml` points CRE builds at `main.ts`.
- `config.staging.json` currently supports the development/test trigger configuration.
- The repo includes HTTP-trigger configuration scaffolding, but the operator-facing HTTP intent flow is still the next milestone rather than a completed live path.

## Validation Guidance

- Use `npm run validate:real` for canonical package-level validation.
- Use `npm run simulate:mock` only when you explicitly want the legacy local demo flow.
- Use the repo-level deployment and status docs for live Base Sepolia contract evidence.
- Treat `cre-workflow/` as legacy material if you encounter it elsewhere in the repo.

## Resources

- [Chainlink CRE Docs](https://docs.chain.link/cre)
- [Root README](../../README.md)
- [Deployment Guide](../../docs/DEPLOYMENT.md)
- [Deployment Status](../../docs/DEPLOYMENT_STATUS.md)

## License

MIT License - see [LICENSE](../../LICENSE).
