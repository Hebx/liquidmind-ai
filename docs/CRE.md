# CRE (Chainlink Runtime Environment)

Reference: [CRE docs](https://docs.chain.link/cre) · Workshop: [CRE & x402 masterclass (Base & Chainlink)](https://youtu.be/r7VKS5L47f0)

## Requirements

- CRE CLI installed (latest): `cre version`
- CRE account at [cre.chain.link](https://cre.chain.link)
- For deploy: early access approval; for submission, **simulation is sufficient** (no approval needed)

## Trigger–callback model (workshop alignment)

- Workflows = array of **handlers**; each handler = **trigger** + **callback**.
- Our workflow: **one handler** — cron trigger → 6-step liquidity callback.
- **Trigger index for simulate:** `0` = cron (default). When you add an HTTP trigger, `1` = HTTP.
- Simulation compiles to WASM and runs **real** API/chain calls locally ([CRE execution lifecycle](https://docs.chain.link/cre)).

## Env (liquidmind / agentic-liquidity)

```
BASE_SEPOLIA_RPC=<rpc>
CRE_ETH_PRIVATE_KEY=<key with ETH on mainnet for deploy>
PRIVATE_KEY=<key for coordinator/hook interactions>
# After deploy (optional):
CRE_WORKFLOW_ID=<from cre workflow deploy>
CRE_GATEWAY_URL=<from cre dashboard>
X402_FACILITATOR_URL=https://facilitator.x402.org
```

## CLI flow

### Simulate (no approval; use for hackathon evidence)

```bash
cd liquidmind
cre workflow simulate agentic-liquidity --target staging --non-interactive --trigger-index 0
```

Save the command output (or a screenshot) as **simulation evidence** for submission.

### Deploy (early access)

```bash
cd liquidmind
cre login
cre account link-key --owner-label "Liquidmind" --yes
cre workflow deploy agentic-liquidity --target staging
cre workflows list   # workflow ID + gateway
```

## Project layout

- **Workflow code:** `liquidmind/agentic-liquidity/main.ts`
- **Config:** `liquidmind/project.yaml` (RPCs), `liquidmind/agentic-liquidity/config.staging.json` (schedule)
- **Chain name (Base Sepolia):** `ethereum-testnet-sepolia-base-1` in `project.yaml`

## Notes

- MVP is **Base Sepolia** for contracts; staging RPCs include mainnet for CRE registry when deploying.
- x402: payment-in-request (HTTP 402); our flow supports escrow-style execution; full x402 can be added for pay-per-trigger.
