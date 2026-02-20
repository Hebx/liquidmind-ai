# CRE (Chainlink Runtime Environment)

## Requirements
- CRE CLI installed (latest)
- CRE project access

## Env
```
CRE_WORKFLOW_ID=<from cre workflows list>
CRE_GATEWAY_URL=<from cre dashboard>
CRE_API_KEY=<from cre dashboard>
BASE_SEPOLIA_RPC=<rpc>
X402_FACILITATOR_URL=https://facilitator.x402.org
AGENT_TREASURY_ADDRESS=<treasury>
```

## CLI Flow
```
cd cre-workflow
npm install
npm run build
cre login
cre workflows deploy dist/agentic-liquidity.js
cre workflows list
```

## Notes
- MVP is **Base Sepolia only**
- Workflow ID is required to trigger CRE gateway
