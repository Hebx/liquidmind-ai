# Demo Video Script (3–5 min)

Use this to record the Convergence submission video. Show workflow execution as part of the app or via the CRE CLI.

---

## 1. Intro (30–45 s)

- **Say:** LiquidMind — AI-driven liquidity management using Chainlink CRE and Uniswap v4 hooks.
- **Show:** README or architecture diagram (intent → A2A agents → CRE workflow → x402 → hook).
- **Say:** We have contracts on Base Sepolia and a CRE workflow that we run via simulation (and can deploy when early access is granted).

---

## 2. CRE workflow simulation (1.5–2 min)

- **Do:** From repo root: `cd liquidmind && cre workflow simulate agentic-liquidity --target staging --non-interactive --trigger-index 0`
- **Show:** Terminal output: intent analysis, A2A coordination (Route Optimizer, Risk Analyzer, Yield Aggregator), risk check, opportunity discovery, x402 escrow, position ID, rebalancing.
- **Say:** Simulation compiles to WASM and runs the full 6-step flow; this satisfies the hackathon “successful simulation via CRE CLI” requirement.

---

## 3. Contracts / frontend (optional, 1–2 min)

- **Show:** Base Sepolia deployment (coordinator + hook addresses in DEPLOYMENT_STATUS or block explorer).
- **Or:** Frontend (`npm run dev` in `frontend/`) — connect wallet, show intent form and agent status (if wired).

---

## 4. Wrap (30 s)

- **Say:** Repo is public (or will be); README links to all Chainlink-related files; simulation output is saved for submission.
- **Say:** Built for the Chainlink Convergence Hackathon — CRE & AI track.

---

## Checklist before recording

- [ ] CRE CLI works: `cre version` and simulate command run successfully
- [ ] Simulation output or screenshot ready to reference
- [ ] README and docs/DEPLOYMENT_STATUS.md up to date
- [ ] Record in one take or cut to 3–5 min; upload to YouTube (unlisted OK); add link to README Demo section
