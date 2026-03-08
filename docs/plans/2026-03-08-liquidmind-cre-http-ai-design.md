# LiquidMind CRE HTTP + AI Design

**Date:** 2026-03-08
**Status:** Approved for implementation
**Worktree:** `feature/cre-http-ai`

## Goal

Turn LiquidMind into an honest CRE & AI submission where a real user prompt drives a real Base Sepolia execution path through Chainlink CRE, with no mock data in the primary flow.

## Submission Story

LiquidMind should be presented as:

- an AI-powered intent parser for liquidity operations
- an HTTP-triggered Chainlink CRE workflow that consumes the parsed intent
- a real Base Sepolia execution rail that computes and submits actions to `LiquidMindCoordinator`
- a frontend that shows the parsed intent, workflow status, transaction hash, and resulting on-chain state

The canonical path is:

`user prompt -> LLM parse -> backend validation -> signed CRE HTTP trigger -> workflow computes live action -> Base Sepolia transaction -> indexed/frontend proof`

## Canonical Components

### Primary workflow

- `liquidmind/agentic-liquidity/main.ts`
- `liquidmind/agentic-liquidity/src/utils/price-feed.ts`

This is the only CRE workflow path that should remain in the live story.

### On-chain execution

- `contracts/src/LiquidMindCoordinator.sol`
- `contracts/src/AgenticLiquidityHook.sol`

These are already the strongest proof assets in the repo and must remain central to the architecture.

### User entrypoint

- `frontend/src/components/IntentForm.tsx`
- `frontend/src/app/api/intent/route.ts`

This path must stop simulating a hardcoded cron flow and begin sending real user intent through the canonical workflow.

### Verification layer

- `contracts/test/fork/BaseSepolia.t.sol`
- `e2e-live.sh`
- frontend status/analytics pages
- subgraph reads already used by the dashboard

## Hard Boundaries

### No mock data in the main path

The happy path cannot depend on:

- random outputs from `coordinateAgents()`
- placeholder payment escrow IDs
- fake transaction hashes
- heuristic regex parsing presented as AI
- “queued for manual execution” responses presented as success

### One workflow, one story

The repo currently contains a newer `liquidmind/` workflow path and an older `cre-workflow/` path. The newer path becomes canonical. The older path must be demoted from the active story so judges and contributors are not forced to infer which implementation is real.

### Real tx required for “executed”

The UI may only say execution succeeded when it has:

- a real Base Sepolia transaction hash
- the target contract
- the action type
- a verifiable status surface, ideally with a Basescan link

## Architecture Decisions

### 1. Replace cron-first user execution with HTTP trigger

Current CRE docs recommend HTTP triggers for on-demand external initiation. That matches the product better than the current cron-triggered demo path.

The workflow should:

- accept a typed intent payload
- validate and normalize it
- compute live pricing and volatility from Chainlink
- produce the execution action from that specific payload

Cron remains useful later for monitoring and rebalance automation, but it is not the primary user-triggered flow.

### 2. Keep AI scope narrow and real

The AI milestone should be limited to:

- free-text intent parsing
- structured extraction
- schema validation
- normalization into the supported asset/chain set

The AI layer should not yet claim:

- optimal routing
- agent consensus
- yield discovery
- real risk intelligence

Those are separate milestones and are currently stubbed in the repo.

### 3. Preserve single-chain execution

For this milestone, all execution stays on Base Sepolia.

That keeps the submission:

- easier to demonstrate
- easier to verify
- aligned with the already deployed contracts and test evidence

CCIP and cross-chain orchestration remain future milestones.

### 4. Prefer an honest execution bridge over false autonomy

If workflow-native write capability can be added safely and quickly using current CRE patterns, it should be used.

If not, the acceptable fallback is a minimal execution bridge that:

- receives deterministic workflow output
- submits the exact action to Base Sepolia
- returns the real tx hash
- is documented clearly as part of the architecture

The fallback is acceptable only if it remains real, minimal, and explicit.

## Milestones

### Milestone 0: Repository truth cleanup

- make `liquidmind/agentic-liquidity` the canonical workflow package in docs and scripts
- remove active references to `cre-workflow/` from the main story
- document what is live versus deferred

### Milestone 1: Intent-driven HTTP-triggered CRE flow

- add a shared typed intent schema
- add an HTTP-triggered CRE handler
- ensure the incoming payload controls the active workflow execution
- keep simulation using the same payload shape

### Milestone 2: Real AI parsing

- replace heuristic parsing with a real LLM-backed parser
- validate model output against a strict schema
- support only the assets and chains the repo can actually execute

### Milestone 3: Real execution proof

- replace the “print calldata and stop” UX with a real transaction result
- surface tx hash, action type, and contract target in the frontend

### Milestone 4: Submission packaging

- fix README and deployment docs
- link every Chainlink-using file
- tighten the frontend wording to reflect only live functionality
- prepare the demo path for judging

## Explicitly Deferred

- x402 in the live happy path
- real multi-agent A2A services
- CCIP multi-chain execution
- Telegram bot
- cron-based threshold rebalance automation

These stay out of the primary implementation until the CRE HTTP + AI + real execution path is complete.

## Main Risks

### Dependency health

Root workspace install currently fails because of an existing dependency conflict between `wagmi` and `@rainbow-me/rainbowkit`. Frontend work should use the existing installed workspace state where possible or repair the dependency tree as a separate scoped change.

### Execution-path complexity

The repo already has real contract interaction proof, but the live app path still stops short of a true user-driven end-to-end execution. The implementation must avoid overpromising while this is being bridged.

### Scope creep

Anything involving x402, A2A services, or CCIP before the HTTP-triggered path is real should be treated as out of scope.

## Success Criteria

The milestone is complete when:

- a user enters a natural-language intent
- the app shows the parsed structured intent
- the backend triggers the canonical CRE workflow with that exact payload
- the workflow computes a real action from live Chainlink data
- the system submits a real Base Sepolia transaction
- the user sees a real tx hash and resulting on-chain proof
