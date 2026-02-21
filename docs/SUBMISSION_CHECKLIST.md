# LIQUIDMIND Convergence Submission Checklist

Last updated: 2026-02-20

---

## Core Requirements

| Requirement | Status | Notes |
|---|---|---|
| Public GitHub repository | ⚠️ Pending | Set repo visibility to public before final submission |
| CRE workflow used as orchestration layer | ✅ Ready | Implemented in `liquidmind/agentic-liquidity/main.ts` |
| Successful workflow simulate or live deployment | ✅ Simulation | [CRE docs](https://docs.chain.link/cre): “demonstrate a successful simulation (via the CRE CLI) or a live deployment”; we use CLI simulation |
| At least one blockchain + external system/API/AI integration | ✅ Ready | Base Sepolia + A2A agents + price feed/x402 logic |
| 3-5 minute public demo video | ⚠️ Pending | Record and publish link |
| README linking Chainlink-related files | ✅ Ready | See `README.md` "Chainlink Integration Files" |

---

## Evidence To Collect Before Submission

- **Simulation proof:** ✅ Captured — workflow simulation completed successfully; output saved (see [DEPLOYMENT_STATUS](./DEPLOYMENT_STATUS.md))
- *(If deployed)* CRE workflow ID and one execution log/screenshot
- On-chain transaction proof from Base Sepolia for the integrated flow
- Public demo video URL (3–5 min; see [VIDEO_SCRIPT](./VIDEO_SCRIPT.md) for recording steps)
- Final README links verified end-to-end

---

## Final Pre-Submit Gate

- [ ] Repository visibility is public
- [ ] `README.md` is accurate and all links resolve
- [x] Simulation (or deploy) evidence captured — see `docs/DEPLOYMENT_STATUS.md`
- [ ] Demo video is public and 3-5 minutes
- [ ] One teammate dry-runs the submission form with this checklist
