# LIQUIDMIND

**Autonomous liquidity infrastructure for Uniswap v4**

[![Chainlink CRE](https://img.shields.io/badge/Chainlink-CRE-375BD2)](https://docs.chain.link/cre)
[![Uniswap v4](https://img.shields.io/badge/Uniswap-v4%20Hooks-FF007A)](https://docs.uniswap.org/contracts/v4)
[![Base Sepolia](https://img.shields.io/badge/Network-Base%20Sepolia-0052FF)](https://sepolia.basescan.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

LiquidMind currently has live Base Sepolia contracts plus a canonical CRE workflow package at `liquidmind/agentic-liquidity` that reads real Chainlink data, prepares a canonical `rebalance` action, and may emit an `updateFee` sidecar action from live volatility analysis. The next milestone is to trigger that workflow over HTTP and carry intent payloads through to on-chain execution.

---

## Current Milestone

### Live Today

- `AgenticLiquidityHook` and `LiquidMindCoordinator` are deployed on Base Sepolia.
- The hook updates EMA volatility, overrides swap fees, and signals rebalance conditions on-chain.
- The CRE workflow in `liquidmind/agentic-liquidity` performs real Chainlink price and historical round reads.
- The canonical workflow prepares `rebalance` payloads and can emit an `updateFee` sidecar payload from live volatility analysis.

### Next Milestone

- Accept external HTTP-triggered intents into the CRE workflow.
- Turn those intents into coordinator calls for rebalance and fee updates.
- Make the HTTP entrypoint the default execution path for operators and integrations.

### Deferred

- `x402`-based payment flows are not part of the live milestone.
- Real A2A orchestration is not part of the live milestone.
- Cross-chain or CCIP-driven automation should be treated as future work unless separately proven live.

---

## How It Works Right Now

```text
Operator / local simulation
  |
  v
liquidmind/agentic-liquidity
  |- Read live ETH/USD price from Chainlink (EVMClient)
  |- Read historical rounds for volatility
  |- Compute rebalance tick guidance
  `- Emit rebalance payloads + optional updateFee sidecar
                    |
                    v
  Operator/test bridge submits payloads
                    |
                    v
        LiquidMindCoordinator (Base Sepolia)
                    |
                    v
         AgenticLiquidityHook (Uniswap v4)
```

The current source of truth for the CRE side of the project is `liquidmind/agentic-liquidity`. Today, that package emits action payloads and real Chainlink-derived outputs; the actual submission bridge and on-chain evidence path still live in external operator/test flows such as `e2e-live.sh`, not inside the canonical package itself. The older `cre-workflow/` directory may still exist in the repo as legacy material, but it is not the active implementation target for this milestone.

---

## Deployed Contracts (Base Sepolia)

| Contract | Address |
|----------|---------|
| **AgenticLiquidityHook** | [`0xb08542f31D6C765F30365148ee5E906F941d18C0`](https://sepolia.basescan.org/address/0xb08542f31D6C765F30365148ee5E906F941d18C0) |
| **LiquidMindCoordinator** | [`0x68F321d6d33b23bAFC03CC4d84b1dBbe7cBFd063`](https://sepolia.basescan.org/address/0x68F321d6d33b23bAFC03CC4d84b1dBbe7cBFd063) |
| **PoolManager** (Uniswap v4) | `0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408` |

**Live pool:** USDC/WETH with dynamic fees, controlled by the deployed hook.

---

## Live Functionality

| Capability | Current state | Evidence |
|-----------|---------------|----------|
| Hook volatility tracking | Live on Base Sepolia | `afterSwap` updates EMA and emits volatility events |
| Dynamic fee override | Live on Base Sepolia | `beforeSwap` returns hook-controlled fee tiers |
| Rebalance signaling | Live on Base Sepolia | `RebalanceSignaled` event during swap activity |
| Chainlink price reads | Live in CRE workflow execution | `liquidmind/agentic-liquidity/src/utils/price-feed.ts` |
| Historical round reads | Live in CRE workflow execution | Volatility computation uses real feed history |
| Coordinator action execution | Validated on testnet | `executeLocalHookAction("rebalance" | "updateFee")` against the redeployed coordinator/hook pair |

---

## Project Structure

```text
liquidmind-ai/
|- contracts/                            # Solidity contracts and scripts
|- liquidmind/agentic-liquidity/         # Canonical CRE workflow package
|- frontend/                             # Next.js dashboard
|- agents/                               # Agent experiments / services
|- subgraph/                             # Indexing
`- docs/                                 # Milestone docs and status
```

---

## Quick Start

### Prerequisites

- [Foundry](https://book.getfoundry.sh/getting-started/installation)
- Node.js 18+
- [Bun](https://bun.sh) because CRE package setup still uses `bunx cre-setup`
- Optional: [CRE CLI](https://docs.chain.link/cre) plus `cre login` if you want to run `cre workflow simulate` or complete the still-pending HTTP workflow deploy/activate steps

### Validate the CRE workflow package

```bash
cp liquidmind/.env.example liquidmind/.env
cd liquidmind/agentic-liquidity
npm install
npm run validate:real
```

This is the canonical package-level validation path for the real CRE workflow entrypoint. It runs a non-interactive CRE simulation against the canonical workflow from the `liquidmind` project root.

It does not deploy an HTTP-triggered workflow or prove that the operator-facing intent path is live.

If you want the root-script equivalent, run `npm run validate:cre`. If you need the direct package compile command, `npm run cre-compile` invokes the SDK's local compiler hook used by CRE workflow builds.

### Latest Simulation Result

Latest verified `npm run validate:real` result on `Main`:

- Status: passed
- Date: `2026-03-08`
- Live price source: Chainlink Base Sepolia `WETH/USD = $1974.4457`
- Computed rebalance range: `tickLower = -77100`, `tickUpper = -74700`
- Prepared coordinator: `0x68F321d6d33b23bAFC03CC4d84b1dBbe7cBFd063`
- Prepared actions: canonical `rebalance` payload plus `updateFee` sidecar payload
- Volatility sample: `35.46%` annualized
- Prepared fee output: `3000`

These values come from a successful non-interactive CRE simulation against live Base Sepolia reads, so the exact price, volatility, ticks, and action payload IDs will change across runs.

### Legacy local mock demo

```bash
cd liquidmind/agentic-liquidity
npm run simulate:mock
```

This runs the legacy local mock demo in `src/mock-workflow.ts`. It is useful for local UI or developer demos, but it is not evidence of the live milestone path.

### Run Fork Tests

```bash
cd contracts
forge test --fork-url "$BASE_SEPOLIA_RPC" --match-path "test/fork/*" -v
```

### Run the end-to-end script

```bash
export AGENT_PRIVATE_KEY=<your-key>
bash e2e-live.sh
```

`AGENT_PRIVATE_KEY` must be a funded Base Sepolia EOA that the deployed `LiquidMindCoordinator` already recognizes as an authorized agent. With that key configured, this script validates the current milestone bridge end to end: contract wiring, real Chainlink-backed workflow outputs, and on-chain rebalance or fee update submission. Without it, the script is only partial evidence and does not prove the submission step.

### Deploy contracts to Base Sepolia

```bash
cd contracts
cp .env.example .env
forge script script/Deploy.s.sol:DeployLiquidMind --rpc-url "$BASE_SEPOLIA_RPC" --broadcast
```

---

## Current Milestones

- Live Base Sepolia contract state is updated and documented around the redeployed hook and coordinator pair.
- The canonical CRE workflow now validates through non-interactive simulation from `liquidmind/agentic-liquidity` on `Main`.
- The current operator proof path is `e2e-live.sh`, which becomes full submission evidence when `AGENT_PRIVATE_KEY` is set.
- The next milestone is authenticated CRE HTTP workflow deploy/activate plus proof of the HTTP-triggered operator path, once CRE org deploy access is enabled.
- The legacy mock demo remains available for local-only experimentation, but it is not the canonical milestone path.

---

## License

MIT - see [LICENSE](LICENSE).

Built by **Hebx** for the Chainlink Convergence Hackathon 2026.
