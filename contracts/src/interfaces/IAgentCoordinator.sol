// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {PoolId} from "v4-core/src/types/PoolId.sol";
import {BalanceDelta} from "v4-core/src/types/BalanceDelta.sol";

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
    
    /**
     * @notice Send a liquidity command to a destination chain
     * @param destinationChainSelector The chain selector for the destination chain
     * @param commandType The type of command (e.g., "rebalance", "updateFee")
     * @param payload The encoded command payload
     * @return messageId The unique message ID from CCIP
     */
    function sendLiquidityCommand(
        uint256 destinationChainSelector,
        string calldata commandType,
        bytes calldata payload
    ) external returns (bytes32 messageId);

    /**
     * @notice Register a new AI agent
     * @param agent The address of the agent to register
     */
    function registerAgent(address agent) external;

    /**
     * @notice Revoke an agent's authorization
     * @param agent The address of the agent to revoke
     */
    function revokeAgent(address agent) external;

    /**
     * @notice Update an agent's reputation score
     * @param agent The address of the agent
     * @param newReputation The new reputation score
     */
    function updateAgentReputation(address agent, uint256 newReputation) external;

    /**
     * @notice Add a supported chain with its hook address
     * @param chainId The chain ID
     * @param hookAddress The address of the hook contract on that chain
     */
    function addSupportedChain(uint256 chainId, address hookAddress) external;

    /**
     * @notice Remove a chain from supported chains
     * @param chainId The chain ID to remove
     */
    function removeSupportedChain(uint256 chainId) external;

    /**
     * @notice Set the local hook address
     * @param _localHook The address of the local hook
     */
    function setLocalHook(address _localHook) external;

    // ============ View Functions ============
    
    /**
     * @notice Get the hook address for a specific chain
     * @param chainId The chain ID
     * @return The hook address
     */
    function chainHooks(uint256 chainId) external view returns (address);

    /**
     * @notice Get the agent configuration
     * @param agent The agent address
     * @return The agent configuration
     */
    function agents(address agent) external view returns (AgentConfig memory);

    /**
     * @notice Check if a message has been processed
     * @param messageId The message ID
     * @return Whether the message has been processed
     */
    function processedMessages(bytes32 messageId) external view returns (bool);

    /**
     * @notice Get a command by its ID
     * @param commandId The command ID
     * @return The command details
     */
    function commands(bytes32 commandId) external view returns (CrossChainCommand memory);

    /**
     * @notice Check if a chain is supported
     * @param chainId The chain ID
     * @return Whether the chain is supported
     */
    function supportedChains(uint256 chainId) external view returns (bool);

    /**
     * @notice Get the local hook address
     * @return The local hook address
     */
    function localHook() external view returns (address);

    /**
     * @notice Get the number of registered agents
     * @return The count of agents
     */
    function agentCount() external view returns (uint256);

    /**
     * @notice Get the command validity period
     * @return The validity period in seconds
     */
    function COMMAND_VALIDITY() external view returns (uint256);

    /**
     * @notice Check if a command is still valid
     * @param commandId The command ID
     * @return Whether the command is valid
     */
    function isCommandValid(bytes32 commandId) external view returns (bool);

    /**
     * @notice Get the CCIP router address
     * @return The router address
     */
    function getRouter() external view returns (address);
}
