# Demo Video Script (3-5 min)

## 1. Intro (30s)

- LiquidMind: Chainlink CRE-driven liquidity payload preparation and Base Sepolia submission bridge for Uniswap v4 hooks; AI parsing is the next milestone
- Show architecture: CRE workflow reads Chainlink feeds → prepares a canonical rebalance payload and optional `updateFee` sidecar → external bridge submits to coordinator and hook

## 2. CRE Workflow Simulation (2 min)

```bash
cd liquidmind
bash ./simulate-agentic-liquidity.sh --non-interactive --trigger-index 1
```

Highlight in output:
- Live Chainlink price read via EVMClient
- Volatility oracle: historical rounds → annualized vol → fee tier
- Canonical rebalance payload plus optional `updateFee` sidecar in output

## 3. On-Chain Execution (1.5 min)

Show the e2e-live.sh output or run it live:
- Chainlink feed verification
- Contract wiring checks
- CRE → Coordinator → Hook rebalance submission when `AGENT_PRIVATE_KEY` is set
- CRE → Coordinator → Hook `updateFee` submission when `AGENT_PRIVATE_KEY` is set
- If `AGENT_PRIVATE_KEY` is not set, call out that the script only provides partial evidence

## 4. Hook State Verification (30s)

Show `cast call` results:
- Dynamic fee from EMA
- Active position (CRE-computed ticks)
- Pool config (baseFee updated by CRE)

## 5. Wrap (30s)

- Base Sepolia hook automation with Chainlink CRE payload preparation
- Volatility oracle from live price feed history
- Canonical `rebalance` payload live today, with `updateFee` sidecar available from live volatility analysis
