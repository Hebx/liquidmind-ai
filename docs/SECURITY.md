# Security — LIQUIDMIND

## Scope
- Uniswap v4 hook execution
- Agent → Coordinator authorization
- Cross-chain messaging (CCIP)
- Subgraph integrity

## Current Controls
- Owner-only coordination in Hook
- Authorized agents via Coordinator registry
- Subgraph read-only from on-chain events

## TODO Before Prod
- Formal access control review
- Rate limiting on agent actions
- Reentrancy/DoS review for hook callbacks
- Escrow enforcement (x402)
- Monitoring + alerting
