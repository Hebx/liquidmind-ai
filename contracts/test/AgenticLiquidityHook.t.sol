// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {AgenticLiquidityHook} from "../src/AgenticLiquidityHook.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "v4-core/src/types/PoolId.sol";
import {Currency} from "v4-core/src/types/Currency.sol";
import {Hooks} from "v4-core/src/libraries/Hooks.sol";
import {Deployers} from "v4-core/test/utils/Deployers.sol";
import {MockERC20} from "solmate/test/utils/mocks/MockERC20.sol";

contract AgenticLiquidityHookTest is Test, Deployers {
    using PoolIdLibrary for PoolKey;

    AgenticLiquidityHook public hook;
    MockERC20 public token0;
    MockERC20 public token1;
    PoolKey public poolKey;
    
    address public owner;
    address public agent;

    function setUp() public {
        // Deploy PoolManager and tokens
        deployFreshManagerAndRouters();
        
        token0 = new MockERC20("Test Token 0", "TKN0", 18);
        token1 = new MockERC20("Test Token 1", "TKN1", 18);
        
        // Ensure token0 < token1
        if (address(token0) > address(token1)) {
            (token0, token1) = (token1, token0);
        }

        owner = address(this);
        agent = makeAddr("agent");

        // Deploy hook
        uint160 flags = uint160(Hooks.AFTER_INITIALIZE_FLAG | Hooks.BEFORE_SWAP_FLAG | Hooks.AFTER_SWAP_FLAG);
        deployCodeTo("AgenticLiquidityHook.sol", abi.encode(manager), address(flags));
        hook = AgenticLiquidityHook(address(flags));
        
        // Initialize pool
        poolKey = PoolKey({
            currency0: Currency.wrap(address(token0)),
            currency1: Currency.wrap(address(token1)),
            fee: 3000,
            tickSpacing: 60,
            hooks: hook
        });
        
        manager.initialize(poolKey, 79228162514264337593543950336); // sqrtPriceX96 for 1.0
    }

    function test_InitialState() public view {
        assertEq(hook.owner(), owner);
    }

    function test_SetAgentCoordinator() public {
        address coordinator = makeAddr("coordinator");
        hook.setAgentCoordinator(coordinator);
        assertEq(hook.agentCoordinator(), coordinator);
    }

    function test_SetAgentCoordinator_RevertIfNotOwner() public {
        address coordinator = makeAddr("coordinator");
        
        vm.prank(agent);
        vm.expectRevert();
        hook.setAgentCoordinator(coordinator);
    }

    function test_GetHookPermissions() public view {
        Hooks.Permissions memory permissions = hook.getHookPermissions();
        
        assertTrue(permissions.afterInitialize);
        assertTrue(permissions.beforeSwap);
        assertTrue(permissions.afterSwap);
        assertFalse(permissions.beforeInitialize);
        assertFalse(permissions.beforeAddLiquidity);
    }

    function test_SetPoolConfig() public {
        PoolId poolId = poolKey.toId();
        
        AgenticLiquidityHook.PoolConfig memory config = AgenticLiquidityHook.PoolConfig({
            baseFee: 3000,
            maxFee: 10000,
            minFee: 100,
            rebalanceThreshold: 500,
            tickSpacing: 60,
            autoRebalance: true,
            agentCoordinator: address(0)
        });
        
        hook.setPoolConfig(poolId, config);
        
        AgenticLiquidityHook.PoolConfig memory stored = hook.getPoolConfig(poolId);
        assertEq(stored.baseFee, 3000);
        assertEq(stored.maxFee, 10000);
        assertEq(stored.minFee, 100);
    }

    function test_TransferOwnership() public {
        address newOwner = makeAddr("newOwner");
        hook.transferOwnership(newOwner);
        assertEq(hook.owner(), newOwner);
    }

    function test_PoolConfigAfterInitialize() public {
        PoolId poolId = poolKey.toId();
        
        AgenticLiquidityHook.PoolConfig memory config = hook.getPoolConfig(poolId);
        
        assertEq(config.baseFee, 3000);
        assertEq(config.maxFee, 10000);
        assertEq(config.minFee, 100);
        assertEq(config.rebalanceThreshold, 500);
        assertTrue(config.autoRebalance);
    }
}
