// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {AgenticLiquidityHook} from "../src/AgenticLiquidityHook.sol";
import {LiquidMindCoordinator} from "../src/LiquidMindCoordinator.sol";
import {MockCCIPRouter} from "../test/mocks/MockCCIPRouter.sol";
import {MockLinkToken} from "../test/mocks/MockLinkToken.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";

contract DeployLocal is Script {
    struct Deployment {
        AgenticLiquidityHook hook;
        LiquidMindCoordinator coordinator;
        MockCCIPRouter ccipRouter;
        MockLinkToken linkToken;
        address poolManager;
    }

    function run() external returns (Deployment memory) {
        uint256 deployerKey = 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;
        
        vm.startBroadcast(deployerKey);

        // Deploy mocks
        MockCCIPRouter ccipRouter = new MockCCIPRouter();
        MockLinkToken linkToken = new MockLinkToken();
        
        // Use a dummy address for PoolManager (hook only stores it, doesn't call it)
        address poolManager = address(0x1234567890123456789012345678901234567890);

        // Deploy Coordinator
        LiquidMindCoordinator coordinator = new LiquidMindCoordinator(
            address(ccipRouter), 
            address(linkToken)
        );

        // Deploy Hook
        AgenticLiquidityHook hook = new AgenticLiquidityHook(IPoolManager(poolManager));

        // Setup connections
        hook.setAgentCoordinator(address(coordinator));
        coordinator.setLocalHook(address(hook));

        // Fund coordinator with LINK for CCIP fees
        linkToken.mint(address(coordinator), 1000 ether);

        vm.stopBroadcast();

        console.log("=== LIQUIDMIND Local Deployment ===");
        console.log("PoolManager:", poolManager);
        console.log("CCIP Router:", address(ccipRouter));
        console.log("LINK Token:", address(linkToken));
        console.log("Coordinator:", address(coordinator));
        console.log("Hook:", address(hook));
        console.log("====================================");

        return Deployment({
            hook: hook,
            coordinator: coordinator,
            ccipRouter: ccipRouter,
            linkToken: linkToken,
            poolManager: poolManager
        });
    }
}
