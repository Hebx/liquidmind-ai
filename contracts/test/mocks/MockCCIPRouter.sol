// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract MockCCIPRouter {
    struct EVM2AnyMessage {
        bytes receiver;
        bytes data;
        address[] tokens;
        uint256[] amounts;
        address feeToken;
        bytes extraArgs;
    }

    struct EVMTokenAmount {
        address token;
        uint256 amount;
    }

    uint64 public lastChainSelector;
    bytes public lastMessage;
    
    function ccipSend(
        uint64 chainSelector,
        EVM2AnyMessage calldata message
    ) external payable returns (bytes32) {
        lastChainSelector = chainSelector;
        lastMessage = message.data;
        return keccak256(abi.encodePacked(block.timestamp, msg.sender));
    }

    function getFee(
        uint64 chainSelector,
        EVM2AnyMessage calldata message
    ) external pure returns (uint256) {
        return 0.01 ether;
    }
}
