# LIQUIDMIND

**AI-Driven Autonomous Liquidity Management on Uniswap v4**

[![Chainlink CRE](https://img.shields.io/badge/Chainlink-CRE-375BD2)](https://docs.chain.link/cre)
[![Uniswap v4](https://img.shields.io/badge/Uniswap-v4%20Hooks-FF007A)](https://docs.uniswap.org/contracts/v4)
[![Base Sepolia](https://img.shields.io/badge/Network-Base%20Sepolia-0052FF)](https://sepolia.basescan.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

LiquidMind uses Chainlink CRE workflows to read live oracle data, compute optimal liquidity parameters, and execute actions on a fully functional Uniswap v4 hook — all verified end-to-end on Base Sepolia with real funds.

---

## How It Works

```
Chainlink CRE Workflow (WASM)
  │
  ├─ Read live ETH/USD price from Chainlink Price Feed (EVMClient)
  ├─ Read 5+ historical rounds → compute annualized volatility
  ├─ Map volatility to optimal LP fee tier
  ├─ Compute tick range from current price + risk tolerance
  │
  └─ Output: rebalance calldata + updateFee calldata
                    │
                    ▼
        LiquidMindCoordinator (on-chain)
                    │
                    ▼
         AgenticLiquidityHook (Uniswap v4)
           ├─ EMA volatility tracking per swap
           ├─ Dynamic fee override (beforeSwap)
           ├─ Rebalance signal detection (afterSwap)
           ├─ Agent-only LP gating (beforeAddLiquidity)
           └─ Position management (executeAgentAction)
```

---

## Deployed Contracts (Base Sepolia)

| Contract | Address |
|----------|---------|
| **AgenticLiquidityHook** | [`0xC28ed0595D42ec01A2F7546f39Cf27Ea798598C0`](https://sepolia.basescan.org/address/0xC28ed0595D42ec01A2F7546f39Cf27Ea798598C0) |
| **LiquidMindCoordinator** | [`0x268c2E3D23f5cDDAA0D0B40142053414cC05991b`](https://sepolia.basescan.org/address/0x268c2E3D23f5cDDAA0D0B40142053414cC05991b) |
| **PoolManager** (Uniswap v4) | `0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408` |

**Live Pool:** USDC/WETH with dynamic fees — [PoolId `0xf6bc64...`](https://sepolia.basescan.org/address/0xC28ed0595D42ec01A2F7546f39Cf27Ea798598C0)

---

## Features (All Executing On-Chain)

| Feature | Description | Verification |
|---------|-------------|-------------|
| **EMA Volatility Tracking** | Exponential moving average of tick deltas updated every swap | `afterSwap` → `VolatilityUpdated` event |
| **Dynamic Fee Override** | Fee computed from EMA, returned via `OVERRIDE_FEE_FLAG` | `beforeSwap` returns tier-based fee |
| **Rebalance Detection** | Signals when price drifts near position edge | `afterSwap` → `RebalanceSignaled` event |
| **CRE → Hook Rebalance** | Off-chain workflow computes optimal ticks, executes on-chain | `Coordinator.executeLocalHookAction("rebalance")` |
| **CRE → Hook Fee Update** | Volatility oracle reads Chainlink history, sets optimal fee | `Coordinator.executeLocalHookAction("updateFee")` |
| **Agent-Only LP Gate** | Restrict `addLiquidity` to registered agents | `beforeAddLiquidity` checks coordinator registry |
| **Cross-Chain Ready** | CCIP signal handler for multi-chain commands | `receiveCrossChainSignal` via coordinator |

---

## Project Structure

```
liquidmind-ai/
├── contracts/                  # Solidity (Foundry)
│   ├── src/
│   │   ├── AgenticLiquidityHook.sol    # Uniswap v4 hook (all 6 features)
│   │   └── LiquidMindCoordinator.sol   # Agent registry + action dispatch
│   ├── test/
│   │   ├── AgenticLiquidityHook.t.sol  # Unit tests
│   │   └── fork/BaseSepolia.t.sol      # Fork tests (16/16 passing)
│   └── script/
│       ├── Deploy.s.sol                # Contract deployment
│       └── TestnetFlow.s.sol           # Full testnet integration
├── liquidmind/                 # Chainlink CRE Workflow
│   ├── agentic-liquidity/
│   │   ├── main.ts                     # 6-step workflow + volatility oracle
│   │   └── src/utils/price-feed.ts     # Chainlink feed reader + getVolatility()
│   └── project.yaml                    # CRE target config (Base Sepolia RPCs)
├── frontend/                   # Next.js dashboard
├── agents/                     # A2A agent services
├── subgraph/                   # Goldsky indexer
├── e2e-live.sh                 # End-to-end testnet suite (12/12 passing)
└── docs/                       # Documentation
```

---

## Quick Start

### Prerequisites

- [Foundry](https://book.getfoundry.sh/getting-started/installation)
- [CRE CLI](https://docs.chain.link/cre) (`cre version`)
- Node.js 18+

### Run CRE Workflow Simulation

```bash
cd liquidmind
cre login
cre workflow simulate agentic-liquidity --target staging --non-interactive --trigger-index 0
```

This compiles the workflow to WASM and runs it with **real Chainlink feed reads** on Base Sepolia via the CRE EVMClient capability.

### Run Fork Tests

```bash
cd contracts
forge test --fork-url $BASE_SEPOLIA_RPC --match-path "test/fork/*" -v
```

### Run Full E2E Suite

```bash
export AGENT_PRIVATE_KEY=<your-key>
bash e2e-live.sh
```

Runs 12 checks: Chainlink feeds → contract wiring → CRE simulation → fork tests → on-chain rebalance → on-chain fee update.

### Deploy to Base Sepolia

```bash
cd contracts
cp .env.example .env  # fill in BASE_SEPOLIA_RPC and PRIVATE_KEY
forge script script/Deploy.s.sol:DeployLiquidMind --rpc-url $BASE_SEPOLIA_RPC --broadcast
```

---

## Chainlink Integration

### CRE Workflow (`liquidmind/agentic-liquidity/main.ts`)

The workflow runs as a cron-triggered CRE handler:

1. **Intent Analysis** — Fetches live ETH/USD from Chainlink via `EVMClient`, computes optimal tick range
2. **Volatility Oracle** — Reads 5+ historical `getRoundData()` rounds, computes annualized vol, maps to fee tier
3. **A2A Coordination** — Multi-agent consensus (route optimizer, risk analyzer, yield aggregator)
4. **Risk Assessment** — Validates score against tolerance threshold
5. **Execution** — Builds `executeLocalHookAction` calldata for both rebalance and updateFee
6. **Monitoring** — Outputs structured action payloads for on-chain submission

### Price Feed Utility (`liquidmind/agentic-liquidity/src/utils/price-feed.ts`)

- `getPrice()` — Reads `latestRoundData()` via CRE EVMClient on Base Sepolia
- `getVolatility()` — Reads N historical rounds, computes log-return std dev, annualizes

### Smart Contracts

- **`AgenticLiquidityHook.sol`** — Uniswap v4 hook with `AFTER_INITIALIZE`, `BEFORE_ADD_LIQUIDITY`, `BEFORE_SWAP`, `AFTER_SWAP` flags
- **`LiquidMindCoordinator.sol`** — CCIP receiver + agent registry + `executeLocalHookAction` dispatch

---

## Testnet Results

### CRE Simulation Output
```
Chainlink (Base Sepolia): WETH/USD = $1968.36
Volatility Oracle: annualized = 22.08%, rounds_read = 6
Optimal Fee: 3000 (0.30%)
Tick Range: [-77100, -74700] (±1200 ticks, medium risk)
```

### On-Chain Transactions (12 confirmed)
- Pool initialized with `DYNAMIC_FEE_FLAG` → `afterInitialize` seeded config
- Liquidity added → `beforeAddLiquidity` agent gate passed
- 2 swaps → `beforeSwap` dynamic fee + `afterSwap` EMA + `RebalanceSignaled`
- CRE rebalance → position updated to [-77100, -74700]
- CRE fee update → baseFee changed to 5000

### Fork Tests: 16/16 passing
### E2E Suite: 12/12 passing

---

## License

MIT — see [LICENSE](LICENSE).

Built by **Hebx** for the Chainlink Convergence Hackathon 2026.
