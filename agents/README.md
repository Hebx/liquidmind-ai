# LIQUIDMIND A2A Agents

Multi-agent system for decentralized liquidity optimization on Hedera, implementing the Agent-to-Agent (A2A) protocol for intelligent DeFi automation.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    LIQUIDMIND AGENTS                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐      ┌──────────────┐                    │
│  │ Coordinator  │◄────►│ Route        │                    │
│  │              │      │ Optimizer    │                    │
│  │ - Task mgmt  │      │              │                    │
│  │ - Routing    │      │ - Pool graph │                    │
│  │ - Events     │      │ - Path find  │                    │
│  └──────┬───────┘      └──────────────┘                    │
│         │                                                   │
│         │            ┌──────────────┐                      │
│         └───────────►│ Risk         │                      │
│                      │ Analyzer     │                      │
│         ┌───────────►│              │                      │
│         │            │ - IL calc    │                      │
│  ┌──────┴───────┐    │ - Pool risk  │                      │
│  │ Yield        │    └──────────────┘                      │
│  │ Aggregator   │                                          │
│  │              │                                          │
│  │ - APY fetch  │                                          │
│  │ - Comparison │                                          │
│  └──────────────┘                                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │ Hedera Network  │
                    │ SaucerSwap      │
                    │ Pangolin        │
                    │ HeliSwap        │
                    └─────────────────┘
```

## Agents

### Coordinator (`src/coordinator.ts`)
The central orchestrator that routes tasks between specialized agents using the A2A protocol.

**Responsibilities:**
- Agent registration and discovery
- Task dispatching and tracking
- Event broadcasting
- Health monitoring

**Key Methods:**
- `registerAgent(id, endpoint, capabilities)` - Register a new agent
- `dispatchTask(type, params, priority)` - Send task to appropriate agent
- `handleMessage(message)` - Process incoming A2A messages

### Route Optimizer (`src/route-optimizer.ts`)
Finds optimal liquidity routes across DEX protocols using graph algorithms.

**Responsibilities:**
- Pool graph construction
- Multi-hop route discovery
- Price impact calculation
- Slippage optimization

**Key Methods:**
- `findOptimalRoute(request)` - Find best swap route
- `getTokenPrices(tokens)` - Fetch current token prices
- `evaluateRoute(pools, amountIn)` - Calculate route metrics

### Risk Analyzer (`src/risk-analyzer.ts`)
Calculates impermanent loss risk and assesses pool risk profiles.

**Responsibilities:**
- IL calculation using constant product formula
- Volatility scoring
- Pool risk assessment
- Risk-adjusted yield computation

**Key Methods:**
- `calculateILRisk(params)` - Calculate impermanent loss
- `assessPoolRisk(pool)` - Generate risk profile
- `calculateRiskAdjustedYield(opportunity, risk)` - Risk-adjust returns

### Yield Aggregator (`src/yield-aggregator.ts`)
Aggregates yield data from multiple DeFi protocols on Hedera.

**Responsibilities:**
- APY fetching from SaucerSwap, Pangolin, HeliSwap
- Reward token tracking
- Yield comparison
- Opportunity discovery

**Key Methods:**
- `getYieldOpportunities(request)` - Find yields for token
- `getAllOpportunities()` - Get all yield data
- `calculateTotalApy(opportunity)` - Include rewards in APY

## Quick Start

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env
# Edit .env with your configuration

# Build
npm run build

# Run tests
npm test

# Start development
npm run dev
```

## A2A Protocol

Messages between agents follow a standard format:

```typescript
interface A2AMessage {
  id: string;
  from: string;
  to: string;
  type: 'task-request' | 'task-response' | 'task-result' | 'error';
  payload: unknown;
  timestamp: number;
  signature?: string;
}
```

### Example Task Flow

```typescript
// 1. Coordinator dispatches task
const result = await coordinator.dispatchTask(
  'optimize-route',
  {
    tokenIn: HBAR,
    tokenOut: SAUCE,
    amountIn: BigInt(1000000000),
    maxSlippage: 0.01
  },
  'high'
);

// 2. Route Optimizer receives and processes
// 3. Returns optimal route with alternatives
```

## Configuration

See `.env.example` for all configuration options:

| Variable | Description | Default |
|----------|-------------|---------|
| `AGENT_ID` | Unique agent identifier | - |
| `HEDERA_NETWORK` | mainnet/testnet/previewnet | testnet |
| `COORDINATOR_ENDPOINT` | Coordinator API URL | http://localhost:3001 |
| `SAUCERSWAP_API` | SaucerSwap API endpoint | https://api.saucerswap.finance |
| `REFRESH_INTERVAL_MS` | Data refresh interval | 30000 |
| `MAX_SLIPPAGE` | Default max slippage | 0.01 (1%) |

## Testing

```bash
# Run all tests
npm test

# Run specific test file
npm test -- route-optimizer.test.ts

# Run with coverage
npm test -- --coverage
```

## Impermanent Loss Formula

The Risk Analyzer uses the standard constant product IL calculation:

```
IL = (2 * sqrt(r)) / (1 + r) - 1

Where:
  r = current_price / entry_price
```

Example IL values:
| Price Change | IL |
|--------------|-----|
| 1.25x | 0.6% |
| 1.5x | 2.0% |
| 2x | 5.7% |
| 3x | 13.4% |
| 4x | 20.0% |
| 5x | 25.5% |

## Protocol Support

| Protocol | Status | Endpoints |
|----------|--------|-----------|
| SaucerSwap | ✅ Active | /pools, /tokens, /prices |
| Pangolin | 🚧 Planned | - |
| HeliSwap | 🚧 Planned | - |

## License

MIT
