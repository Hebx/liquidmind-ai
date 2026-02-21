// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {AgenticLiquidityHook} from "../src/AgenticLiquidityHook.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";

contract MineHookAddress is Script {
    function run() external {
        address factory = 0x4e59b44847b379578588920cA78FbF26c0B4956C;
        address poolManager = 0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408;
        address initialOwner = 0x46Ca9120Ea33E7AF921Db0a230831CB08AeB2910; 
        
        bytes memory bytecode = abi.encodePacked(
            type(AgenticLiquidityHook).creationCode,
            abi.encode(poolManager, initialOwner)
        );
        
        // AFTER_INITIALIZE | BEFORE_ADD_LIQUIDITY | BEFORE_SWAP | AFTER_SWAP
        uint256 flags = 0x18C0; 
        
        console.log("Mining salt for flags: 0x18C0...");
        
        for (uint256 i = 0; i < 2000000; i++) {
            bytes32 salt = bytes32(i);
            address hookAddress = computeAddress(factory, salt, bytecode);
            if (uint160(hookAddress) & 0x3FFF == flags) {
                console.log("Success!");
                console.log("Salt:");
                console.logBytes32(salt);
                console.log("Hook Address:", hookAddress);
                return;
            }
        }
        
        console.log("No salt found in 1,000,000 iterations.");
    }

    function computeAddress(address deployer, bytes32 salt, bytes memory bytecode) internal pure returns (address) {
        bytes32 hash = keccak256(
            abi.encodePacked(
                bytes1(0xff),
                deployer,
                salt,
                keccak256(bytecode)
            )
        );
        return address(uint160(uint256(hash)));
    }
}
