// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Hooks} from "v4-core/src/libraries/Hooks.sol";
import {IHooks} from "v4-core/src/interfaces/IHooks.sol";

/**
 * @title HookMiner
 * @notice Utility to find a hook address with specific flags for testing
 */
library HookMiner {
    /// @notice Find a salt that produces a hook address with the desired flags
    /// @param deployer The address that will deploy the hook
    /// @param flags The desired hook flags (e.g., Hooks.AFTER_INITIALIZE_FLAG | Hooks.BEFORE_SWAP_FLAG)
    /// @param creationCode The creation code of the hook contract
    /// @param constructorArgs The encoded constructor arguments
    /// @return hookAddress The address with the desired flags
    /// @return salt The salt that produces this address
    function find(
        address deployer,
        uint160 flags,
        bytes memory creationCode,
        bytes memory constructorArgs
    ) internal pure returns (address hookAddress, uint256 salt) {
        bytes memory creationCodeWithArgs = abi.encodePacked(creationCode, constructorArgs);
        
        for (salt = 0; salt < type(uint256).max; salt++) {
            hookAddress = computeAddress(deployer, salt, creationCodeWithArgs);
            
            if (uint160(hookAddress) & flags == flags) {
                return (hookAddress, salt);
            }
        }
        
        revert("HookMiner: could not find valid salt");
    }
    
    /// @notice Compute the address of a contract deployed via CREATE2
    function computeAddress(
        address deployer,
        uint256 salt,
        bytes memory creationCode
    ) internal pure returns (address) {
        bytes32 hash = keccak256(
            abi.encodePacked(
                bytes1(0xff),
                deployer,
                bytes32(salt),
                keccak256(creationCode)
            )
        );
        return address(uint160(uint256(hash)));
    }
}