// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test, console2} from "forge-std/Test.sol";
import {AgenticLiquidityHook} from "../src/AgenticLiquidityHook.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "v4-core/src/types/PoolId.sol";
import {Currency} from "v4-core/src/types/Currency.sol";
import {Hooks} from "v4-core/src/libraries/Hooks.sol";
import {TickMath} from "v4-core/src/libraries/TickMath.sol";
import {Deployers} from "v4-core/test/utils/Deployers.sol";
import {MockERC20} from "solmate/src/test/utils/mocks/MockERC20.sol";
import {IHooks} from "v4-core/src/interfaces/IHooks.sol";

contract AgenticLiquidityHookTest is Test, Deployers {
    using PoolIdLibrary for PoolKey;

    event DefenseStateTransitioned(PoolId indexed poolId, uint8 previousState, uint8 newState);
    event RegimeChanged(PoolId indexed poolId, uint8 oldRegime, uint8 newRegime, uint256 ema);

    AgenticLiquidityHook public hook;
    MockERC20 public token0;
    MockERC20 public token1;
    PoolKey public poolKey;

    address public owner;
    address public agent;

    // sqrt(1) * 2^96 — price = 1:1


    function setUp() public {
        deployFreshManagerAndRouters();

        token0 = new MockERC20("Test Token 0", "TKN0", 18);
        token1 = new MockERC20("Test Token 1", "TKN1", 18);

        if (address(token0) > address(token1)) {
            (token0, token1) = (token1, token0);
        }

        owner = address(this);
        agent = makeAddr("agent");

        // Hook flags: AFTER_INITIALIZE | BEFORE_ADD_LIQUIDITY | BEFORE_SWAP | AFTER_SWAP
        uint160 flags = uint160(
            Hooks.AFTER_INITIALIZE_FLAG  |
            Hooks.BEFORE_ADD_LIQUIDITY_FLAG |
            Hooks.BEFORE_SWAP_FLAG       |
            Hooks.AFTER_SWAP_FLAG
        );
        address hookAddr = address(flags);

        AgenticLiquidityHook hookImpl = new AgenticLiquidityHook(manager, address(this));
        vm.etch(hookAddr, address(hookImpl).code);
        hook = AgenticLiquidityHook(hookAddr);

        // owner is at storage slot index matching declaration order
        // Slots 0-4: poolConfigs, activePositions, executedActions, volatilityEMA, lastTick
        // Slots 5: currentTick, 6: owner
        // Use label search: find owner slot by brute force or just set all candidate slots
        vm.store(hookAddr, bytes32(uint256(6)), bytes32(uint256(uint160(address(this)))));

        poolKey = PoolKey({
            currency0: Currency.wrap(address(token0)),
            currency1: Currency.wrap(address(token1)),
            fee: 3000,
            tickSpacing: 60,
            hooks: IHooks(hookAddr)
        });

        manager.initialize(poolKey, SQRT_PRICE_1_1); // from Deployers
    }

    // ============ Basic State Tests ============

    function test_SetAgentCoordinator() public {
        address coordinator = makeAddr("coordinator");
        hook.setAgentCoordinator(coordinator);
        assertEq(hook.agentCoordinator(), coordinator);
    }

    function test_SetAgentCoordinator_RevertIfNotOwner() public {
        vm.prank(agent);
        vm.expectRevert();
        hook.setAgentCoordinator(makeAddr("coordinator"));
    }

    function test_SetPoolConfig() public {
        PoolId poolId = poolKey.toId();
        AgenticLiquidityHook.PoolConfig memory config = AgenticLiquidityHook.PoolConfig({
            baseFee:            3000,
            maxFee:             10000,
            minFee:             100,
            rebalanceThreshold: 300,
            autoRebalance:      true,
            agentOnlyLPs:       false
        });
        hook.setPoolConfig(poolId, config);
        AgenticLiquidityHook.PoolConfig memory stored = hook.getPoolConfig(poolId);
        assertEq(stored.baseFee, 3000);
        assertEq(stored.maxFee, 10000);
        assertEq(stored.minFee, 100);
        assertEq(stored.rebalanceThreshold, 300);
    }

    function test_TransferOwnership() public {
        address newOwner = makeAddr("newOwner");
        hook.transferOwnership(newOwner);
        assertEq(hook.owner(), newOwner);
    }

    // ============ After Initialize Tests ============

    function test_PoolConfigSeededOnInitialize() public view {
        PoolId poolId = poolKey.toId();
        AgenticLiquidityHook.PoolConfig memory config = hook.getPoolConfig(poolId);
        assertEq(config.baseFee, hook.DEFAULT_BASE_FEE());
        assertEq(config.maxFee, hook.DEFAULT_MAX_FEE());
        assertEq(config.minFee, hook.DEFAULT_MIN_FEE());
        assertTrue(config.autoRebalance);
        assertFalse(config.agentOnlyLPs);
    }

    function test_ActivePositionSeededOnInitialize() public view {
        PoolId poolId = poolKey.toId();
        AgenticLiquidityHook.LiquidityPosition memory pos = hook.getPosition(poolId);
        // Position should be seeded (lower < upper)
        assertLt(pos.tickLower, pos.tickUpper);
        assertGt(pos.lastRebalance, 0);
    }

    function test_TickSnappedToSpacing() public view {
        PoolId poolId = poolKey.toId();
        AgenticLiquidityHook.LiquidityPosition memory pos = hook.getPosition(poolId);
        assertEq(pos.tickLower % 60, 0, "lower tick not snapped");
        assertEq(pos.tickUpper % 60, 0, "upper tick not snapped");
    }

    function test_DefenseStateDefaultsToNormalOnInitialize() public view {
        PoolId poolId = poolKey.toId();
        assertEq(
            uint8(hook.getDefenseState(poolId)),
            uint8(AgenticLiquidityHook.DefenseState.NORMAL)
        );
    }

    function test_GetDefenseState_RevertIfPoolUninitialized() public {
        PoolId uninitializedPoolId = PoolId.wrap(bytes32(uint256(999)));
        vm.expectRevert(
            abi.encodeWithSelector(AgenticLiquidityHook.PoolNotInitialized.selector, uninitializedPoolId)
        );
        hook.getDefenseState(uninitializedPoolId);
    }

    function test_TransitionDefenseState_AllowsValidPath() public {
        PoolId poolId = poolKey.toId();

        hook.transitionDefenseState(poolId, AgenticLiquidityHook.DefenseState.WARNING);
        assertEq(uint8(hook.getDefenseState(poolId)), uint8(AgenticLiquidityHook.DefenseState.WARNING));

        hook.transitionDefenseState(poolId, AgenticLiquidityHook.DefenseState.DEFENSE);
        assertEq(uint8(hook.getDefenseState(poolId)), uint8(AgenticLiquidityHook.DefenseState.DEFENSE));

        hook.transitionDefenseState(poolId, AgenticLiquidityHook.DefenseState.RECOVERY);
        assertEq(uint8(hook.getDefenseState(poolId)), uint8(AgenticLiquidityHook.DefenseState.RECOVERY));

        hook.transitionDefenseState(poolId, AgenticLiquidityHook.DefenseState.NORMAL);
        assertEq(uint8(hook.getDefenseState(poolId)), uint8(AgenticLiquidityHook.DefenseState.NORMAL));
    }

    function test_TransitionDefenseState_RevertOnInvalidTransition() public {
        PoolId poolId = poolKey.toId();
        vm.expectRevert(
            abi.encodeWithSelector(
                AgenticLiquidityHook.InvalidDefenseStateTransition.selector,
                AgenticLiquidityHook.DefenseState.NORMAL,
                AgenticLiquidityHook.DefenseState.DEFENSE
            )
        );
        hook.transitionDefenseState(poolId, AgenticLiquidityHook.DefenseState.DEFENSE);
    }

    function test_TransitionDefenseState_EmitsEventOnSuccess() public {
        PoolId poolId = poolKey.toId();
        vm.expectEmit(true, false, false, true);
        emit DefenseStateTransitioned(
            poolId,
            uint8(AgenticLiquidityHook.DefenseState.NORMAL),
            uint8(AgenticLiquidityHook.DefenseState.WARNING)
        );
        hook.transitionDefenseState(poolId, AgenticLiquidityHook.DefenseState.WARNING);
    }

    function test_DefenseStateAPIsRemainValidAfterZeroBaseFeeConfigUpdate() public {
        PoolId poolId = poolKey.toId();
        hook.setPoolConfig(
            poolId,
            AgenticLiquidityHook.PoolConfig({
                baseFee: 0,
                maxFee: 10000,
                minFee: 100,
                rebalanceThreshold: 200,
                autoRebalance: true,
                agentOnlyLPs: false
            })
        );

        assertEq(uint8(hook.getDefenseState(poolId)), uint8(AgenticLiquidityHook.DefenseState.NORMAL));

        hook.transitionDefenseState(poolId, AgenticLiquidityHook.DefenseState.WARNING);
        assertEq(uint8(hook.getDefenseState(poolId)), uint8(AgenticLiquidityHook.DefenseState.WARNING));
    }

    // ============ Dynamic Fee Tests ============

    function test_DynamicFeeReturnsBaseFeeWhenNoSwaps() public view {
        PoolId poolId = poolKey.toId();
        uint24 fee = hook.getCurrentDynamicFee(poolId);
        assertEq(fee, hook.DEFAULT_BASE_FEE(), "should be base fee before any swaps");
    }

    function test_VolatilityEMAStartsAtZero() public view {
        PoolId poolId = poolKey.toId();
        assertEq(hook.volatilityEMA(poolId), 0);
        assertEq(hook.getVolatilityAvgTicks(poolId), 0);
    }

    // ============ Position Rebalance Tests ============

    function test_NeedsRebalanceReturnsFalseAtInit() public view {
        // Right after init the tick should be centered in the seeded range
        PoolId poolId = poolKey.toId();
        // currentTick is 0 (price=1:1), seeded range is -600 to +600
        // threshold is 200 ticks from edge, so needsRebalance is false at center
        // -600 + 200 = -400 and 600 - 200 = 400, tick=0 is between them
        assertFalse(hook.needsRebalance(poolId));
    }

    // ============ Agent-Only LP Tests ============

    function test_SetAgentOnlyMode() public {
        PoolId poolId = poolKey.toId();
        hook.setAgentOnlyMode(poolId, true);
        AgenticLiquidityHook.PoolConfig memory config = hook.getPoolConfig(poolId);
        assertTrue(config.agentOnlyLPs);
    }

    function test_SetAgentOnlyMode_RevertIfNotOwner() public {
        PoolId poolId = poolKey.toId();
        vm.prank(agent);
        vm.expectRevert();
        hook.setAgentOnlyMode(poolId, true);
    }

    // ============ executeAgentAction Tests ============

    function test_ExecuteRebalance_RevertIfNotCoordinator() public {
        PoolId poolId = poolKey.toId();
        bytes memory encodedKey = abi.encode(poolKey);
        bytes memory actionData = abi.encode(int24(-1200), int24(1200));
        vm.expectRevert();
        hook.executeAgentAction(bytes32(uint256(1)), "rebalance", encodedKey, actionData);
    }

    function test_ExecuteRebalance_UpdatesPosition() public {
        // Set coordinator to this contract so we can call it
        hook.setAgentCoordinator(address(this));

        PoolId poolId = poolKey.toId();
        bytes32 actionId  = bytes32(uint256(42));
        bytes memory encodedKey  = abi.encode(poolKey);
        bytes memory actionData  = abi.encode(int24(-1200), int24(1200));

        bool success = hook.executeAgentAction(actionId, "rebalance", encodedKey, actionData);
        assertTrue(success);

        AgenticLiquidityHook.LiquidityPosition memory pos = hook.getPosition(poolId);
        assertEq(pos.tickLower, -1200);
        assertEq(pos.tickUpper, 1200);
    }

    function test_ExecuteRebalance_InvalidRangeReverts() public {
        hook.setAgentCoordinator(address(this));
        bytes memory encodedKey = abi.encode(poolKey);
        bytes memory actionData = abi.encode(int24(1200), int24(-1200)); // reversed
        vm.expectRevert();
        hook.executeAgentAction(bytes32(uint256(99)), "rebalance", encodedKey, actionData);
    }

    function test_ExecuteRebalance_DuplicateActionReverts() public {
        hook.setAgentCoordinator(address(this));
        bytes32 actionId  = bytes32(uint256(55));
        bytes memory encodedKey  = abi.encode(poolKey);
        bytes memory actionData  = abi.encode(int24(-600), int24(600));

        hook.executeAgentAction(actionId, "rebalance", encodedKey, actionData);

        vm.expectRevert();
        hook.executeAgentAction(actionId, "rebalance", encodedKey, actionData);
    }

    function test_ExecuteFeeUpdate() public {
        hook.setAgentCoordinator(address(this));
        PoolId poolId = poolKey.toId();

        // Set known fee range
        hook.setPoolConfig(poolId, AgenticLiquidityHook.PoolConfig({
            baseFee:            3000,
            maxFee:             10000,
            minFee:             100,
            rebalanceThreshold: 200,
            autoRebalance:      true,
            agentOnlyLPs:       false
        }));

        bytes memory encodedKey = abi.encode(poolKey);
        bytes memory actionData = abi.encode(uint24(5000));

        bool success = hook.executeAgentAction(bytes32(uint256(1)), "updateFee", encodedKey, actionData);
        assertTrue(success);
        assertEq(hook.getPoolConfig(poolId).baseFee, 5000);
    }

    function test_ExecuteFeeUpdate_OutOfBoundsReverts() public {
        hook.setAgentCoordinator(address(this));
        bytes memory encodedKey = abi.encode(poolKey);
        bytes memory actionData = abi.encode(uint24(50000)); // > maxFee
        vm.expectRevert();
        hook.executeAgentAction(bytes32(uint256(2)), "updateFee", encodedKey, actionData);
    }

    function test_ExecuteSetAgentOnly() public {
        hook.setAgentCoordinator(address(this));
        PoolId poolId = poolKey.toId();

        bytes memory encodedKey = abi.encode(poolKey);
        bytes memory actionData = abi.encode(true);

        bool success = hook.executeAgentAction(bytes32(uint256(3)), "setAgentOnly", encodedKey, actionData);
        assertTrue(success);
        assertTrue(hook.getPoolConfig(poolId).agentOnlyLPs);
    }

    // ============ Volatility Regime Tests ============

    function test_Regime_DoesNotOscillateAtBoundary() public {
        PoolId poolId = poolKey.toId();

        _setVolatilityEmaTicks(poolId, 1);
        hook.refreshVolatilityRegime(poolId);
        _setVolatilityEmaTicks(poolId, 1);
        hook.refreshVolatilityRegime(poolId);
        assertEq(
            uint8(hook.getVolatilityRegime(poolId)),
            uint8(AgenticLiquidityHook.VolatilityRegime.LOW)
        );

        _setVolatilityEmaTicks(poolId, 6);
        hook.refreshVolatilityRegime(poolId);
        _setVolatilityEmaTicks(poolId, 5);
        hook.refreshVolatilityRegime(poolId);
        _setVolatilityEmaTicks(poolId, 6);
        hook.refreshVolatilityRegime(poolId);
        _setVolatilityEmaTicks(poolId, 5);
        hook.refreshVolatilityRegime(poolId);

        assertEq(
            uint8(hook.getVolatilityRegime(poolId)),
            uint8(AgenticLiquidityHook.VolatilityRegime.LOW)
        );
    }

    function test_Regime_RequiresQualifyingUpdates() public {
        PoolId poolId = poolKey.toId();

        _setVolatilityEmaTicks(poolId, 100);
        hook.refreshVolatilityRegime(poolId);
        assertEq(
            uint8(hook.getVolatilityRegime(poolId)),
            uint8(AgenticLiquidityHook.VolatilityRegime.NORMAL)
        );

        vm.expectEmit(true, false, false, true);
        emit RegimeChanged(
            poolId,
            uint8(AgenticLiquidityHook.VolatilityRegime.NORMAL),
            uint8(AgenticLiquidityHook.VolatilityRegime.HIGH),
            100_000
        );
        hook.refreshVolatilityRegime(poolId);
        assertEq(
            uint8(hook.getVolatilityRegime(poolId)),
            uint8(AgenticLiquidityHook.VolatilityRegime.HIGH)
        );
    }

    function test_Regime_ThresholdPlusMarginTransitionsImmediately() public {
        PoolId poolId = poolKey.toId();
        _setVolatilityEmaTicks(poolId, 102);

        vm.expectEmit(true, false, false, true);
        emit RegimeChanged(
            poolId,
            uint8(AgenticLiquidityHook.VolatilityRegime.NORMAL),
            uint8(AgenticLiquidityHook.VolatilityRegime.HIGH),
            102_000
        );
        hook.refreshVolatilityRegime(poolId);

        assertEq(
            uint8(hook.getVolatilityRegime(poolId)),
            uint8(AgenticLiquidityHook.VolatilityRegime.HIGH)
        );
    }

    function test_Regime_ThresholdMinusMarginTransitionsImmediatelyOnLowSide() public {
        PoolId poolId = poolKey.toId();
        _setVolatilityEmaTicks(poolId, 3);

        vm.expectEmit(true, false, false, true);
        emit RegimeChanged(
            poolId,
            uint8(AgenticLiquidityHook.VolatilityRegime.NORMAL),
            uint8(AgenticLiquidityHook.VolatilityRegime.LOW),
            3_000
        );
        hook.refreshVolatilityRegime(poolId);

        assertEq(
            uint8(hook.getVolatilityRegime(poolId)),
            uint8(AgenticLiquidityHook.VolatilityRegime.LOW)
        );
    }

    function test_Regime_LowToNormalRequiresHysteresisExitQualifyingUpdates() public {
        PoolId poolId = poolKey.toId();

        _setVolatilityEmaTicks(poolId, 1);
        hook.refreshVolatilityRegime(poolId);
        _setVolatilityEmaTicks(poolId, 1);
        hook.refreshVolatilityRegime(poolId);
        assertEq(
            uint8(hook.getVolatilityRegime(poolId)),
            uint8(AgenticLiquidityHook.VolatilityRegime.LOW)
        );

        _setVolatilityEmaTicks(poolId, 7);
        hook.refreshVolatilityRegime(poolId);
        assertEq(
            uint8(hook.getVolatilityRegime(poolId)),
            uint8(AgenticLiquidityHook.VolatilityRegime.LOW)
        );

        vm.expectEmit(true, false, false, true);
        emit RegimeChanged(
            poolId,
            uint8(AgenticLiquidityHook.VolatilityRegime.LOW),
            uint8(AgenticLiquidityHook.VolatilityRegime.NORMAL),
            7_000
        );
        _setVolatilityEmaTicks(poolId, 7);
        hook.refreshVolatilityRegime(poolId);
        assertEq(
            uint8(hook.getVolatilityRegime(poolId)),
            uint8(AgenticLiquidityHook.VolatilityRegime.NORMAL)
        );
    }

    function test_Regime_HighToNormalRequiresHysteresisExitQualifyingUpdates() public {
        PoolId poolId = poolKey.toId();

        _setVolatilityEmaTicks(poolId, 110);
        hook.refreshVolatilityRegime(poolId);
        _setVolatilityEmaTicks(poolId, 110);
        hook.refreshVolatilityRegime(poolId);
        assertEq(
            uint8(hook.getVolatilityRegime(poolId)),
            uint8(AgenticLiquidityHook.VolatilityRegime.HIGH)
        );

        _setVolatilityEmaTicks(poolId, 90);
        hook.refreshVolatilityRegime(poolId);
        assertEq(
            uint8(hook.getVolatilityRegime(poolId)),
            uint8(AgenticLiquidityHook.VolatilityRegime.HIGH)
        );

        vm.expectEmit(true, false, false, true);
        emit RegimeChanged(
            poolId,
            uint8(AgenticLiquidityHook.VolatilityRegime.HIGH),
            uint8(AgenticLiquidityHook.VolatilityRegime.NORMAL),
            90_000
        );
        _setVolatilityEmaTicks(poolId, 90);
        hook.refreshVolatilityRegime(poolId);
        assertEq(
            uint8(hook.getVolatilityRegime(poolId)),
            uint8(AgenticLiquidityHook.VolatilityRegime.NORMAL)
        );
    }

    function _setVolatilityEmaTicks(PoolId poolId, uint256 avgTicks) internal {
        uint256 scaled = avgTicks * 1_000;
        bytes32 slot = keccak256(abi.encode(PoolId.unwrap(poolId), uint256(3)));
        vm.store(address(hook), slot, bytes32(scaled));
    }
}
