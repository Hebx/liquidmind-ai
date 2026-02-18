// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {AgenticLiquidityHook} from "../src/AgenticLiquidityHook.sol";
import {LiquidMindCoordinator} from "../src/LiquidMindCoordinator.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {HelperConfig} from "./HelperConfig.s.sol";

contract DeployLiquidMind is Script {
    function run() external returns (AgenticLiquidityHook, LiquidMindCoordinator, HelperConfig) {
        HelperConfig helperConfig = new HelperConfig();
        (
            address poolManager,
            address linkToken,
            address ccipRouter,
            uint256 deployerKey
        ) = helperConfig.activeNetworkConfig();

        vm.startBroadcast(deployerKey);

        // Deploy Coordinator
        LiquidMindCoordinator coordinator = new LiquidMindCoordinator(ccipRouter, linkToken);

        // Deploy Hook
        AgenticLiquidityHook hook = new AgenticLiquidityHook(IPoolManager(poolManager));

        // Setup
        hook.setAgentCoordinator(address(coordinator));
        coordinator.setLocalHook(address(hook));

        vm.stopBroadcast();

        return (hook, coordinator, helperConfig);
    }
}
