# Deployment Status

**Last updated:** March 8, 2026

## Canonical Workflow Path

- Active CRE package for this milestone: `liquidmind/agentic-liquidity`
- `cre-workflow/` should be treated as legacy or historical reference, not the current implementation target

## Live Now (Base Sepolia)

### Deployed contracts

| Contract | Address | Verified |
|----------|---------|----------|
| **LiquidMindCoordinator** | `0x268c2E3D23f5cDDAA0D0B40142053414cC05991b` | Yes |
| **AgenticLiquidityHook** | `0xC28ed0595D42ec01A2F7546f39Cf27Ea798598C0` | Yes |
| **PoolModifyLiquidityTest** | `0xDcCe2F8543D13989De483b11F0eae9ba9cD38626` | - |
| **PoolSwapTest** | `0x6c2e4d949609BAdEE9eB29A1F99baFFfef497480` | - |

**PoolManager (Uniswap v4):** `0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408`

### Live pool

- **Pair:** USDC/WETH
- **Fee:** `DYNAMIC_FEE_FLAG` (`0x800000`) - hook controls fee via `beforeSwap`
- **Tick spacing:** 60
- **PoolId:** `0xf6bc640ca8176014c0ae5e3734845427d1c9a40b0fac3395e7a383dcd51f8743`

### Live CRE evidence

- Real Chainlink price reads are working through `liquidmind/agentic-liquidity`.
- Historical round reads for volatility are working through `liquidmind/agentic-liquidity`.
- Rebalance and `updateFee` action payloads have validation evidence through simulation and testnet flows.
- The hook and coordinator behavior are validated against deployed Base Sepolia contracts.

### On-chain hook state

| Metric | Value |
|--------|-------|
| Dynamic fee (EMA) | 10000 (1.00% - max, due to test swap volatility) |
| Config baseFee | 5000 (updated via CRE-driven action) |
| Volatility EMA | 96,320 avg ticks |
| Active position | [-77100, -74700] (workflow-computed) |
| Coordinator LINK | 5.0 LINK |

## Next Milestone

- HTTP-triggered intent ingestion into `liquidmind/agentic-liquidity`
- Intent-to-coordinator execution flow as the primary operator path

These items are the active next step, not something this status page claims is already live.

## Deferred / Not Yet Claimed Live

- `x402` payment flows
- Real A2A orchestration
- Production cross-chain or CCIP-driven automation

## Test Evidence

- **Fork tests:** 16/16 passing
- **E2E suite:** passing when `AGENT_PRIVATE_KEY` is set, which provides full submission evidence for rebalance and `updateFee`; without that key, the script is only partial evidence
- **Testnet flow:** confirmed on-chain transactions recorded on Base Sepolia
