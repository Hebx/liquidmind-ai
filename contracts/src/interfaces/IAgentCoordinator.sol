// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {PoolKey} from "v4-core/src/types/PoolKey.sol";

/**
 * @title IAgentCoordinator
 * @notice Interface for the LiquidMind cross-chain coordinator
 */
interface IAgentCoordinator {
    
    // ============ Structs ============
    
    struct CrossChainCommand {
        bytes32 commandId;
        string commandType;
        uint256 targetChainId;
        address targetHook;
        bytes payload;
        uint256 timestamp;
        bool executed;
    }

    struct AgentConfig {
        bool isAuthorized;
        uint256 reputation;
        uint256 lastActivity;
    }

    struct LiquidityAction {
        PoolKey poolKey;
        int24 tickLower;
        int24 tickUpper;
        uint128 liquidity;
        bytes32 actionId;
        string actionType;
        uint256 timestamp;
    }

    // ============ Events ============
    
    event MessageSent(
        bytes32 indexed messageId,
        uint256 indexed destinationChainSelector,
        address receiver,
        bytes data,
        address feeToken,
        uint256 fees
    );
    
    event MessageReceived(
        bytes32 indexed messageId,
        uint256 indexed sourceChainSelector,
        address sender,
        bytes data
    );
    
    event AgentRegistered(address indexed agent, bool authorized);
    event HookRegistered(uint256 indexed chainId, address hook);
    event LiquidityCommandSent(
        uint256 indexed targetChainId,
        bytes32 indexed commandId,
        string commandType
    );

    // ============ Core Functions ============
    
    function sendLiquidityCommand(
        uint256 destinationChainSelector,
        string calldata commandType,
        bytes calldata payload
    ) external returns (bytes32 messageId);

    function registerAgent(address agent) external;
    function revokeAgent(address agent) external;
    function updateAgentReputation(address agent, uint256 newReputation) external;
    function addSupportedChain(uint256 chainId, address hookAddress) external;
    function removeSupportedChain(uint256 chainId) external;
    function setLocalHook(address _localHook) external;

    // ============ View Functions ============
    
    function chainHooks(uint256 chainId) external view returns (address);
    function agents(address agent) external view returns (AgentConfig memory);
    function processedMessages(bytes32 messageId) external view returns (bool);
    function commands(bytes32 commandId) external view returns (CrossChainCommand memory);
    function supportedChains(uint256 chainId) external view returns (bool);
    function localHook() external view returns (address);
    function agentCount() external view returns (uint256);
    function COMMAND_VALIDITY() external view returns (uint256);
    function isCommandValid(bytes32 commandId) external view returns (bool);
    function getRouter() external view returns (address);
}