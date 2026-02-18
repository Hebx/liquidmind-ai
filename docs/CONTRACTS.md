# Smart Contract Architecture

## Overview

LIQUIDMIND's smart contract layer consists of two main components:
1. **AgenticLiquidityHook** — Uniswap v4 hook for dynamic liquidity management
2. **LiquidMindCoordinator** — Cross-chain coordination hub with CCIP integration

---

## Contract Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                     LiquidMindCoordinator                           │
│                         (CCIP Receiver)                             │
├─────────────────────────────────────────────────────────────────────┤
│  • Receive CCIP messages from CRE workflow                          │
│  • Verify CRE signatures                                            │
│  • Route to appropriate chain/hook                                  │
│  • Manage x402 payment state                                        │
└─────────────────────────────────────────────────────────────────────┘
                              │
           ┌──────────────────┼──────────────────┐
           │                  │                  │
           ▼                  ▼                  ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│  AgenticHook    │ │  AgenticHook    │ │  AgenticHook    │
│    (Base)       │ │  (Optimism)     │ │  (Arbitrum)     │
├─────────────────┤ ├─────────────────┤ ├─────────────────┤
│ • Dynamic fees  │ │ • Dynamic fees  │ │ • Dynamic fees  │
│ • Auto-rebalance│ │ • Auto-rebalance│ │ • Auto-rebalance│
│ • IL monitoring │ │ • IL monitoring │ │ • IL monitoring │
└─────────────────┘ └─────────────────┘ └─────────────────┘
```

---

## AgenticLiquidityHook

### Purpose
Uniswap v4 hook that enables AI agents to dynamically manage concentrated liquidity positions with automated rebalancing and impermanent loss protection.

### Key Features

#### 1. Dynamic Fee Adjustment
```solidity
function getFee(address sender, PoolKey calldata key) external view returns (uint24) {
    uint256 volatility = IAgentCoordinator(A2A_COORDINATOR).getVolatility(key);
    return calculateDynamicFee(volatility); // 0.01% - 1%
}
```

Fees adjust based on:
- Market volatility (from Chainlink Price Feeds)
- Pool liquidity depth
- Agent risk parameters

#### 2. Automated Rebalancing
```solidity
function afterSwap(address sender, PoolKey calldata key, ...) external returns (bytes4) {
    if (authorizedAgents[sender]) {
        (bool needsRebalance, int24 newTickLower, int24 newTickUpper) = 
            checkRebalanceNeeded(key);
        
        if (needsRebalance) {
            emit RebalanceTriggered(key, newTickLower, newTickUpper);
        }
    }
    return BaseHook.afterSwap.selector;
}
```

Triggers rebalancing when:
- IL risk exceeds threshold
- Price moves outside position range
- Better opportunities detected on other chains

#### 3. IL Risk Monitoring
```solidity
struct Position {
    uint256 amount;
    int24 tickLower;
    int24 tickUpper;
    uint256 entryPrice;
    uint256 maxILRisk; // basis points
}

function checkRebalanceNeeded(PoolKey calldata key) 
    internal 
    view 
    returns (bool, int24, int24) 
{
    Position memory pos = positions[key.toId()];
    uint256 currentPrice = getCurrentPrice(key);
    uint256 ilRisk = calculateILRisk(pos.entryPrice, currentPrice);
    
    if (ilRisk > pos.maxILRisk) {
        // Calculate new range based on current volatility
        (int24 newLower, int24 newUpper) = calculateNewRange(key, currentPrice);
        return (true, newLower, newUpper);
    }
    return (false, 0, 0);
}
```

### Hook Permissions

| Hook | Permission | Purpose |
|------|------------|---------|
| `beforeSwap` | No | Price discovery only |
| `afterSwap` | Yes | Rebalancing checks, fee distribution |
| `beforeAddLiquidity` | Yes | Validate agent authorization |
| `afterAddLiquidity` | Yes | Track position entry price |
| `beforeRemoveLiquidity` | Yes | Validate IL risk before exit |
| `afterRemoveLiquidity` | Yes | Performance fee calculation |

### Security Considerations

1. **OnlyPoolManager:** All hook callbacks enforce `onlyPoolManager`
2. **Authorized Agents:** Only registered agents can trigger rebalancing
3. **Reentrancy Protection:** Uses OpenZeppelin's ReentrancyGuard
4. **Fee Bounds:** Dynamic fees capped at 1% maximum
5. **Slippage Protection:** Rebalancing includes maximum slippage checks

---

## LiquidMindCoordinator

### Purpose
Central coordination hub that receives CCIP messages from Chainlink CRE workflows and routes them to appropriate chain-specific hooks.

### Key Functions

#### 1. Intent Registration
```solidity
struct Intent {
    address user;
    uint256 amount;
    address token;
    uint256 maxILRisk;
    bytes32 status; // PENDING, EXECUTED, FAILED
    uint256 timestamp;
}

mapping(bytes32 => Intent) public intents;

function registerIntent(
    uint256 amount,
    address token,
    uint256 maxILRisk
) external returns (bytes32 intentId) {
    intentId = keccak256(abi.encodePacked(msg.sender, block.timestamp, amount));
    intents[intentId] = Intent({
        user: msg.sender,
        amount: amount,
        token: token,
        maxILRisk: maxILRisk,
        status: PENDING,
        timestamp: block.timestamp
    });
    emit IntentRegistered(intentId, msg.sender, amount);
}
```

#### 2. CCIP Message Handling
```solidity
function _ccipReceive(Client.Any2EVMMessage memory any2EvmMessage) internal override {
    bytes32 intentId = abi.decode(any2EvmMessage.data, (bytes32));
    Allocation[] memory allocations = abi.decode(any2EvmMessage.data[32:], (Allocation[]));
    
    require(intents[intentId].status == PENDING, "Intent not pending");
    require(verifyCRESignature(intentId, allocations), "Invalid CRE signature");
    
    // Execute allocations on local chain
    for (uint i = 0; i < allocations.length; i++) {
        if (allocations[i].chainSelector == LOCAL_CHAIN_SELECTOR) {
            executeLocalAllocation(intentId, allocations[i]);
        }
    }
    
    intents[intentId].status = EXECUTED;
    emit IntentExecuted(intentId);
}
```

#### 3. x402 Payment Integration
```solidity
function lockPayment(bytes32 intentId, uint256 amount) external {
    require(intents[intentId].user == msg.sender, "Not intent owner");
    require(x402Escrow.lock(msg.sender, amount, address(this)), "Lock failed");
    emit PaymentLocked(intentId, amount);
}

function releasePayment(bytes32 intentId, bytes calldata proof) external {
    require(verifyExecutionProof(intentId, proof), "Invalid proof");
    uint256 amount = x402Escrow.getLockedAmount(intentId);
    x402Escrow.release(intentId, AGENT_TREASURY, amount);
    emit PaymentReleased(intentId, amount);
}
```

### Access Control

| Role | Permissions |
|------|-------------|
| **CRE Oracle** | Execute cross-chain allocations |
| **Agent Treasury** | Receive performance fees |
| **Intent Owner** | Register intents, cancel pending |
| **Governance** | Add/remove authorized agents |

---

## Deployment Architecture

### Testnet Deployment (Base Sepolia)

```
Phase 1: Core Contracts
├── AgenticLiquidityHook
├── LiquidMindCoordinator
└── MockA2ACoordinator (for testing)

Phase 2: Integration
├── CCIP Router integration
├── x402 Payment Gateway
└── Chainlink Price Feed consumers

Phase 3: Frontend
└── Next.js app with RainbowKit
```

### Deployment Script

```solidity
// script/Deploy.s.sol
contract Deploy is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy hook
        AgenticLiquidityHook hook = new AgenticLiquidityHook(
            IPoolManager(POOL_MANAGER),
            address(a2aCoordinator)
        );
        
        // Deploy coordinator
        LiquidMindCoordinator coordinator = new LiquidMindCoordinator(
            CCIP_ROUTER,
            X402_ESCROW
        );
        
        // Setup permissions
        coordinator.addCREOracle(CRE_WORKFLOW_ADDRESS);
        hook.setCoordinator(address(coordinator));
        
        vm.stopBroadcast();
    }
}
```

---

## Testing Strategy

### Unit Tests
- Hook callback behavior
- Fee calculation accuracy
- IL risk math
- Access control enforcement

### Integration Tests
- CCIP message routing
- x402 payment flows
- Cross-chain rebalancing
- CRE workflow end-to-end

### Invariant Tests
- Total liquidity conservation
- Fee bounds enforcement
- Rebalancing threshold accuracy

---

## Gas Optimization

| Operation | Gas Cost | Optimization |
|-----------|----------|--------------|
| `afterSwap` | ~45,000 | Cache storage reads |
| `rebalance` | ~120,000 | Batch position updates |
| `ccipReceive` | ~80,000 | Minimize calldata |

---

## Future Enhancements

1. **Multi-Hook Strategies:** Combine multiple hooks for complex strategies
2. **Flash Loan Integration:** Rebalance with flash loans for gas efficiency
3. **MEV Protection:** Integrate with MEV-resistant routers
4. **Governance:** DAO control over agent parameters

---

*Last updated: February 18, 2026*