# 🧠 LIQUIDMIND

**Intelligent Liquidity, Autonomous Execution**

[![Chainlink](https://img.shields.io/badge/Powered%20by-Chainlink-375BD2)](https://chain.link)
[![x402](https://img.shields.io/badge/Payments-x402-orange)](https://x402.org)
[![Uniswap](https://img.shields.io/badge/DEX-Uniswap%20v4-FF007A)](https://uniswap.org)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

AI agents for autonomous cross-chain DeFi liquidity management using Chainlink CRE workflows, x402 micropayments, and Uniswap v4 hooks.

**Chainlink Convergence Hackathon 2026 Entry** — CRE & AI Track

---

## 🎯 What is LiquidMind?

LiquidMind is an autonomous liquidity management system where AI agents deploy and rebalance DeFi positions using Chainlink CRE workflows, secured by x402 micropayments.

### Key Innovation
- **Natural language intent** → Structured execution
- **A2A agent coordination** (multi-agent consensus)
- **x402 payment escrow** (pay-per-execution)
- **Verifiable CRE workflows** (auditable, not black box)
- **Cross-chain orchestration** via CCIP

---

## 🏗️ Architecture

```
User Intent (NLP) 
    ↓
A2A Agent Coordination (RouteOptimizer + RiskAnalyzer + YieldAggregator)
    ↓
Chainlink CRE Workflow
    ↓
x402 Payment Lock
    ↓
CCIP Cross-Chain Execution
    ↓
Uniswap v4 Hooks
    ↓
Cron Monitoring & Auto-Rebalancing
```

---

## 📁 Project Structure

```
liquidmind-ai/
├── contracts/          # Solidity smart contracts (Foundry)
│   ├── src/
│   │   ├── AgenticLiquidityHook.sol
│   │   ├── LiquidMindCoordinator.sol
│   │   └── interfaces/
│   └── test/
├── cre-workflow/       # Chainlink CRE workflows (TypeScript)
│   ├── src/
│   │   ├── agentic-liquidity.ts
│   │   └── utils/
│   └── package.json
├── agents/            # A2A agent coordination
│   ├── src/
│   │   ├── coordinator.ts
│   │   ├── route-optimizer.ts
│   │   ├── risk-analyzer.ts
│   │   └── yield-aggregator.ts
│   └── package.json
├── frontend/          # Next.js frontend
│   ├── app/
│   ├── components/
│   └── lib/
├── scripts/           # Deployment & utility scripts
└── docs/             # Documentation
```

---

## 🚀 Quick Start

### Docs
- `docs/DEPLOYMENT.md`
- `docs/RUNBOOK.md`
- `docs/SECURITY.md`
- `docs/CRE.md`

### Prerequisites
- Node.js 18+
- Foundry
- Git

### Installation

```bash
# Clone the repository
git clone https://github.com/hebx/liquidmind-ai.git
cd liquidmind-ai

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your credentials

# Run tests
npm test
```

---

## 🛠️ Development

### Smart Contracts
```bash
cd contracts
forge install
forge test
forge script script/Deploy.s.sol --rpc-url $RPC_URL
```

### CRE Workflows
```bash
cd cre-workflow
npm install
npm run build
npm run simulate
```

### A2A Agents
```bash
cd agents
npm install
npm run dev
```

---

## 🎥 Demo

[Watch the Demo Video](https://youtube.com/...) *(Coming Soon)*

**Demo Flow:**
1. User expresses intent via natural language
2. AI agents coordinate and reach consensus
3. CRE workflow executes with x402 payment
4. Cross-chain liquidity deployment
5. Automated monitoring and rebalancing

---

## 🏆 Hackathon Prize Alignment

### CRE & AI Track Requirements
| Requirement | Status |
|-------------|--------|
| CRE Workflow orchestration | ✅ 6-step workflow |
| Blockchain + external API integration | ✅ Price Feeds, x402, A2A |
| AI agent integration | ✅ 3-agent coordination |
| Successful simulation/deployment | ✅ Testnet ready |
| 3-5 min video | 🎬 In production |
| Public GitHub repo | ✅ You're looking at it |

---

## 📚 Documentation

- [Project Specification](./SPEC.md)
- [Brand Identity](./BRAND.md)
- [Smart Contract Architecture](./docs/CONTRACTS.md)
- [CRE Workflow Design](./docs/CRE_WORKFLOW.md)
- [A2A Agent Coordination](./docs/AGENTS.md)

---

## 🔗 Resources

- [Chainlink CRE Documentation](https://docs.chain.link/cre)
- [x402 Protocol](https://x402.org)
- [Uniswap v4 Docs](https://docs.uniswap.org/contracts/v4)
- [A2A Protocol](https://a2a.org)

---

## 👥 Team

Built with 🧠 by **Hebx** for the Chainlink Convergence Hackathon 2026.

---

## 📄 License

MIT License — see [LICENSE](./LICENSE) for details.

---

*Built for the future of autonomous finance.* 🚀
