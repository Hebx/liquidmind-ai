// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";

contract HelperConfig is Script {
    struct NetworkConfig {
        address poolManager;
        address linkToken;
        address ccipRouter;
        uint256 deployerKey;
    }

    NetworkConfig public activeNetworkConfig;

    constructor() {
        if (block.chainid == 84532) {
            activeNetworkConfig = getBaseSepoliaConfig();
        } else if (block.chainid == 11155420) {
            activeNetworkConfig = getOptimismSepoliaConfig();
        } else {
            activeNetworkConfig = getAnvilConfig();
        }
    }

    function getBaseSepoliaConfig() public view returns (NetworkConfig memory) {
        return NetworkConfig({
            poolManager: 0x05c21950c609B16712396605e46B1902047E64b5, // Mock or Real
            linkToken: 0xE4aB69C077896252FAFBD49EFD26B5D171A32410,
            ccipRouter: 0xD3b06161f529eD22C66A90731671040f7f329977,
            deployerKey: vm.envUint("PRIVATE_KEY")
        });
    }

    function getOptimismSepoliaConfig() public view returns (NetworkConfig memory) {
        return NetworkConfig({
            poolManager: 0x05c21950c609B16712396605e46B1902047E64b5, // Mock or Real
            linkToken: 0xE4aB69C077896252FAFBD49EFD26B5D171A32410,
            ccipRouter: 0x11356A2B3766a2E4eE53A5430Ea117565451e03A,
            deployerKey: vm.envUint("PRIVATE_KEY")
        });
    }

    function getAnvilConfig() public returns (NetworkConfig memory) {
        // Deploy mocks here if needed
        return NetworkConfig({
            poolManager: address(0),
            linkToken: address(0),
            ccipRouter: address(0),
            deployerKey: 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
        });
    }
}
