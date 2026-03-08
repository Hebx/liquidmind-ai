# LiquidMind CRE HTTP + AI Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Convert LiquidMind into a real CRE & AI Base Sepolia flow where a natural-language user intent drives the canonical CRE workflow and results in a verifiable on-chain action with no mock data in the primary path.

**Architecture:** The frontend will send raw user intent to a backend route. That route will call a real LLM parser to produce a validated `LiquidityIntent`, then trigger the canonical `liquidmind/agentic-liquidity` workflow through an HTTP-trigger-compatible path. The workflow will consume that specific payload, compute live pricing and fee/range values from Chainlink feeds, and return or submit a real Base Sepolia action whose proof is surfaced in the UI.

**Tech Stack:** Next.js 16 / React 19 frontend, TypeScript backend routes, Chainlink CRE SDK, Foundry, viem, Base Sepolia, existing Uniswap v4 hook contracts.

---

### Task 1: Canonicalize the CRE workflow source of truth

**Files:**
- Create: `docs/plans/2026-03-08-liquidmind-cre-http-ai-design.md`
- Modify: `README.md`
- Modify: `package.json`
- Modify: `docs/DEPLOYMENT.md`
- Modify: `docs/DEPLOYMENT_STATUS.md`

**Intent:** Remove ambiguity between `liquidmind/` and `cre-workflow/` so the repo, docs, and scripts all point to the real workflow path used for this milestone.

**Step 1: Write the failing documentation assertions**

Create a short checklist in the task notes and verify each of these currently fails:

- Root scripts still point to `cre-workflow`
- README does not document the HTTP-trigger target architecture
- Docs do not clearly separate live functionality from deferred functionality

**Step 2: Verify RED**

Run:

```bash
rg "cre-workflow|cron-triggered|x402 escrow|A2A AGENT SWARM · LIVE" /home/openclaw/clawd/projects/liquidmind-ai/.worktrees/feature-cre-http-ai/README.md /home/openclaw/clawd/projects/liquidmind-ai/.worktrees/feature-cre-http-ai/package.json /home/openclaw/clawd/projects/liquidmind-ai/.worktrees/feature-cre-http-ai/docs
```

Expected:

- matches that prove the repo story is inconsistent with the approved design

**Step 3: Write the minimal implementation**

- update root workspace scripts to use `liquidmind/agentic-liquidity` as the canonical CRE package where applicable
- update README wording to describe the real current execution path and the new HTTP-trigger direction
- update deployment docs to reflect the current canonical workflow path and live/deferred boundaries
- remove or reword live claims that are not yet true

**Step 4: Verify GREEN**

Run:

```bash
rg "cre-workflow" /home/openclaw/clawd/projects/liquidmind-ai/.worktrees/feature-cre-http-ai/README.md /home/openclaw/clawd/projects/liquidmind-ai/.worktrees/feature-cre-http-ai/package.json /home/openclaw/clawd/projects/liquidmind-ai/.worktrees/feature-cre-http-ai/docs
```

Expected:

- no remaining active references outside explicitly historical/deferred contexts

**Step 5: Commit**

```bash
git add README.md package.json docs/DEPLOYMENT.md docs/DEPLOYMENT_STATUS.md docs/plans/2026-03-08-liquidmind-cre-http-ai-design.md docs/plans/2026-03-08-liquidmind-cre-http-ai.md
git commit -m "docs: align LiquidMind around canonical CRE workflow"
```

### Task 2: Introduce a shared intent schema and HTTP-trigger-ready workflow entrypoint

**Files:**
- Create: `liquidmind/agentic-liquidity/src/lib/intent.ts`
- Modify: `liquidmind/agentic-liquidity/main.ts`
- Test: `liquidmind/agentic-liquidity/src/lib/intent.test.ts`

**Intent:** Ensure the active CRE workflow can consume explicit typed intent payloads instead of the current hardcoded cron-only demo intent.

**Step 1: Write the failing test**

Add tests that prove:

- raw payload validation rejects malformed intent
- valid structured payload is normalized into the workflow shape
- workflow input helpers do not fall back to the demo intent when a valid payload is supplied

**Step 2: Verify RED**

Run:

```bash
cd /home/openclaw/clawd/projects/liquidmind-ai/.worktrees/feature-cre-http-ai/liquidmind/agentic-liquidity && npm test -- --runInBand src/lib/intent.test.ts
```

Expected:

- failing tests because shared intent helpers do not exist yet

**Step 3: Write the minimal implementation**

- extract `LiquidityIntent` and validation/normalization logic into a shared module
- add an HTTP-trigger-compatible input path in `main.ts`
- preserve cron only as a secondary default path for later monitoring, not the main user flow
- ensure both simulation and future deployed triggering use the same payload shape

**Step 4: Verify GREEN**

Run:

```bash
cd /home/openclaw/clawd/projects/liquidmind-ai/.worktrees/feature-cre-http-ai/liquidmind/agentic-liquidity && npm test -- --runInBand src/lib/intent.test.ts
```

Expected:

- passing tests for validation and payload selection

**Step 5: Commit**

```bash
git add liquidmind/agentic-liquidity/main.ts liquidmind/agentic-liquidity/src/lib/intent.ts liquidmind/agentic-liquidity/src/lib/intent.test.ts
git commit -m "feat: accept explicit intent payloads in CRE workflow"
```

### Task 3: Replace heuristic parsing with a real LLM-backed parser

**Files:**
- Create: `frontend/src/lib/intent-parser.ts`
- Modify: `frontend/src/app/api/intent/route.ts`
- Test: `frontend/src/lib/intent-parser.test.ts`

**Intent:** Make the AI claim real by replacing regex heuristics with a model-backed parser whose output is validated against the shared intent schema.

**Step 1: Write the failing test**

Add tests that prove:

- a valid model response is parsed into supported `LiquidityIntent` fields
- unsupported assets/chains are rejected
- malformed model output returns a validation error instead of a fake success

**Step 2: Verify RED**

Run:

```bash
cd /home/openclaw/clawd/projects/liquidmind-ai/.worktrees/feature-cre-http-ai/frontend && npm test -- --runInBand src/lib/intent-parser.test.ts
```

Expected:

- failing tests because the parser module and route integration do not exist yet

**Step 3: Write the minimal implementation**

- add a thin LLM client wrapper using environment-configured credentials
- restrict model output to supported action/token/risk values
- validate output against the shared schema before the route can proceed
- remove the current regex-based `parseNaturalLanguageIntent()`

**Step 4: Verify GREEN**

Run:

```bash
cd /home/openclaw/clawd/projects/liquidmind-ai/.worktrees/feature-cre-http-ai/frontend && npm test -- --runInBand src/lib/intent-parser.test.ts
```

Expected:

- passing tests for real parser behavior and validation

**Step 5: Commit**

```bash
git add frontend/src/lib/intent-parser.ts frontend/src/lib/intent-parser.test.ts frontend/src/app/api/intent/route.ts
git commit -m "feat: add LLM-backed intent parsing"
```

### Task 4: Wire the backend route to the canonical CRE execution path

**Files:**
- Modify: `frontend/src/app/api/intent/route.ts`
- Modify: `liquidmind/project.yaml`
- Modify: `liquidmind/agentic-liquidity/main.ts`
- Test: `frontend/src/app/api/intent/route.test.ts`

**Intent:** Connect validated intent input to the canonical CRE workflow through the approved HTTP-trigger-compatible path.

**Step 1: Write the failing test**

Add tests that prove:

- the route submits the validated payload to the canonical workflow path
- the route does not invoke the older `cre-workflow/` workspace
- the route returns workflow-derived output keyed to the submitted intent

**Step 2: Verify RED**

Run:

```bash
cd /home/openclaw/clawd/projects/liquidmind-ai/.worktrees/feature-cre-http-ai/frontend && npm test -- --runInBand src/app/api/intent/route.test.ts
```

Expected:

- failing tests because the route still shells into cron simulation without shared payload semantics

**Step 3: Write the minimal implementation**

- update the route to call the canonical workflow directory only
- pass the validated payload through the workflow invocation path
- prepare the configuration and docs for the CRE HTTP trigger shape
- keep simulation support for development, but ensure it uses the submitted intent rather than a hardcoded default

**Step 4: Verify GREEN**

Run:

```bash
cd /home/openclaw/clawd/projects/liquidmind-ai/.worktrees/feature-cre-http-ai/frontend && npm test -- --runInBand src/app/api/intent/route.test.ts
```

Expected:

- passing route tests proving the canonical workflow path and payload usage

**Step 5: Commit**

```bash
git add frontend/src/app/api/intent/route.ts frontend/src/app/api/intent/route.test.ts liquidmind/project.yaml liquidmind/agentic-liquidity/main.ts
git commit -m "feat: trigger canonical CRE workflow from intent API"
```

### Task 5: Surface real execution state in the frontend

**Files:**
- Modify: `frontend/src/components/IntentForm.tsx`
- Modify: `frontend/src/app/page.tsx`
- Optionally create: `frontend/src/components/IntentExecutionStatus.tsx`
- Test: `frontend/src/components/IntentForm.test.tsx`

**Intent:** Make the UI prove authenticity by showing parsed intent, execution state, action type, contract target, and transaction hash instead of generic live labels.

**Step 1: Write the failing test**

Add tests that prove:

- the form submits raw intent to the backend
- pending, success, and failure states render correctly
- success rendering requires real execution metadata

**Step 2: Verify RED**

Run:

```bash
cd /home/openclaw/clawd/projects/liquidmind-ai/.worktrees/feature-cre-http-ai/frontend && npm test -- --runInBand src/components/IntentForm.test.tsx
```

Expected:

- failing tests because the form still only logs to the console

**Step 3: Write the minimal implementation**

- submit the form to `/api/intent`
- render parsed intent details
- render workflow/execution state
- remove or reword UI text that claims x402, live A2A agents, or escrow if those are not truly part of the path

**Step 4: Verify GREEN**

Run:

```bash
cd /home/openclaw/clawd/projects/liquidmind-ai/.worktrees/feature-cre-http-ai/frontend && npm test -- --runInBand src/components/IntentForm.test.tsx
```

Expected:

- passing tests for real submission UX

**Step 5: Commit**

```bash
git add frontend/src/components/IntentForm.tsx frontend/src/app/page.tsx frontend/src/components/IntentExecutionStatus.tsx frontend/src/components/IntentForm.test.tsx
git commit -m "feat: show live intent execution status in dashboard"
```

### Task 6: Final verification and submission-ready docs

**Files:**
- Modify: `README.md`
- Modify: `docs/DEPLOYMENT.md`
- Modify: `docs/VIDEO_SCRIPT.md`

**Intent:** Finish with a submission package that maps directly to the CRE & AI judging criteria.

**Step 1: Write the failing checklist**

Verify that the docs currently do not fully cover:

- which files use Chainlink
- how the AI parser fits into the flow
- how to run the end-to-end demo
- what is deferred versus live

**Step 2: Verify RED**

Run:

```bash
rg "Chainlink|HTTP trigger|AI parser|deferred|video" /home/openclaw/clawd/projects/liquidmind-ai/.worktrees/feature-cre-http-ai/README.md /home/openclaw/clawd/projects/liquidmind-ai/.worktrees/feature-cre-http-ai/docs/DEPLOYMENT.md /home/openclaw/clawd/projects/liquidmind-ai/.worktrees/feature-cre-http-ai/docs/VIDEO_SCRIPT.md
```

Expected:

- gaps or outdated descriptions remain

**Step 3: Write the minimal implementation**

- add a Chainlink file index to README
- document the real user flow end to end
- document required env vars and demo commands
- update the video script so it matches the implemented architecture exactly

**Step 4: Verify GREEN**

Run:

```bash
rg "HTTP trigger|Base Sepolia|intent parser|tx hash|deferred" /home/openclaw/clawd/projects/liquidmind-ai/.worktrees/feature-cre-http-ai/README.md /home/openclaw/clawd/projects/liquidmind-ai/.worktrees/feature-cre-http-ai/docs/DEPLOYMENT.md /home/openclaw/clawd/projects/liquidmind-ai/.worktrees/feature-cre-http-ai/docs/VIDEO_SCRIPT.md
```

Expected:

- the live story and runbook are explicit and consistent

**Step 5: Commit**

```bash
git add README.md docs/DEPLOYMENT.md docs/VIDEO_SCRIPT.md
git commit -m "docs: prepare LiquidMind for CRE and AI submission"
```

## Execution Notes

- Use `liquidmind/agentic-liquidity/` as the only active CRE package.
- Do not claim x402, CCIP, or live A2A in the main path until they are actually implemented.
- Prefer narrow, real tests over broad mocked tests.
- Keep Base Sepolia as the only execution target for this milestone.
- Root `npm install` currently fails due to an existing dependency conflict. Avoid expanding scope into dependency upgrades unless required by a specific task.
