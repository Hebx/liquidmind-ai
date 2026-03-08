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

        // Deploy Hook with mined salt for v4 permissions (0x18C0):
        // AFTER_INITIALIZE | BEFORE_ADD_LIQUIDITY | BEFORE_SWAP | AFTER_SWAP
        bytes32 salt = 0x0000000000000000000000000000000000000000000000000000000000006479;
        address deployerAddress = vm.addr(deployerKey);
        AgenticLiquidityHook hook = new AgenticLiquidityHook{salt: salt}(IPoolManager(poolManager), deployerAddress);
        if ((uint160(address(hook)) & 0x3FFF) != 0x18C0) {
            revert("Hook permissions mismatch");
        }

        // Wire hook ↔ coordinator
        hook.setAgentCoordinator(address(coordinator));
        coordinator.setLocalHook(address(hook));

        // Register deployer as the first authorized agent (CRE wallet)
        coordinator.registerAgent(deployerAddress);

        vm.stopBroadcast();

        return (hook, coordinator, helperConfig);
    }
}
