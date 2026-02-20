# 🔄 LiquidMind CRE Workflow

Chainlink CRE (Chainlink Runtime Environment) workflow for autonomous liquidity management using A2A agents and x402 micropayments.

## 📋 Overview

This workflow implements a 6-step autonomous liquidity management system:

1. **Intent Analysis** - Parse and validate user liquidity intent
2. **Agent Coordination** - A2A consensus from Route Optimizer, Risk Analyzer, and Yield Aggregator
3. **Risk Assessment** - Validate against user risk tolerance
4. **Opportunity Discovery** - Find optimal pools and yields
5. **Execution via x402** - Lock payments in escrow and execute cross-chain
6. **Monitoring & Rebalancing** - Automated position monitoring

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn
- Git

### Installation

```bash
cd cre-workflow
npm install
```

### Configuration

Copy the environment template and fill in your credentials:

```bash
cp .env.example .env
# Edit .env with your actual values
```

Key required variables:
- `CRE_API_KEY` - From Chainlink CRE dashboard
- `CRE_GATEWAY_URL` - From CRE Gateway endpoints
- `CRE_WORKFLOW_ID` - From CRE dashboard after deploy
- `PRIVATE_KEY` - Dedicated workflow wallet (keep secure!)
- `BASE_SEPOLIA_RPC` - RPC endpoint
- `X402_FACILITATOR_URL` - x402 facilitator
- `AGENT_TREASURY_ADDRESS` - Treasury wallet

## 🛠️ Usage

### Build

```bash
npm run build
```

### Run Workflow (Production)

```bash
npm run dev
```

### CRE CLI (latest)
```bash
# login
cre login

# deploy workflow
cre workflows deploy dist/agentic-liquidity.js

# list workflows (get CRE_WORKFLOW_ID)
cre workflows list
```

### Run Mock Simulation (Testing)

```bash
npm run simulate
```

## 📁 Project Structure

```
cre-workflow/
├── src/
│   ├── agentic-liquidity.ts    # Main CRE workflow
│   ├── mock-workflow.ts        # Local testing simulation
│   └── utils/
│       └── price-feed.ts       # Price feed utilities
├── dist/                       # Compiled TypeScript
├── .env.example                # Environment template
├── package.json                # Dependencies
├── tsconfig.json               # TypeScript config
└── README.md                   # This file
```

## 🧪 Testing

### Unit Tests

```bash
npm test
```

### Integration Testing

Run the mock workflow to simulate all 6 steps without real transactions:

```bash
npm run simulate
```

Expected output:
```
🚀 Starting LiquidMind CRE Workflow
==================================================
Step 1: Intent Analysis
  Token A Price: $3200.50
  Token B Price: $1.00
  Action: deposit
  Risk Tolerance: medium
Step 2: Agent Coordination
  ✅ Route Optimizer: Pool 0x7a3b...e9f2
  ✅ Risk Analyzer: Score 45/100
  ✅ Yield Aggregator: APY 15.3%
...
✅ Workflow completed successfully!
Position ID: pos-1699999999999
```

## 🔗 Integration Guide

### Registering the Workflow

1. Go to [Chainlink CRE Dashboard](https://cre.chain.link)
2. Create new workflow
3. Upload `dist/agentic-liquidity.js`
4. Configure environment variables
5. Deploy to testnet

### A2A Agent Setup

Ensure your agent services are running:

```bash
# Route Optimizer (port 3001)
cd ../agents && npm run route-optimizer

# Risk Analyzer (port 3002)
cd ../agents && npm run risk-analyzer

# Yield Aggregator (port 3003)
cd ../agents && npm run yield-aggregator
```

### x402 Payment Integration

The workflow uses x402 for payment escrow:

1. Configure `X402_GATEWAY_URL` in `.env`
2. Set `PAYMENT_RECEIVER` to your treasury address
3. The workflow automatically locks payments before execution

## 📊 Workflow Steps

### 1. Intent Analysis
```typescript
interface LiquidityIntent {
  action: "deposit" | "withdraw" | "rebalance";
  tokenA: string;
  tokenB: string;
  amount: bigint;
  preferredChains: string[];
  riskTolerance: "low" | "medium" | "high";
  minYield: number;
}
```

### 2. Agent Coordination
Coordinates with 3 A2A agents:
- **Route Optimizer**: Finds optimal pool and route
- **Risk Analyzer**: Evaluates risk metrics
- **Yield Aggregator**: Projects yield and allocation

### 3. Risk Assessment
Validates against user-defined risk tolerance:
- Low: Max risk score 30
- Medium: Max risk score 60
- High: Max risk score 85

### 4. Opportunity Discovery
Fetches real-time pool data:
- TVL
- 24h Volume
- Expected APY

### 5. Execution via x402
1. Lock payment in x402 escrow
2. Execute via CCIP for cross-chain
3. Deploy to Uniswap v4 hook

### 6. Monitoring & Rebalancing
- Chainlink Automation integration
- Rebalance triggered at 5% drift threshold
- Hourly checks by default

## 🔧 Configuration Options

### Price Feed Sources

Priority order:
1. Chainlink Price Feeds (primary)
2. CoinGecko API (fallback)
3. Mock prices (development)

Set `USE_MOCK_PRICES=true` in `.env` for local testing.

### Retry Logic

Default configuration:
- Max retries: 3
- Retry delay: 5 seconds
- Timeout: 5 minutes

### Supported Tokens

Currently supported:
- WETH, WBTC
- USDC, USDT, DAI
- LINK, UNI

Add new tokens to `src/utils/price-feed.ts`.

## 🐛 Troubleshooting

### Common Issues

**"Cannot find module '@chainlink/cre-sdk'"**
```bash
npm install
```

**"CRE_API_KEY is required"**
- Ensure `.env` file exists
- Check that `CRE_API_KEY` is set

**"Price feed timeout"**
- Check internet connection
- Verify CoinGecko API key if using pro features

**"Transaction failed"**
- Ensure wallet has sufficient ETH for gas
- Check that `SIMULATION_MODE=false` for real transactions

### Debug Mode

Enable debug logging:
```bash
LOG_LEVEL=debug npm run dev
```

## 🔐 Security

### Wallet Security
- Use a dedicated workflow wallet (not your main wallet)
- Keep `PRIVATE_KEY` in `.env` only, never commit
- Limit wallet funds to operational minimum
- Use a hardware wallet for production

### API Keys
- Rotate API keys regularly
- Use separate keys for dev/staging/prod
- Monitor API usage for anomalies

### Smart Contract
- All contracts are audited before production use
- Workflow includes circuit breakers for emergency stops

## 📚 Additional Resources

- [Chainlink CRE Docs](https://docs.chain.link/cre)
- [x402 Protocol](https://x402.org)
- [A2A Protocol](https://a2a.org)
- [LiquidMind Smart Contracts](../contracts/README.md)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests: `npm test`
5. Submit a pull request

## 📄 License

MIT License - see [LICENSE](../LICENSE) for details.

---

Built with 🧠 by **LiquidMind** for Chainlink Convergence 2026
