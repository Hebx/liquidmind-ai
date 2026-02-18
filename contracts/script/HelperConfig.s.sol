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

    // Latest verified testnet addresses from Chainlink & Uniswap docs (Feb 2026)
    function getBaseSepoliaConfig() public view returns (NetworkConfig memory) {
        return NetworkConfig({
            poolManager: 0x05E73354cFdC7b39bfD92C5B90d84e8ddaf9ee1C, // Uniswap v4 PoolManager on Base Sepolia
            linkToken: 0xE4aB69C077896252FAFBD49EFD26B5D171A32410, // LINK on Base Sepolia
            ccipRouter: 0xD3b06161f529eD22C66A90731671040f7f329977, // CCIP Router Base Sepolia
            deployerKey: vm.envUint("PRIVATE_KEY")
        });
    }

    function getOptimismSepoliaConfig() public view returns (NetworkConfig memory) {
        return NetworkConfig({
            poolManager: 0xC39bE5B5D57077b7b2D4789704bB2F476be49531, // Uniswap v4 PoolManager on OP Sepolia
            linkToken: 0xE4aB69C077896252FAFBD49EFD26B5D171A32410, // LINK on OP Sepolia
            ccipRouter: 0x114A20A10b43D4115e5aeefEE5dAE3261946de46, // CCIP Router OP Sepolia (updated)
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
