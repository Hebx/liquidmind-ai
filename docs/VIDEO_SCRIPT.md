# Demo Video Script (3-5 min)

## 1. Intro (30s)

- LiquidMind: AI-driven liquidity management using Chainlink CRE and Uniswap v4 hooks
- Show architecture: CRE workflow reads Chainlink feeds → computes optimal params → executes on hook

## 2. CRE Workflow Simulation (2 min)

```bash
cd liquidmind
cre workflow simulate agentic-liquidity --target staging --non-interactive --trigger-index 0
```

Highlight in output:
- Live Chainlink price read via EVMClient
- Volatility oracle: historical rounds → annualized vol → fee tier
- Rebalance calldata + updateFee calldata in output

## 3. On-Chain Execution (1.5 min)

Show the e2e-live.sh output or run it live:
- Chainlink feed verification
- Contract wiring checks
- CRE → Coordinator → Hook rebalance (on-chain tx)
- CRE → Coordinator → Hook updateFee (on-chain tx)
- 12/12 checks passing

## 4. Hook State Verification (30s)

Show `cast call` results:
- Dynamic fee from EMA
- Active position (CRE-computed ticks)
- Pool config (baseFee updated by CRE)

## 5. Wrap (30s)

- Fully executing Uniswap v4 hook with Chainlink CRE
- Volatility oracle from live price feed history
- All features verified on Base Sepolia with real funds
