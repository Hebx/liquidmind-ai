# Security

## Access Control

| Role | Enforced By | Scope |
|------|-------------|-------|
| **PoolManager** | `onlyPoolManager` modifier | All hook callbacks |
| **Coordinator** | `onlyCoordinator` modifier | `executeAgentAction`, `receiveCrossChainSignal` |
| **Owner** | `onlyOwner` modifier | `setAgentCoordinator`, `setPoolConfig`, `transferOwnership` |
| **Agents** | `onlyAgent` modifier on Coordinator | `executeLocalHookAction` |

## Hook Design

- All hook callbacks verify `msg.sender == address(poolManager)`
- `executeAgentAction` uses action ID deduplication (`executedActions` mapping) to prevent replay
- Fee updates are bounded by `[minFee, maxFee]` from pool config
- Tick ranges validated: `upper > lower`

## Agent Registry

- Agents registered via `Coordinator.registerAgent()` (owner-only)
- `getAgent()` returns `(isAuthorized, reputation, registeredAt)`
- Hook queries coordinator via `staticcall` for agent authorization

## Known Limitations (Testnet)

- No timelock on owner actions
- No multi-sig — single owner key
- Agent reputation is static (set at registration, not updated)
- Cross-chain signals not yet rate-limited
