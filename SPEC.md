# AgenticCRE — Project Specification
## Chainlink Convergence Hackathon | CRE & AI Track

**Target Prize:** $10,500 (1st Place) | $6,500 (2nd Place)  
**Track:** CRE & AI — AI agents consuming CRE workflows with x402 payments  
**Build Time:** 2-3 weeks  
**Confidence:** HIGH ⭐⭐⭐⭐⭐

---

## 1. Executive Summary

**AgenticCRE** is an autonomous cross-chain liquidity management system where AI agents deploy and rebalance DeFi positions using Chainlink CRE workflows, secured by x402 micropayments. Users express intent in natural language; AI agents execute across chains via verifiable CRE workflows.

**The Differentiator:** Unlike existing templates (price alerts, basic rebalancing), AgenticCRE combines:
- **Natural language intent** → Structured execution
- **A2A agent coordination** (multi-agent swarm)
- **x402 payment escrow** (pay-per-execution)
- **Uniswap v4 hook integration** (on-chain execution)
- **Cross-chain orchestration** via CCIP

---

## 2. Problem Statement

**Current DeFi is too complex for humans:**
- Monitoring 20+ protocols across chains at 3am
- Calculating IL risk vs APY tradeoffs
- Executing cross-chain rebalancing manually
- Trusting black-box robo-advisors

**Existing solutions fail:**
- Static yield aggregators (don't adapt to market)
- Single-chain only (miss better opportunities)
- No verification (can't audit agent decisions)
- Subscription models (don't align incentives)

---

## 3. Solution Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         USER INTERFACE                               │
│  "Deploy $5K to highest-yielding ETH/USDC pools, max 5% IL risk"    │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│                    NLP INTENT PARSER (MCP Tool)                      │
│  • Extract: amount ($5K), asset (ETH/USDC), constraint (max 5% IL)   │
│  • Output: StructuredIntent JSON                                     │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│                    A2A AGENT COORDINATION                            │
│  • RouteOptimizer: Scans Base, Optimism, Arbitrum, Unichain          │
│  • RiskAnalyzer: Calculates IL risk per pool                         │
│  • YieldAggregator: Fetches APY from Chainlink Price Feeds           │
│  • Consensus: 2/3 agents agree on allocation                         │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│                    CHAINLINK CRE WORKFLOW                            │
│                                                                      │
│  Trigger: HTTP (from Agent Coordinator)                              │
│    ↓                                                                 │
│  Step 1: Fetch Price Feeds (CRE Chain Reader)                        │
│    ├── ETH/USDC price on Base                                        │
│    ├── ETH/USDC price on Optimism                                    │
│    └── Yield data from Aave/Compound pools                           │
│    ↓                                                                 │
│  Step 2: Calculate Optimal Allocation (CRE Compute)                  │
│    ├── Risk-adjusted return per pool                                 │
│    ├── Cross-chain bridge costs (CCIP)                               │
│    └── Final allocation: 40% Base, 35% OP, 25% Arbitrum              │
│    ↓                                                                 │
│  Step 3: x402 Payment Lock (CRE HTTP → x402 Gateway)                 │
│    ├── User approves $5,025 (includes 0.5% fee)                      │
│    ├── Payment escrowed in x402 contract                             │
│    └── Released on proof of execution                                │
│    ↓                                                                 │
│  Step 4: Cross-Chain Execution (CRE CCIP Writer)                     │
│    ├── Hook A (Base): Deploy 40% via v4 hook                         │
│    ├── Hook B (Optimism): Deploy 35% via v4 hook                     │
│    └── Hook C (Arbitrum): Deploy 25% via v4 hook                     │
│    ↓                                                                 │
│  Step 5: Verify & Settle (CRE Chain Reader)                          │
│    ├── Read LP positions from each chain                             │
│    ├── Verify allocation matches intent                              │
│    └── Release x402 payment to executor                              │
│    ↓                                                                 │
│  Monitor: CRE Cron Trigger (every 1 hour)                            │
│    ├── Check if IL risk > 5% threshold                               │
│    ├── If yes: Trigger rebalancing workflow                          │
│    └── Auto-rebalance to maintain risk constraints                   │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│                    UNISWAP V4 HOOK EXECUTION                         │
│  • AgenticLiquidityHook: Dynamic fee adjustment (0.01% - 1%)         │
│  • Auto-rebalancing: IL risk monitoring                              │
│  • Performance fee: 10% of yield to agent treasury                   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 4. Technical Specifications

### 4.1 Smart Contracts

```solidity
// AgenticLiquidityHook.sol
contract AgenticLiquidityHook is BaseHook {
    struct Position {
        uint256 amount;
        int24 tickLower;
        int24 tickUpper;
        uint256 entryPrice;
    }
    
    mapping(bytes32 => Position) public positions;
    mapping(address => bool) public authorizedAgents;
    
    // Dynamic fee based on AI volatility analysis
    function getFee(address sender, PoolKey calldata key) external view returns (uint24) {
        uint256 volatility = IAgentCoordinator(A2A_COORDINATOR).getVolatility(key);
        return calculateDynamicFee(volatility); // 0.01% - 1%
    }
    
    // Post-swap rebalancing check
    function afterSwap(address sender, PoolKey calldata key, ...) external returns (bytes4) {
        if (authorizedAgents[sender]) {
            (bool needsRebalance, int24 newTickLower, int24 newTickUpper) = 
                checkRebalanceNeeded(key);
            
            if (needsRebalance) {
                emit RebalanceTriggered(key, newTickLower, newTickUpper);
            }
        }
        return BaseHook.afterSwap.selector;
    }
}

// AgenticCRECoordinator.sol
contract AgenticCRECoordinator is ICCIPReceiver {
    struct Intent {
        address user;
        uint256 amount;
        address token;
        uint256 maxILRisk; // basis points
        bytes32 status; // PENDING, EXECUTED, FAILED
    }
    
    mapping(bytes32 => Intent) public intents;
    mapping(address => bool) public creWorkflowOracles;
    
    // Called by CRE workflow after consensus
    function executeCrossChainAllocation(
        bytes32 intentId,
        Allocation[] calldata allocations,
        bytes calldata creSignature
    ) external {
        require(creWorkflowOracles[msg.sender], "Unauthorized");
        require(verifyCRESignature(intentId, allocations, creSignature), "Invalid sig");
        
        // Execute via CCIP
        for (uint i = 0; i < allocations.length; i++) {
            ccipSend(
                allocations[i].chainSelector,
                buildCCIPMessage(allocations[i])
            );
        }
        
        intents[intentId].status = EXECUTED;
    }
}
```

### 4.2 CRE Workflow (TypeScript)

```typescript
// workflows/agentic-liquidity.ts
import { Workflow } from '@chainlink/cre-sdk';

export const AgenticLiquidityWorkflow = new Workflow({
  name: 'agentic-liquidity-manager',
  
  trigger: {
    type: 'http',
    path: '/api/v1/execute-intent'
  },
  
  steps: [
    {
      name: 'fetch-market-data',
      capability: 'chainlink:price-feeds',
      config: {
        feeds: ['ETH/USD', 'USDC/USD'],
        chains: ['base', 'optimism', 'arbitrum']
      }
    },
    {
      name: 'calculate-optimal-allocation',
      capability: 'compute',
      inputs: {
        prices: '${fetch-market-data.prices}',
        intent: '${trigger.body.intent}'
      },
      handler: async ({ prices, intent }) => {
        // Risk-adjusted optimization
        const allocations = optimizeAllocation(prices, intent);
        return { allocations };
      }
    },
    {
      name: 'lock-x402-payment',
      capability: 'http',
      config: {
        url: '${secrets.X402_GATEWAY}/lock',
        method: 'POST',
        body: {
          amount: '${calculate-optimal-allocation.totalAmount}',
          intentId: '${trigger.body.intentId}'
        }
      }
    },
    {
      name: 'execute-cross-chain',
      capability: 'chainlink:ccip',
      inputs: {
        allocations: '${calculate-optimal-allocation.allocations}'
      },
      handler: async ({ allocations }) => {
        const messages = allocations.map(a => ({
          destinationChain: a.chainSelector,
          tokenAmounts: [{ token: a.token, amount: a.amount }],
          data: encodeHookExecution(a)
        }));
        return { messages };
      }
    },
    {
      name: 'verify-execution',
      capability: 'chainlink:chain-reader',
      config: {
        calls: '${execute-cross-chain.allocations.map(a => ({
          chain: a.chain,
          contract: a.hookAddress,
          function: 'getPosition',
          args: [a.intentId]
        }))}'
      }
    },
    {
      name: 'release-payment',
      capability: 'http',
      config: {
        url: '${secrets.X402_GATEWAY}/release',
        method: 'POST',
        body: {
          intentId: '${trigger.body.intentId}',
          proof: '${verify-execution.results}'
        }
      }
    }
  ],
  
  // Cron trigger for monitoring/rebalancing
  cron: {
    schedule: '0 * * * *', // Every hour
    steps: ['fetch-market-data', 'check-rebalance-needed', 'execute-if-triggered']
  }
});
```

### 4.3 A2A Agent Coordination

```typescript
// agents/coordinator.ts
import { A2AClient } from '@a2a/protocol';

class AgenticCRECoordinator {
  private agents = {
    routeOptimizer: new RouteOptimizerAgent(),
    riskAnalyzer: new RiskAnalyzerAgent(),
    yieldAggregator: new YieldAggregatorAgent()
  };
  
  async processIntent(intent: UserIntent): Promise<AgentConsensus> {
    // Parallel agent execution
    const [routes, risks, yields] = await Promise.all([
      this.agents.routeOptimizer.findRoutes(intent),
      this.agents.riskAnalyzer.assessRisk(intent),
      this.agents.yieldAggregator.fetchYields(intent)
    ]);
    
    // Consensus: 2/3 agents must agree
    const allocation = this.reconcileAllocations(routes, risks, yields);
    
    return {
      allocation,
      signatures: await this.collectAgentSignatures(allocation),
      confidence: calculateConfidence(routes, risks, yields)
    };
  }
}
```

---

## 5. Demo Flow (3-5 Minute Video)

### Scene 1: User Intent (30s)
- User opens Telegram chat with AgenticCRE bot
- Types: `"Deploy $1000 to ETH/USDC pools with max 3% IL risk"`
- Bot parses intent, shows confirmation

### Scene 2: Agent Coordination (45s)
- Show 3 agents (RouteOptimizer, RiskAnalyzer, YieldAggregator) in A2A coordination
- Each agent publishes analysis
- Consensus reached: 40% Base, 35% Optimism, 25% Arbitrum

### Scene 3: CRE Workflow Execution (60s)
- CRE workflow triggered via HTTP
- Chainlink Price Feeds fetch real-time data
- x402 payment locked ($1000 + $5 fee)
- CCIP messages sent to 3 chains

### Scene 4: On-Chain Execution (45s)
- Uniswap v4 hooks deploy liquidity on each chain
- AgenticLiquidityHook shows dynamic fee adjustment
- LP positions minted and verified

### Scene 5: Monitoring & Rebalancing (30s)
- CRE cron trigger shows hourly monitoring
- IL risk threshold hit on Optimism
- Auto-rebalancing triggered, user notified

### Scene 6: Settlement (30s)
- x402 payment released to agent treasury
- User receives yield + can withdraw
- Performance dashboard shows 8% APY

---

## 6. Technology Stack

| Component | Technology |
|-----------|------------|
| **Smart Contracts** | Solidity, Foundry, Uniswap v4-periphery |
| **CRE Workflows** | TypeScript, @chainlink/cre-sdk |
| **Agent Coordination** | A2A Protocol, OpenClaw |
| **Payments** | x402 Protocol, Base |
| **Cross-Chain** | Chainlink CCIP |
| **Oracles** | Chainlink Price Feeds, Data Streams |
| **Frontend** | Next.js, RainbowKit |
| **Monitoring** | Chainlink Automation (CRE Cron) |

---

## 7. Prize Criteria Alignment

### CRE & AI Track Requirements

| Requirement | How AgenticCRE Delivers |
|-------------|-------------------------|
| **CRE Workflow orchestration** | ✅ 6-step workflow with triggers, compute, CCIP |
| **Blockchain + external API integration** | ✅ Chainlink Price Feeds, x402 gateway, A2A agents |
| **AI agent integration** | ✅ 3-agent coordination with consensus |
| **Successful simulation or live deployment** | ✅ CRE CLI simulation + testnet deployment |
| **3-5 min video** | ✅ Structured demo script above |
| **Public GitHub repo** | ✅ Open source with README |

---

## 8. Build Plan (2-3 Weeks)

### Week 1: Foundation
- [ ] Day 1-2: Scaffold smart contracts (AgenticLiquidityHook, Coordinator)
- [ ] Day 3-4: Set up CRE workflow project, HTTP trigger
- [ ] Day 5-7: Integrate Chainlink Price Feeds, basic allocation logic

### Week 2: Integration
- [ ] Day 8-10: x402 payment gateway integration
- [ ] Day 11-12: CCIP cross-chain messaging
- [ ] Day 13-14: A2A agent coordination (3 agents)

### Week 3: Polish & Demo
- [ ] Day 15-16: Frontend for intent submission
- [ ] Day 17-18: CRE cron monitoring, rebalancing logic
- [ ] Day 19-20: Demo video, documentation, submission

---

*Prepared by: Hebx for Chainlink Convergence Hackathon 2026*