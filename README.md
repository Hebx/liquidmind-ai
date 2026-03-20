# LIQUIDMIND

**Autonomous liquidity infrastructure for Uniswap v4 — Hookathon submission branch**

[![Chainlink CRE](https://img.shields.io/badge/Chainlink-CRE-375BD2)](https://docs.chain.link/cre)
[![Uniswap v4](https://img.shields.io/badge/Uniswap-v4%20Hooks-FF007A)](https://docs.uniswap.org/contracts/v4)
[![Base Sepolia](https://img.shields.io/badge/Network-Base%20Sepolia-0052FF)](https://sepolia.basescan.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

LiquidMind is **autonomous liquidity** on **Uniswap v4**: a **Chainlink CRE** workflow reads **live feeds** and **historical rounds** on **Base Sepolia**, estimates **volatility**, and prepares **canonical actions** — **rebalance** (tick range + calldata) and optional **updateFee**. Only **`LiquidMindCoordinator`**, with **authorized agents**, may call **`executeAgentAction`** on **`AgenticLiquidityHook`**. The **hook** enforces **dynamic fees** (`beforeSwap`), **EMA volatility** and **rebalance signals** (`afterSwap`), optional **agent-only LP** (`beforeAddLiquidity`), and **gated** parameter updates — CRE plans; the hook **executes and enforces** on-chain.

---

## Branches at a glance

| Branch | Focus |
|--------|--------|
| **`Main`** | Canonical line: hook, coordinator, CRE package `liquidmind/agentic-liquidity`, docs. |
| **`feature/hookathon-submission`** (or your hook PR branch) | Same code as `Main` at merge time; **README** here is **Hookathon-first** for judges. |
| **`feature/cre-live-prod`** | CRE **live / prod-readiness** (simulation auth, pool keys, workflow alignment). Use it to see **CRE-side** deltas; the **on-chain hook** addresses here match `Main` unless you redeploy. |

---


## Architecture

```text
Operator / automation
        |
        v
liquidmind/agentic-liquidity  (Chainlink CRE)
  |-- live price (e.g. WETH/USD on Base Sepolia)
  |-- historical rounds -> volatility
  '-- canonical payloads: rebalance + optional updateFee
        |
        v
LiquidMindCoordinator (authorized agents)
        |
        v
AgenticLiquidityHook (Uniswap v4)
```

The CRE package is the **planning** layer; the hook is the **on-chain authority** for fees, signals, and allowed state changes.

---

## Partner integrations

| Integration | Role |
|-------------|------|
| **Uniswap v4** | `AgenticLiquidityHook` — `afterInitialize`, `beforeAddLiquidity`, `beforeSwap`, `afterSwap`; dynamic fee pool. |
| **Chainlink** | CRE workflow + **Data Feeds** (live + historical) in `liquidmind/agentic-liquidity`. |

---

## Deployed contracts (Base Sepolia, chain id 84532)

| Contract | Address |
|----------|---------|
| **AgenticLiquidityHook** | [`0xb08542f31D6C765F30365148ee5E906F941d18C0`](https://sepolia.basescan.org/address/0xb08542f31D6C765F30365148ee5E906F941d18C0) |
| **LiquidMindCoordinator** | [`0x68F321d6d33b23bAFC03CC4d84b1dBbe7cBFd063`](https://sepolia.basescan.org/address/0x68F321d6d33b23bAFC03CC4d84b1dBbe7cBFd063) |
| **PoolManager** (v4) | `0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408` |

**Live pool:** USDC/WETH, dynamic fee (hook-controlled), tick spacing **60**.  
**PoolId:** `0x26bdc452b547f41f8b069199acb0491d49b2184bd1b7018b66e4057f91be132d`

More detail: [`docs/DEPLOYMENT_STATUS.md`](docs/DEPLOYMENT_STATUS.md).

---

## Hook proof (Foundry) — eligibility-friendly

Hookathon requires **unit tests *or* a frontend**. Primary hook coverage:

```bash
cd contracts
forge test --match-path test/AgenticLiquidityHook.t.sol -vv
```

**Expected:** **37** tests passed (`AgenticLiquidityHookTest`).

Fork tests against Base Sepolia state (use `BASE_SEPOLIA_RPC` or public `https://sepolia.base.org`):

```bash
cd contracts
forge test --fork-url https://sepolia.base.org --match-path "test/fork/*" -v
```

**Expected:** **16** tests passed (`BaseSepoliaForkTest`), including coordinator↔hook wiring and `executeLocalHookAction`.

**Read-only on-chain checks:**

```bash
export HOOK=0xb08542f31D6C765F30365148ee5E906F941d18C0
export POOL_ID=0x26bdc452b547f41f8b069199acb0491d49b2184bd1b7018b66e4057f91be132d
export RPC=https://sepolia.base.org

cast call "$HOOK" "getCurrentDynamicFee(bytes32)" "$POOL_ID" --rpc-url "$RPC"
cast call "$HOOK" "agentCoordinator()" --rpc-url "$RPC"
cast call "$HOOK" "getVolatilityAvgTicks(bytes32)" "$POOL_ID" --rpc-url "$RPC"
```

---

## Live functionality

| Capability | Notes |
|------------|--------|
| Dynamic fee override | `beforeSwap` — v4 dynamic fee flag |
| Volatility EMA + events | `afterSwap` — `VolatilityUpdated` |
| Rebalance signaling | `RebalanceSignaled` near range edge |
| Agent / coordinator gate | `executeAgentAction` via coordinator only |
| Agent-only LP (optional) | `beforeAddLiquidity` when enabled |

---

## Project structure

```text
liquidmind-ai/
|- contracts/                    # AgenticLiquidityHook + Foundry tests
|- liquidmind/agentic-liquidity/ # Chainlink CRE canonical workflow
|- frontend/                     # Next.js (optional demo surface)
|- subgraph/                     # Indexing
`- docs/                         # Deployment status, milestones
```

---

## Quick start (CRE + e2e)

### Prerequisites

- [Foundry](https://book.getfoundry.sh/getting-started/installation)
- Node.js 18+
- [Bun](https://bun.sh) for `bunx cre-setup` where needed
- Optional: [CRE CLI](https://docs.chain.link/cre) + `cre login` for full simulation

### Validate CRE workflow

```bash
cp liquidmind/.env.example liquidmind/.env
cd liquidmind/agentic-liquidity
npm install
npm run validate:real
```

Root helper: `npm run validate:cre` from repo root. For scripted simulation (see internal demo docs): from `liquidmind/`, `bash ./simulate-agentic-liquidity.sh --non-interactive --trigger-index 1` when CRE auth and RPC are configured.

### E2E submission (authorized agent)

```bash
export AGENT_PRIVATE_KEY=<your-authorized-base-sepolia-key>
bash e2e-live.sh
```

Without the key, the script still exercises feed and wiring checks; with the key, it can submit **rebalance** / **updateFee** through the coordinator.

### Deploy (fork / fresh testnet)

```bash
cd contracts
cp .env.example .env
forge script script/Deploy.s.sol:DeployLiquidMind --rpc-url "$BASE_SEPOLIA_RPC" --broadcast
```

---

## Roadmap (hook + agents)

- **HTTP-triggered CRE** — default operator entry for intents → coordinator → hook.  
- **x402-style payment** — metered / agent-native triggers for workflow execution.  
- **ERC-8004 alignment** — stronger on-chain **agent identity** with existing agent-only LP + coordinator allowlists.  
- **Observability** — subgraph / UI on hook events; **A2A**-style orchestration above the canonical workflow.

---

## License

MIT — see [LICENSE](LICENSE).

Built by **Hebx**. Uniswap Hookathon submission README; Chainlink Convergence Hackathon 2026 lineage. For **`Main`** README, switch to the **`Main`** branch.
