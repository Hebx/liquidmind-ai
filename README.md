# LIQUIDMIND

**Autonomous liquidity infrastructure for Uniswap v4 on Base Sepolia**

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
| **AgenticLiquidityHook** | [`0xC28ed0595D42ec01A2F7546f39Cf27Ea798598C0`](https://sepolia.basescan.org/address/0xC28ed0595D42ec01A2F7546f39Cf27Ea798598C0) |
| **LiquidMindCoordinator** | [`0x268c2E3D23f5cDDAA0D0B40142053414cC05991b`](https://sepolia.basescan.org/address/0x268c2E3D23f5cDDAA0D0B40142053414cC05991b) |
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
| Coordinator action execution | Validated on testnet | `executeLocalHookAction("rebalance" | "updateFee")` |

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
- Optional: [CRE CLI](https://docs.chain.link/cre) if you want to compile the workflow locally

### Validate the CRE workflow package

```bash
cd liquidmind/agentic-liquidity
npm install
npm run validate:real
```

This is the canonical package-level validation path for the real CRE workflow entrypoint. It compiles `main.ts` to a CRE workflow artifact.

If you want the root-script equivalent, run `npm run validate:cre`. If you need the direct package command, `npm run cre-compile` performs the same real-workflow validation step.

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

With `AGENT_PRIVATE_KEY` configured, this script validates the current milestone bridge end to end: contract wiring, real Chainlink-backed workflow outputs, and on-chain rebalance or fee update submission. Without `AGENT_PRIVATE_KEY`, it is only partial evidence and does not prove the submission step.

### Deploy contracts to Base Sepolia

```bash
cd contracts
cp .env.example .env
forge script script/Deploy.s.sol:DeployLiquidMind --rpc-url "$BASE_SEPOLIA_RPC" --broadcast
```

---

## Roadmap Boundary

- The current execution path is contract deployment plus real CRE workflow compilation from `liquidmind/agentic-liquidity`.
- The legacy mock demo remains available for local-only experimentation, but it is not the canonical validation path.
- The next delivery is an HTTP-triggered intent flow for the CRE package.
- `x402`, real A2A coordination, and production cross-chain automation are intentionally out of scope for this milestone.

---

## License

MIT - see [LICENSE](LICENSE).

Built by **Hebx** for the Chainlink Convergence Hackathon 2026.
