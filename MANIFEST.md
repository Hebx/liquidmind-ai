# OpenClaw Migration Manifest (2026-02-18)
# Use this list to verify all paths are captured for VPS migration.

## 1. Global Configurations
- ~/.openclaw/config.yaml
- ~/.openclaw/identities/
- ~/.openclaw/logs/
- ~/.config/notion/api_key
- ~/.openmemory/ (Database files)

## 2. Workspace: /Users/heb/clawd
- /Users/heb/clawd/SOUL.md
- /Users/heb/clawd/IDENTITY.md
- /Users/heb/clawd/USER.md
- /Users/heb/clawd/MEMORY.md
- /Users/heb/clawd/AGENTS.md
- /Users/heb/clawd/TOOLS.md
- /Users/heb/clawd/memory/ (All daily logs + KG JSONL)
- /Users/heb/clawd/skills/ (Custom installed skills)
- /Users/heb/clawd/docs/ (Local documentation)

## 3. Active Projects
- /Users/heb/clawd/projects/liquidmind-ai/
  - contracts/
  - agents/
  - cre-workflow/
  - frontend/
  - MIGRATION.md (This plan)
- /Users/heb/clawd/projects/hebx-mission-control/ (If active)

## 4. Key Executables & Scripts
- /Users/heb/clawd/scripts/knowledge-graph/kg-server.mjs
- /Users/heb/clawd/skills/knowledge-graph/ingest.mjs

## 5. Security & Environment
- /Users/heb/clawd/projects/liquidmind-ai/.env
- /Users/heb/clawd/projects/liquidmind-ai/cre-workflow/.env
