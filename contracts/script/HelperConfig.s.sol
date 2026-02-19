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
        } else if (block.chainid == 421614) {
            activeNetworkConfig = getArbitrumSepoliaConfig();
        } else {
            activeNetworkConfig = getAnvilConfig();
        }
    }

    // Latest verified testnet addresses from Chainlink & Uniswap docs (Feb 2026)
    function getBaseSepoliaConfig() public view returns (NetworkConfig memory) {
        return NetworkConfig({
            poolManager: 0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408, // Uniswap v4 PoolManager on Base Sepolia
            linkToken: 0xE4aB69C077896252FAFBD49EFD26B5D171A32410, // LINK on Base Sepolia
            ccipRouter: 0xd3B06161f529eD22C66A90731671040f7F329977, // CCIP Router Base Sepolia
            deployerKey: vm.envUint("PRIVATE_KEY")
        });
    }

    function getOptimismSepoliaConfig() public view returns (NetworkConfig memory) {
        return NetworkConfig({
            poolManager: 0x9a13F98Cb987694C9F086b1F5eB990EeA8264Ec3, // Uniswap v4 PoolManager on OP Sepolia
            linkToken: 0xE4aB69C077896252FAFBD49EFD26B5D171A32410, // LINK on OP Sepolia
            ccipRouter: 0x114A20A10B43D4115E5aEEfEe5daE3261946de46, // CCIP Router OP Sepolia (updated)
            deployerKey: vm.envUint("PRIVATE_KEY")
        });
    }

    function getArbitrumSepoliaConfig() public view returns (NetworkConfig memory) {
        return NetworkConfig({
            poolManager: 0xFB3e0C6F74eB1a21CC1Da29aeC80D2Dfe6C9a317, // Uniswap v4 PoolManager on Arbitrum Sepolia
            linkToken: 0xb1D4538B4571d411F07960EF2838Ce337FE1E80E, // LINK on Arbitrum Sepolia
            ccipRouter: 0x2a9C5afB0d0e4BAb2BCdaE109EC4b0c4Be15a165, // CCIP Router Arbitrum Sepolia
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