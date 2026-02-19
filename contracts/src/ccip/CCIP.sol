// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

library Client {
    struct EVMTokenAmount {
        address token;
        uint256 amount;
    }

    struct EVM2AnyMessage {
        bytes receiver;
        bytes data;
        EVMTokenAmount[] tokenAmounts;
        bytes extraArgs;
        address feeToken;
    }

    struct Any2EVMMessage {
        bytes32 messageId;
        uint64 sourceChainSelector;
        bytes sender;
        bytes data;
    }

    struct EVMExtraArgsV1 {
        uint256 gasLimit;
    }

    function _argsToBytes(EVMExtraArgsV1 memory extraArgs) internal pure returns (bytes memory) {
        return abi.encode(extraArgs);
    }
}

interface IRouterClient {
    function getFee(uint64 destinationChainSelector, Client.EVM2AnyMessage calldata message)
        external
        view
        returns (uint256);

    function ccipSend(uint64 destinationChainSelector, Client.EVM2AnyMessage calldata message)
        external
        returns (bytes32);
}

interface LinkTokenInterface {
    function balanceOf(address account) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function transfer(address recipient, uint256 amount) external returns (bool);
}

abstract contract CCIPReceiver {
    error InvalidRouter(address router);

    address public immutable i_router;

    constructor(address router) {
        if (router == address(0)) revert InvalidRouter(router);
        i_router = router;
    }

    modifier onlyRouter() {
        if (msg.sender != i_router) revert InvalidRouter(msg.sender);
        _;
    }

    function ccipReceive(Client.Any2EVMMessage calldata any2EvmMessage) external onlyRouter {
        _ccipReceive(any2EvmMessage);
    }

    function _ccipReceive(Client.Any2EVMMessage memory any2EvmMessage) internal virtual;
}
