// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {BaseHook} from "v4-periphery/src/base/hooks/BaseHook.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {Hooks} from "v4-core/src/libraries/Hooks.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "v4-core/src/types/PoolId.sol";
import {BalanceDelta} from "v4-core/src/types/BalanceDelta.sol";
import {BeforeSwapDelta, BeforeSwapDeltaLibrary} from "v4-core/src/types/BeforeSwapDelta.sol";
import {LPFeeLibrary} from "v4-core/src/libraries/LPFeeLibrary.sol";
import {TickMath} from "v4-core/src/libraries/TickMath.sol";

/**
 * @title AgenticLiquidityHook
 * @notice Uniswap V4 hook for AI-driven liquidity management
 * @dev Integrates with LiquidMindCoordinator for cross-chain agent coordination
 */
contract AgenticLiquidityHook is BaseHook {
    using PoolIdLibrary for PoolKey;
    using LPFeeLibrary for uint24;

    // ============ Errors ============
    error UnauthorizedCaller();
    error InvalidPool();
    error RebalanceThresholdTooHigh();
    error InvalidTickRange();

    // ============ Events ============
    event LiquidityRebalanced(PoolId indexed poolId, int24 newTickLower, int24 newTickUpper);
    event FeeUpdated(PoolId indexed poolId, uint24 newFee);
    event AgentActionExecuted(bytes32 indexed actionId, string actionType, uint256 timestamp);
    event CrossChainSignalReceived(uint256 indexed sourceChainId, bytes32 indexed signalId, bytes data);

    // ============ Structs ============
    struct PoolConfig {
        uint24 baseFee;
        uint24 maxFee;
        uint24 minFee;
        uint256 rebalanceThreshold; // Basis points (e.g., 500 = 5%)
        int24 tickSpacing;
        bool autoRebalance;
        address agentCoordinator;
    }

    struct LiquidityPosition {
        int24 tickLower;
        int24 tickUpper;
        uint128 liquidity;
        uint256 lastRebalance;
    }

    // ============ State Variables ============
    mapping(PoolId => PoolConfig) public poolConfigs;
    mapping(PoolId => LiquidityPosition) public activePositions;
    mapping(bytes32 => bool) public executedActions;
    
    address public owner;
    address public agentCoordinator;
    
    uint24 public constant DEFAULT_FEE = 3000; // 0.3%
    uint24 public constant FEE_DENOMINATOR = 1000000;
    int24 public constant MAX_TICK_RANGE = 887272;

    // ============ Modifiers ============
    modifier onlyOwner() {
        require(msg.sender == owner, UnauthorizedCaller());
        _;
    }

    modifier onlyCoordinator() {
        require(msg.sender == agentCoordinator, UnauthorizedCaller());
        _;
    }

    // ============ Constructor ============
    constructor(IPoolManager _poolManager) BaseHook(_poolManager) {
        owner = msg.sender;
    }

    // ============ Hook Permissions ============
    function getHookPermissions() public pure override returns (Hooks.Permissions memory) {
        return Hooks.Permissions({
            beforeInitialize: false,
            afterInitialize: true,
            beforeAddLiquidity: false,
            afterAddLiquidity: false,
            beforeRemoveLiquidity: false,
            afterRemoveLiquidity: false,
            beforeSwap: true,
            afterSwap: true,
            beforeDonate: false,
            afterDonate: false,
            beforeSwapReturnDelta: false,
            afterSwapReturnDelta: false,
            afterAddLiquidityReturnDelta: false,
            afterRemoveLiquidityReturnDelta: false
        });
    }

    // ============ Hook Callbacks ============
    function afterInitialize(
        address sender,
        PoolKey calldata key,
        uint160 sqrtPriceX96,
        int24 tick
    ) external override returns (bytes4) {
        // Initialize default pool config if not set
        PoolId poolId = key.toId();
        if (poolConfigs[poolId].baseFee == 0) {
            poolConfigs[poolId] = PoolConfig({
                baseFee: DEFAULT_FEE,
                maxFee: 10000, // 1%
                minFee: 100,   // 0.01%
                rebalanceThreshold: 500, // 5%
                tickSpacing: key.tickSpacing,
                autoRebalance: true,
                agentCoordinator: agentCoordinator
            });
        }
        return this.afterInitialize.selector;
    }

    function beforeSwap(
        address sender,
        PoolKey calldata key,
        IPoolManager.SwapParams calldata params,
        bytes calldata hookData
    ) external override returns (bytes4, BeforeSwapDelta, uint24) {
        PoolId poolId = key.toId();
        PoolConfig memory config = poolConfigs[poolId];
        
        // Dynamic fee calculation based on market conditions
        uint24 dynamicFee = _calculateDynamicFee(poolId, config);
        
        return (this.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, dynamicFee);
    }

    function afterSwap(
        address sender,
        PoolKey calldata key,
        IPoolManager.SwapParams calldata params,
        BalanceDelta delta,
        bytes calldata hookData
    ) external override returns (bytes4, int128) {
        PoolId poolId = key.toId();
        
        // Check if rebalance is needed after significant swaps
        if (_shouldRebalance(poolId)) {
            emit LiquidityRebalanced(poolId, 0, 0); // Signal that rebalance is needed
        }
        
        return (this.afterSwap.selector, 0);
    }

    // ============ Agent Coordination Functions ============
    function executeAgentAction(
        bytes32 actionId,
        string calldata actionType,
        PoolKey calldata key,
        bytes calldata actionData
    ) external onlyCoordinator returns (bool) {
        require(!executedActions[actionId], "Action already executed");
        
        executedActions[actionId] = true;
        
        if (keccak256(bytes(actionType)) == keccak256(bytes("rebalance"))) {
            _executeRebalance(key, actionData);
        } else if (keccak256(bytes(actionType)) == keccak256(bytes("updateFee"))) {
            _executeFeeUpdate(key, actionData);
        }
        
        emit AgentActionExecuted(actionId, actionType, block.timestamp);
        return true;
    }

    function receiveCrossChainSignal(
        uint256 sourceChainId,
        bytes32 signalId,
        bytes calldata data
    ) external onlyCoordinator {
        emit CrossChainSignalReceived(sourceChainId, signalId, data);
        
        // Decode and execute cross-chain liquidity instructions
        (PoolKey memory key, bytes memory actionData) = abi.decode(data, (PoolKey, bytes));
        
        // Process signal (e.g., mirror liquidity position from source chain)
        _processCrossChainSignal(sourceChainId, key, actionData);
    }

    // ============ Internal Functions ============
    function _calculateDynamicFee(PoolId poolId, PoolConfig memory config) internal view returns (uint24) {
        // Placeholder: In production, use oracle data and volatility metrics
        // This would integrate with the AI agent's volatility predictions
        return config.baseFee;
    }

    function _shouldRebalance(PoolId poolId) internal view returns (bool) {
        // Placeholder: Check if current price has moved beyond threshold
        return false;
    }

    function _executeRebalance(PoolKey calldata key, bytes calldata data) internal {
        (int24 newTickLower, int24 newTickUpper) = abi.decode(data, (int24, int24));
        
        PoolId poolId = key.toId();
        LiquidityPosition storage position = activePositions[poolId];
        
        position.tickLower = newTickLower;
        position.tickUpper = newTickUpper;
        position.lastRebalance = block.timestamp;
        
        emit LiquidityRebalanced(poolId, newTickLower, newTickUpper);
    }

    function _executeFeeUpdate(PoolKey calldata key, bytes calldata data) internal {
        uint24 newFee = abi.decode(data, (uint24));
        PoolId poolId = key.toId();
        
        require(newFee >= poolConfigs[poolId].minFee && newFee <= poolConfigs[poolId].maxFee, "Fee out of bounds");
        
        poolConfigs[poolId].baseFee = newFee;
        emit FeeUpdated(poolId, newFee);
    }

    function _processCrossChainSignal(uint256 sourceChainId, PoolKey memory key, bytes memory data) internal {
        // Implement cross-chain liquidity mirroring logic
        // This allows the AI agent to maintain synchronized positions across chains
    }

    // ============ Admin Functions ============
    function setAgentCoordinator(address _coordinator) external onlyOwner {
        agentCoordinator = _coordinator;
    }

    function setPoolConfig(PoolId poolId, PoolConfig calldata config) external onlyOwner {
        poolConfigs[poolId] = config;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        owner = newOwner;
    }

    // ============ View Functions ============
    function getPoolConfig(PoolId poolId) external view returns (PoolConfig memory) {
        return poolConfigs[poolId];
    }

    function getPosition(PoolId poolId) external view returns (LiquidityPosition memory) {
        return activePositions[poolId];
    }
}
