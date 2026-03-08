# Deployment Status

**Last updated:** March 8, 2026

## Canonical Workflow Path

- Active CRE package for this milestone: `liquidmind/agentic-liquidity`
- `cre-workflow/` should be treated as legacy or historical reference, not the current implementation target

## Live Now (Base Sepolia)

### Deployed contracts

| Contract | Address | Verified |
|----------|---------|----------|
| **LiquidMindCoordinator** | `0x68F321d6d33b23bAFC03CC4d84b1dBbe7cBFd063` | Yes |
| **AgenticLiquidityHook** | `0xb08542f31D6C765F30365148ee5E906F941d18C0` | Yes |
| **PoolModifyLiquidityTest** | `0x0bd338fBfe5C3f5294d54489395bB6c2fadaB82B` | - |
| **PoolSwapTest** | `0x15d0053E3055Df9cdaB8BE03EB4345174AE9BAC8` | - |

**PoolManager (Uniswap v4):** `0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408`

### Live pool

- **Pair:** USDC/WETH
- **Fee:** `DYNAMIC_FEE_FLAG` (`0x800000`) - hook controls fee via `beforeSwap`
- **Tick spacing:** 60
- **PoolId:** `0x26bdc452b547f41f8b069199acb0491d49b2184bd1b7018b66e4057f91be132d`

### Live CRE evidence

- Real Chainlink price reads are working through `liquidmind/agentic-liquidity`.
- Historical round reads for volatility are working through `liquidmind/agentic-liquidity`.
- Canonical `rebalance` payloads and volatility-driven `updateFee` sidecar payloads have validation evidence through simulation and testnet flows.
- The live coordinator and hook wiring are validated on Base Sepolia; the `updateFee` fork test still overlays the merged local hook bytecode for semantic coverage rather than proving the exact deployed hook bytecode path end to end.

### On-chain hook state

| Metric | Value |
|--------|-------|
| Dynamic fee (EMA) | 10000 (1.00% - max, due to test swap volatility) |
| Config baseFee | 3000 |
| Volatility EMA | 96,326 avg ticks |
| Active position | [-76440, -75240] |
| Coordinator LINK | 5.0 LINK |

## Next Milestone

- HTTP-triggered intent ingestion into `liquidmind/agentic-liquidity`
- CRE workflow deploy/activate after CRE deploy access approval and final deploy-time RPC/key configuration
- Intent-to-coordinator execution flow as the primary operator path

These items are the active next step, not something this status page claims is already live.

## Deferred / Not Yet Claimed Live

- `x402` payment flows
- Real A2A orchestration
- Production cross-chain or CCIP-driven automation

## Test Evidence

- **Fork tests:** 16/16 passing
- **E2E suite:** passing when `AGENT_PRIVATE_KEY` is set, which provides full submission evidence for the canonical `rebalance` action and the optional `updateFee` sidecar; without that key, the script is only partial evidence
- **Testnet flow:** confirmed on-chain transactions recorded on Base Sepolia
