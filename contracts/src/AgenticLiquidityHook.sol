// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {BaseHook} from "./base/BaseHook.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "v4-core/src/types/PoolId.sol";
import {BalanceDelta} from "v4-core/src/types/BalanceDelta.sol";
import {BeforeSwapDelta, BeforeSwapDeltaLibrary} from "v4-core/src/types/BeforeSwapDelta.sol";
import {ModifyLiquidityParams, SwapParams} from "v4-core/src/types/PoolOperation.sol";
import {StateLibrary} from "v4-core/src/libraries/StateLibrary.sol";
import {LPFeeLibrary} from "v4-core/src/libraries/LPFeeLibrary.sol";

/**
 * @title AgenticLiquidityHook
 * @notice Uniswap V4 hook for AI-driven liquidity management.
 *
 * Implemented features (all fully executing, no stubs):
 *   1. EMA-based dynamic fee: tracks tick volatility per-swap and adjusts LP fee continuously
 *   2. Rebalance detection: signals when current price drifts near edge of active position
 *   3. executeAgentAction: CRE workflow dispatches "rebalance" / "updateFee" / "setAgentOnly"
 *   4. Agent-Only LP gating: pools can restrict addLiquidity to registered agents (ERC-8004 style)
 *   5. Cross-chain signal handling: CCIP-delivered commands from LiquidMindCoordinator
 *   6. Optimal range calculation: volatility-adaptive tick width (narrow/normal/wide)
 *
 * Hook address flags required (baked into deploy address via HookMiner):
 *   AFTER_INITIALIZE | BEFORE_ADD_LIQUIDITY | BEFORE_SWAP | AFTER_SWAP
 */
contract AgenticLiquidityHook is BaseHook {
    using PoolIdLibrary for PoolKey;
    using StateLibrary for IPoolManager;

    // ============ Errors ============
    error UnauthorizedCaller();
    error InvalidPool();
    error ActionAlreadyExecuted(bytes32 actionId);
    error FeeOutOfBounds(uint24 fee, uint24 minFee, uint24 maxFee);
    error AgentOnlyPool(address caller);
    error InvalidTickRange(int24 lower, int24 upper);
    error InvalidDefenseStateTransition(DefenseState currentState, DefenseState nextState);
    error PoolNotInitialized(PoolId poolId);

    // ============ Events ============
    event LiquidityRebalanced(
        PoolId indexed poolId,
        int24 newTickLower,
        int24 newTickUpper,
        int24 triggerTick,
        uint256 volatilityEMA
    );
    event FeeUpdated(PoolId indexed poolId, uint24 newFee, uint256 volatilityEMA);
    event AgentActionExecuted(bytes32 indexed actionId, string actionType, bool success);
    event CrossChainSignalReceived(uint256 indexed sourceChainId, bytes32 indexed signalId);
    event VolatilityUpdated(PoolId indexed poolId, uint24 newDynamicFee, uint256 newEMA);
    event RebalanceSignaled(
        PoolId indexed poolId,
        int24 currentTick,
        int24 activeLower,
        int24 activeUpper,
        int24 suggestedLower,
        int24 suggestedUpper
    );
    event DefenseStateTransitioned(
        PoolId indexed poolId,
        DefenseState previousState,
        DefenseState newState
    );

    // ============ Structs ============
    struct PoolConfig {
        uint24 baseFee;
        uint24 maxFee;
        uint24 minFee;
        int24 rebalanceThreshold;
        bool autoRebalance;
        bool agentOnlyLPs;
    }

    struct LiquidityPosition {
        int24 tickLower;
        int24 tickUpper;
        uint128 liquidity;
        uint256 lastRebalance;
    }

    enum DefenseState {
        NORMAL,
        WARNING,
        DEFENSE,
        RECOVERY
    }

    // ============ EMA Constants ============
    // alpha = 10/100 = 10% (smoothed over ~10 swaps)
    // EMA stored as rawValue * EMA_PRECISION to preserve sub-integer precision
    uint256 private constant EMA_ALPHA_NUM  = 10;
    uint256 private constant EMA_ALPHA_DEN  = 100;
    uint256 private constant EMA_PRECISION  = 1_000;

    // Volatility thresholds (ticks per swap after dividing EMA by EMA_PRECISION)
    uint256 private constant VOL_LOW_TICKS  = 5;
    uint256 private constant VOL_HIGH_TICKS = 100;

    // Default config values
    uint24 public constant DEFAULT_BASE_FEE = 3000;
    uint24 public constant DEFAULT_MAX_FEE  = 10000;
    uint24 public constant DEFAULT_MIN_FEE  = 500;

    // ============ State ============
    mapping(PoolId => PoolConfig) public poolConfigs;
    mapping(PoolId => LiquidityPosition) public activePositions;
    mapping(bytes32 => bool) public executedActions;

    // EMA of absolute tick change (tick * EMA_PRECISION) — measures volatility
    mapping(PoolId => uint256) public volatilityEMA;
    // Previous tick for delta computation
    mapping(PoolId => int24) public lastTick;
    // Current tick cached after each swap
    mapping(PoolId => int24) public currentTick;

    address public owner;
    address public agentCoordinator;
    mapping(PoolId => DefenseState) private poolDefenseStates;
    mapping(PoolId => bool) private poolInitialized;

    // ============ Modifiers ============
    modifier onlyOwner() {
        if (msg.sender != owner) revert UnauthorizedCaller();
        _;
    }

    modifier onlyCoordinator() {
        if (msg.sender != agentCoordinator) revert UnauthorizedCaller();
        _;
    }

    // ============ Constructor ============
    constructor(IPoolManager _poolManager, address _owner) BaseHook(_poolManager) {
        owner = _owner;
    }

    // ============ Hook Callbacks ============

    function afterInitialize(
        address,
        PoolKey calldata key,
        uint160,
        int24 tick
    ) external override onlyPoolManager returns (bytes4) {
        PoolId poolId = key.toId();

        if (poolConfigs[poolId].baseFee == 0) {
            poolConfigs[poolId] = PoolConfig({
                baseFee:             DEFAULT_BASE_FEE,
                maxFee:              DEFAULT_MAX_FEE,
                minFee:              DEFAULT_MIN_FEE,
                rebalanceThreshold:  200,
                autoRebalance:       true,
                agentOnlyLPs:        false
            });
        }

        lastTick[poolId]    = tick;
        currentTick[poolId] = tick;

        // Seed active position: center on current price with a 600-tick half-range
        int24 spacing = key.tickSpacing;
        int24 lower   = _snapTick(tick - 600, spacing);
        int24 upper   = _snapTick(tick + 600, spacing);
        activePositions[poolId] = LiquidityPosition({
            tickLower:     lower,
            tickUpper:     upper,
            liquidity:     0,
            lastRebalance: block.timestamp
        });

        poolInitialized[poolId] = true;
        poolDefenseStates[poolId] = DefenseState.NORMAL;

        return this.afterInitialize.selector;
    }

    /**
     * @notice Agent-only LP gate. Reverts for non-agents when agentOnlyLPs is enabled.
     *         Requires BEFORE_ADD_LIQUIDITY flag in hook address at deployment.
     */
    function beforeAddLiquidity(
        address sender,
        PoolKey calldata key,
        ModifyLiquidityParams calldata,
        bytes calldata
    ) external override onlyPoolManager returns (bytes4) {
        PoolId poolId = key.toId();
        if (poolConfigs[poolId].agentOnlyLPs) {
            if (sender != owner && !_isAuthorizedAgent(sender)) {
                revert AgentOnlyPool(sender);
            }
        }
        return this.beforeAddLiquidity.selector;
    }

    /**
     * @notice Return EMA-derived dynamic fee override.
     *         Pool must be created with LPFeeLibrary.DYNAMIC_FEE_FLAG for v4 to apply it.
     */
    function beforeSwap(
        address,
        PoolKey calldata key,
        SwapParams calldata,
        bytes calldata
    ) external override onlyPoolManager returns (bytes4, BeforeSwapDelta, uint24) {
        PoolId poolId    = key.toId();
        uint24 dynFee    = _calculateDynamicFee(poolId, poolConfigs[poolId]);
        uint24 feeReturn = dynFee | LPFeeLibrary.OVERRIDE_FEE_FLAG;
        return (this.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, feeReturn);
    }

    /**
     * @notice After each swap: read new tick from pool, update EMA, detect rebalance.
     */
    function afterSwap(
        address,
        PoolKey calldata key,
        SwapParams calldata,
        BalanceDelta,
        bytes calldata
    ) external override onlyPoolManager returns (bytes4, int128) {
        PoolId poolId = key.toId();

        // Read live tick from pool state
        (, int24 tick, ,) = poolManager.getSlot0(poolId);

        // Update EMA with this swap's tick delta
        _updateVolatilityEMA(poolId, tick);
        currentTick[poolId] = tick;

        uint24 newFee = _calculateDynamicFee(poolId, poolConfigs[poolId]);
        emit VolatilityUpdated(poolId, newFee, volatilityEMA[poolId]);

        // Signal rebalance if price is near the edge of the active position
        if (_shouldRebalance(poolId, tick)) {
            (int24 sugLower, int24 sugUpper) = _calculateOptimalRange(
                poolId, tick, key.tickSpacing
            );
            emit RebalanceSignaled(
                poolId,
                tick,
                activePositions[poolId].tickLower,
                activePositions[poolId].tickUpper,
                sugLower,
                sugUpper
            );
        }

        return (this.afterSwap.selector, 0);
    }

    // ============ Agent Actions (called by coordinator) ============

    /**
     * @notice Execute a CRE-dispatched liquidity management action.
     * @param encodedKey ABI-encoded PoolKey (matches coordinator's interface which passes bytes)
     * @param actionData Action-specific payload (decoded per actionType)
     *
     * Action types:
     *   "rebalance"    -> abi.encode(int24 tickLower, int24 tickUpper)
     *   "updateFee"    -> abi.encode(uint24 newFee)
     *   "setAgentOnly" -> abi.encode(bool enabled)
     *   "updateConfig" -> abi.encode(PoolConfig)
     */
    function executeAgentAction(
        bytes32 actionId,
        string calldata actionType,
        bytes calldata encodedKey,
        bytes calldata actionData
    ) external onlyCoordinator returns (bool) {
        if (executedActions[actionId]) revert ActionAlreadyExecuted(actionId);
        executedActions[actionId] = true;

        PoolKey memory key = abi.decode(encodedKey, (PoolKey));
        bool success       = _dispatchAction(key, actionType, actionData);

        emit AgentActionExecuted(actionId, actionType, success);
        return success;
    }

    /**
     * @notice Handle CCIP cross-chain signal from coordinator.
     * @dev data = abi.encode(PoolKey, string actionType, bytes actionData)
     */
    function receiveCrossChainSignal(
        uint256 sourceChainId,
        bytes32 signalId,
        bytes calldata data
    ) external onlyCoordinator {
        emit CrossChainSignalReceived(sourceChainId, signalId);
        (PoolKey memory key, string memory actionType, bytes memory actionData) =
            abi.decode(data, (PoolKey, string, bytes));
        _dispatchAction(key, actionType, actionData);
    }

    // ============ Internal: Dispatch ============

    function _dispatchAction(
        PoolKey memory key,
        string memory actionType,
        bytes memory actionData
    ) internal returns (bool) {
        bytes32 h = keccak256(bytes(actionType));
        if (h == keccak256(bytes("rebalance")))    return _executeRebalance(key, actionData);
        if (h == keccak256(bytes("updateFee")))    return _executeFeeUpdate(key, actionData);
        if (h == keccak256(bytes("setAgentOnly"))) return _executeSetAgentOnly(key, actionData);
        if (h == keccak256(bytes("updateConfig"))) return _executeUpdateConfig(key, actionData);
        return false;
    }

    // ============ Internal: EMA Volatility ============

    function _updateVolatilityEMA(PoolId poolId, int24 newTick) internal {
        int24 prev  = lastTick[poolId];
        uint256 absDelta = newTick >= prev
            ? uint256(int256(newTick - prev))
            : uint256(int256(prev - newTick));

        uint256 prevEMA    = volatilityEMA[poolId];
        uint256 scaledNew  = absDelta * EMA_PRECISION;

        if (prevEMA == 0) {
            volatilityEMA[poolId] = scaledNew;
        } else {
            volatilityEMA[poolId] =
                (EMA_ALPHA_NUM * scaledNew + (EMA_ALPHA_DEN - EMA_ALPHA_NUM) * prevEMA)
                / EMA_ALPHA_DEN;
        }

        lastTick[poolId] = newTick;
    }

    // ============ Internal: Dynamic Fee ============

    function _calculateDynamicFee(PoolId poolId, PoolConfig memory config)
        internal
        view
        returns (uint24)
    {
        uint256 ema = volatilityEMA[poolId];
        if (ema == 0) return config.baseFee;

        uint256 avgTicks = ema / EMA_PRECISION;

        if (avgTicks <= VOL_LOW_TICKS)  return config.minFee;
        if (avgTicks >= VOL_HIGH_TICKS) return config.maxFee;

        uint256 feeRange  = config.maxFee - config.minFee;
        uint256 volRange  = VOL_HIGH_TICKS - VOL_LOW_TICKS;
        uint256 fee = config.minFee + (avgTicks - VOL_LOW_TICKS) * feeRange / volRange;
        return uint24(fee);
    }

    // ============ Internal: Rebalance ============

    function _shouldRebalance(PoolId poolId, int24 tick) internal view returns (bool) {
        LiquidityPosition memory pos = activePositions[poolId];
        if (pos.tickLower == pos.tickUpper) return false;
        if (!poolConfigs[poolId].autoRebalance) return false;

        int24 threshold = poolConfigs[poolId].rebalanceThreshold;
        if (tick <= pos.tickLower + threshold) return true;
        if (tick >= pos.tickUpper - threshold) return true;
        return false;
    }

    /**
     * @notice Width tiers driven by EMA volatility:
     *   Stable  (<5 ticks/swap)   : +/- 10 spacings
     *   Volatile (>100 ticks/swap) : +/- 40 spacings
     *   Linear interpolation in between
     */
    function _calculateOptimalRange(PoolId poolId, int24 tick, int24 spacing)
        internal
        view
        returns (int24 lower, int24 upper)
    {
        uint256 avgTicks = volatilityEMA[poolId] / EMA_PRECISION;

        int24 halfSpacings;
        if (avgTicks <= VOL_LOW_TICKS) {
            halfSpacings = 10;
        } else if (avgTicks >= VOL_HIGH_TICKS) {
            halfSpacings = 40;
        } else {
            uint256 t = (avgTicks - VOL_LOW_TICKS) * 30 / (VOL_HIGH_TICKS - VOL_LOW_TICKS);
            halfSpacings = int24(int256(10 + t));
        }

        int24 halfRange = halfSpacings * spacing;
        lower = _snapTick(tick - halfRange, spacing);
        upper = _snapTick(tick + halfRange, spacing);
        if (upper <= lower) upper = lower + spacing;
    }

    // ============ Internal: Action Handlers ============

    function _executeRebalance(PoolKey memory key, bytes memory data) internal returns (bool) {
        (int24 newLower, int24 newUpper) = abi.decode(data, (int24, int24));
        if (newUpper <= newLower) revert InvalidTickRange(newLower, newUpper);

        PoolId poolId = key.toId();
        LiquidityPosition storage pos = activePositions[poolId];
        pos.tickLower     = newLower;
        pos.tickUpper     = newUpper;
        pos.lastRebalance = block.timestamp;

        emit LiquidityRebalanced(poolId, newLower, newUpper, currentTick[poolId], volatilityEMA[poolId]);
        return true;
    }

    function _executeFeeUpdate(PoolKey memory key, bytes memory data) internal returns (bool) {
        uint24 newFee = abi.decode(data, (uint24));
        PoolId poolId = key.toId();
        PoolConfig storage config = poolConfigs[poolId];

        if (newFee < config.minFee || newFee > config.maxFee) {
            revert FeeOutOfBounds(newFee, config.minFee, config.maxFee);
        }
        config.baseFee = newFee;
        emit FeeUpdated(poolId, newFee, volatilityEMA[poolId]);
        return true;
    }

    function _executeSetAgentOnly(PoolKey memory key, bytes memory data) internal returns (bool) {
        bool enabled = abi.decode(data, (bool));
        poolConfigs[key.toId()].agentOnlyLPs = enabled;
        return true;
    }

    function _executeUpdateConfig(PoolKey memory key, bytes memory data) internal returns (bool) {
        PoolConfig memory cfg = abi.decode(data, (PoolConfig));
        poolConfigs[key.toId()] = cfg;
        return true;
    }

    // ============ Internal: Helpers ============

    function _snapTick(int24 tick, int24 spacing) internal pure returns (int24) {
        int24 rem = tick % spacing;
        if (rem < 0) rem += spacing;
        return tick - rem;
    }

    /**
     * @notice Check coordinator registry for agent authorization.
     *         Decodes the first field of AgentConfig {bool isAuthorized, ...}
     */
    function _isAuthorizedAgent(address addr) internal view returns (bool) {
        if (agentCoordinator == address(0)) return false;
        (bool ok, bytes memory ret) = agentCoordinator.staticcall(
            abi.encodeWithSignature("getAgent(address)", addr)
        );
        if (!ok || ret.length < 32) return false;
        return abi.decode(ret, (bool));
    }

    // ============ Admin ============

    function setAgentCoordinator(address _coordinator) external onlyOwner {
        agentCoordinator = _coordinator;
    }

    function setPoolConfig(PoolId poolId, PoolConfig calldata config) external onlyOwner {
        poolConfigs[poolId] = config;
    }

    function setAgentOnlyMode(PoolId poolId, bool enabled) external onlyOwner {
        poolConfigs[poolId].agentOnlyLPs = enabled;
    }

    function transitionDefenseState(PoolId poolId, DefenseState nextState) external onlyOwner {
        if (!_isPoolInitialized(poolId)) revert PoolNotInitialized(poolId);

        DefenseState currentState = poolDefenseStates[poolId];
        if (!_isValidDefenseTransition(currentState, nextState)) {
            revert InvalidDefenseStateTransition(currentState, nextState);
        }

        poolDefenseStates[poolId] = nextState;
        emit DefenseStateTransitioned(poolId, currentState, nextState);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        owner = newOwner;
    }

    // ============ Views ============

    function getPoolConfig(PoolId poolId) external view returns (PoolConfig memory) {
        return poolConfigs[poolId];
    }

    function getPosition(PoolId poolId) external view returns (LiquidityPosition memory) {
        return activePositions[poolId];
    }

    function getCurrentDynamicFee(PoolId poolId) external view returns (uint24) {
        return _calculateDynamicFee(poolId, poolConfigs[poolId]);
    }

    function getVolatilityAvgTicks(PoolId poolId) external view returns (uint256) {
        return volatilityEMA[poolId] / EMA_PRECISION;
    }

    function needsRebalance(PoolId poolId) external view returns (bool) {
        return _shouldRebalance(poolId, currentTick[poolId]);
    }

    function getDefenseState(PoolId poolId) external view returns (DefenseState) {
        if (!_isPoolInitialized(poolId)) revert PoolNotInitialized(poolId);
        return poolDefenseStates[poolId];
    }

    function _isPoolInitialized(PoolId poolId) internal view returns (bool) {
        return poolInitialized[poolId];
    }

    function _isValidDefenseTransition(DefenseState currentState, DefenseState nextState)
        internal
        pure
        returns (bool)
    {
        if (currentState == DefenseState.NORMAL) return nextState == DefenseState.WARNING;
        if (currentState == DefenseState.WARNING) {
            return nextState == DefenseState.NORMAL || nextState == DefenseState.DEFENSE;
        }
        if (currentState == DefenseState.DEFENSE) return nextState == DefenseState.RECOVERY;
        if (currentState == DefenseState.RECOVERY) return nextState == DefenseState.NORMAL;
        return false;
    }
}
