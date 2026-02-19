// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {BaseHook} from "./base/BaseHook.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "v4-core/src/types/PoolId.sol";
import {BalanceDelta} from "v4-core/src/types/BalanceDelta.sol";
import {BeforeSwapDelta, BeforeSwapDeltaLibrary} from "v4-core/src/types/BeforeSwapDelta.sol";
import {ModifyLiquidityParams, SwapParams} from "v4-core/src/types/PoolOperation.sol";

/**
 * @title AgenticLiquidityHook
 * @notice Uniswap V4 hook for AI-driven liquidity management
 */
contract AgenticLiquidityHook is BaseHook {
    using PoolIdLibrary for PoolKey;

    error UnauthorizedCaller();
    error InvalidPool();
    
    event LiquidityRebalanced(PoolId indexed poolId, int24 newTickLower, int24 newTickUpper);
    event FeeUpdated(PoolId indexed poolId, uint24 newFee);
    event AgentActionExecuted(bytes32 indexed actionId, string actionType, uint256 timestamp);
    event CrossChainSignalReceived(uint256 indexed sourceChainId, bytes32 indexed signalId, bytes data);

    struct PoolConfig {
        uint24 baseFee;
        uint24 maxFee;
        uint24 minFee;
        uint256 rebalanceThreshold;
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

    mapping(PoolId => PoolConfig) public poolConfigs;
    mapping(PoolId => LiquidityPosition) public activePositions;
    mapping(bytes32 => bool) public executedActions;
    
    address public owner;
    address public agentCoordinator;
    
    uint24 public constant DEFAULT_FEE = 3000;

    modifier onlyOwner() {
        require(msg.sender == owner, UnauthorizedCaller());
        _;
    }

    modifier onlyCoordinator() {
        require(msg.sender == agentCoordinator, UnauthorizedCaller());
        _;
    }

    constructor(IPoolManager _poolManager, address _owner) BaseHook(_poolManager) {
        owner = _owner;
    }

    function afterInitialize(
        address sender,
        PoolKey calldata key,
        uint160 sqrtPriceX96,
        int24 tick
    ) external override onlyPoolManager returns (bytes4) {
        PoolId poolId = key.toId();
        if (poolConfigs[poolId].baseFee == 0) {
            poolConfigs[poolId] = PoolConfig({
                baseFee: DEFAULT_FEE,
                maxFee: 10000,
                minFee: 100,
                rebalanceThreshold: 500,
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
        SwapParams calldata params,
        bytes calldata hookData
    ) external override onlyPoolManager returns (bytes4, BeforeSwapDelta, uint24) {
        PoolId poolId = key.toId();
        PoolConfig memory config = poolConfigs[poolId];
        uint24 dynamicFee = _calculateDynamicFee(poolId, config);
        return (this.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, dynamicFee);
    }

    function afterSwap(
        address sender,
        PoolKey calldata key,
        SwapParams calldata params,
        BalanceDelta delta,
        bytes calldata hookData
    ) external override onlyPoolManager returns (bytes4, int128) {
        PoolId poolId = key.toId();
        if (_shouldRebalance(poolId)) {
            emit LiquidityRebalanced(poolId, 0, 0);
        }
        return (this.afterSwap.selector, 0);
    }

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
        (PoolKey memory key, bytes memory actionData) = abi.decode(data, (PoolKey, bytes));
        _processCrossChainSignal(sourceChainId, key, actionData);
    }

    function _calculateDynamicFee(PoolId poolId, PoolConfig memory config) internal view returns (uint24) {
        return config.baseFee;
    }

    function _shouldRebalance(PoolId poolId) internal view returns (bool) {
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
        // Cross-chain liquidity mirroring logic
    }

    function setAgentCoordinator(address _coordinator) external onlyOwner {
        agentCoordinator = _coordinator;
    }

    function setPoolConfig(PoolId poolId, PoolConfig calldata config) external onlyOwner {
        poolConfigs[poolId] = config;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        owner = newOwner;
    }

    function getPoolConfig(PoolId poolId) external view returns (PoolConfig memory) {
        return poolConfigs[poolId];
    }

    function getPosition(PoolId poolId) external view returns (LiquidityPosition memory) {
        return activePositions[poolId];
    }
}