# Runbook — LIQUIDMIND

## Health Checks
- Frontend up: `npm run dev` (or `npm run start`)
- Subgraph: hit GraphQL endpoint and `_meta { block { number } }`
- Contracts: `cast code <addr>` on Base Sepolia

## Common Issues
### Subgraph not updating
- Check `_meta.block.number`
- Confirm Goldsky deploy succeeded
- Check for indexer lag

### No events in UI
- Ensure subgraph URL correct
- Verify contracts emitting events
- Check blockNumber on subgraph entities

## Rollback
- Revert to previous frontend build
- Redeploy subgraph version and retag
- Use previous contract addresses in env

## Incident Response
1. Capture failing endpoint + error logs
2. Verify chain RPC health
3. Pause subgraph if runaway queries
4. Patch + redeploy
