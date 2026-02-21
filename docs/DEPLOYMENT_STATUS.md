# LIQUIDMIND Deployment Status

**Last updated:** February 21, 2026

---

## 🚦 CRE Workflow Status

- **Simulation:** ✅ Available now — no approval required ([CRE: Build and simulate](https://docs.chain.link/cre))
- **Deployment:** ⏸️ Early access; run `cre workflow deploy agentic-liquidity --target staging` from `liquidmind/` once approved

### Run simulation (satisfies hackathon “successful simulation via CRE CLI”)

```bash
cd liquidmind
cre workflow simulate agentic-liquidity --target staging --non-interactive --trigger-index 0
```

Simulation compiles the workflow to WASM and runs it locally with **real** calls to APIs and blockchains ([CRE execution lifecycle](https://docs.chain.link/cre)).

**Trigger index:** `0` = cron (only handler for now). Same pattern as [CRE & x402 workshop](https://youtu.be/r7VKS5L47f0): handler = trigger + callback; multiple triggers would use index 1, 2, …

### Capture simulation evidence (for submission)

```bash
cd liquidmind
cre workflow simulate agentic-liquidity --target staging --non-interactive --trigger-index 0 2>&1 | tee simulation-output.txt
```

Attach `simulation-output.txt` or a screenshot showing "Simulation result" / user logs to your submission or README.

**Status:** ✅ Simulation completed successfully (WETH/USDC intent → A2A coordination → optimal pool → x402 escrow → position + rebalancing + **volatility oracle → dynamic fee update**). Output saved for submission.

---

## ✅ Deployed (Base Sepolia)

| Component | Address | Status |
|-----------|---------|--------|
| **LiquidMindCoordinator** | `0x268c2E3D23f5cDDAA0D0B40142053414cC05991b` | ✅ Live |
| **AgenticLiquidityHook** | `0xC28ed0595D42ec01A2F7546f39Cf27Ea798598C0` | ✅ Live |

**RPC:** `https://base-sepolia.g.alchemy.com/v2/REDACTED_ALCHEMY_KEY`

---

## ⏸️ CRE Workflow Deploy — Prerequisites

### 1. Link your wallet (required first)
```bash
cd liquidmind
cre account link-key --owner-label "Liquidmind" --yes
```
**Requires:** `CRE_ETH_PRIVATE_KEY` in `.env` with **ETH on Ethereum Mainnet** (for gas).

### 2. Deploy workflow (interactive)
```bash
cd liquidmind
cre workflow deploy agentic-liquidity --target staging
```
**Note:** Run without `--yes` to use interactive prompts. Early access approval may be required.

### Contract Re-deploy
- **Status:** Not needed — contracts already deployed
- **Note:** Re-deploy would fail with CreateCollision (same salt)

---

## 🔧 Environment Summary

### Frontend (`frontend/.env.local`)
```
NEXT_PUBLIC_COORDINATOR_ADDRESS=0x268c2E3D23f5cDDAA0D0B40142053414cC05991b
NEXT_PUBLIC_HOOK_ADDRESS=0xC28ed0595D42ec01A2F7546f39Cf27Ea798598C0
NEXT_PUBLIC_BASE_SEPOLIA_RPC=https://base-sepolia.g.alchemy.com/v2/...
```

### Liquidmind / Agentic-Liquidity
- `BASE_SEPOLIA_RPC`, `CRE_ETH_PRIVATE_KEY`, `PRIVATE_KEY` configured
- Contract addresses in `.env`

---

## Milestone 2: Dynamic Fee from Live Volatility Oracle

**Status:** ✅ Complete — executing on-chain

| Feature | Description | Status |
|---------|-------------|--------|
| Volatility Oracle | Reads 5+ historical Chainlink rounds via `getRoundData()` | ✅ Live |
| Annualized Vol Calc | Log-return std dev × sqrt(periods/year) | ✅ |
| Fee Tier Mapping | vol→fee: <20%→500, <40%→3000, <80%→5000, <120%→8000, ≥120%→10000 | ✅ |
| CRE `updateFee` Action | Builds `executeLocalHookAction(updateFee)` calldata | ✅ |
| On-chain Execution | `Coordinator→Hook._executeFeeUpdate()` updates `baseFee` | ✅ Confirmed |
| Fork Test | `test_Fork_ExecuteLocalHookAction_UpdateFee` + `test_Fork_ChainlinkHistoricalRounds` | ✅ 16/16 |
| E2E Script Step 7 | Automatic pool config seeding + fee update submission | ✅ 12/12 |

---

## Next Steps

1. **Demo video:** Record 3–5 min showing simulation (and optionally frontend); add link to README.
2. **Repo:** Make repository public before submission deadline.
3. **CRE deploy (optional):** When early access is granted, run `cre workflow deploy agentic-liquidity --target staging` and add workflow ID to this doc.
4. **Integration:** Wire frontend/agents to CRE endpoint when deployed; subgraph if needed for UI.
