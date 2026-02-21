# Deployment Status

**Last updated:** February 21, 2026

## Deployed Contracts (Base Sepolia)

| Contract | Address | Verified |
|----------|---------|----------|
| **LiquidMindCoordinator** | `0x268c2E3D23f5cDDAA0D0B40142053414cC05991b` | Yes |
| **AgenticLiquidityHook** | `0xC28ed0595D42ec01A2F7546f39Cf27Ea798598C0` | Yes |
| **PoolModifyLiquidityTest** | `0xDcCe2F8543D13989De483b11F0eae9ba9cD38626` | — |
| **PoolSwapTest** | `0x6c2e4d949609BAdEE9eB29A1F99baFFfef497480` | — |

**PoolManager (Uniswap v4):** `0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408`

## Live Pool

- **Pair:** USDC/WETH
- **Fee:** `DYNAMIC_FEE_FLAG` (0x800000) — hook controls fee via `beforeSwap`
- **Tick Spacing:** 60
- **PoolId:** `0xf6bc640ca8176014c0ae5e3734845427d1c9a40b0fac3395e7a383dcd51f8743`

## CRE Workflow

- **Simulation:** Confirmed working — reads live Chainlink feeds via EVMClient
- **Volatility Oracle:** Reads 5+ historical rounds, computes annualized volatility
- **Actions:** Outputs both `rebalance` and `updateFee` calldata

## On-Chain Hook State

| Metric | Value |
|--------|-------|
| Dynamic Fee (EMA) | 10000 (1.00% — max, due to test swap volatility) |
| Config baseFee | 5000 (updated via CRE) |
| Volatility EMA | 96,320 avg ticks |
| Active Position | [-77100, -74700] (CRE-computed) |
| Coordinator LINK | 5.0 LINK |

## Test Results

- **Fork Tests:** 16/16 passing
- **E2E Suite:** 12/12 passing
- **Testnet Flow:** 12 confirmed on-chain transactions
