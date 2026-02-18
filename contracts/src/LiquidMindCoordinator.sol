// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IRouterClient} from "@chainlink/contracts-ccip/src/v0.8/ccip/interfaces/IRouterClient.sol";
import {OwnerIsCreator} from "@chainlink/contracts-ccip/src/v0.8/shared/access/OwnerIsCreator.sol";
import {Client} from "@chainlink/contracts-ccip/src/v0.8/ccip/libraries/Client.sol";
import {CCIPReceiver} from "@chainlink/contracts-ccip/src/v0.8/ccip/applications/CCIPReceiver.sol";
import {LinkTokenInterface} from "@chainlink/contracts/src/v0.8/shared/interfaces/LinkTokenInterface.sol";

interface IAgenticLiquidityHook {
    function executeAgentAction(
        bytes32 actionId,
        string calldata actionType,
        bytes calldata key,
        bytes calldata actionData
    ) external returns (bool);
    
    function receiveCrossChainSignal(
        uint256 sourceChainId,
        bytes32 signalId,
        bytes calldata data
    ) external;
}

/**
 * @title LiquidMindCoordinator
 * @notice Cross-chain coordinator for AI-driven liquidity management
 * @dev Uses Chainlink CCIP for secure cross-chain messaging
 */
contract LiquidMindCoordinator is CCIPReceiver, OwnerIsCreator {
    // ============ Errors ============
    error NotEnoughBalance(uint256 currentBalance, uint256 calculatedFees);
    error NothingToWithdraw();
    error FailedToWithdrawEth(address owner, address target, uint256 value);
    error InvalidDestinationChain();
    error InvalidReceiverAddress();
    error MessageAlreadyProcessed(bytes32 messageId);
    error UnauthorizedAgent();

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

    // ============ State Variables ============
    IRouterClient private s_router;
    LinkTokenInterface private s_linkToken;
    
    // Chain ID => Hook address mapping
    mapping(uint256 => address) public chainHooks;
    
    // Agent address => Config
    mapping(address => AgentConfig) public agents;
    
    // Message ID => processed
    mapping(bytes32 => bool) public processedMessages;
    
    // Command ID => Command
    mapping(bytes32 => CrossChainCommand) public commands;
    
    // Local hook reference
    address public localHook;
    
    // Supported chains
    mapping(uint256 => bool) public supportedChains;
    
    uint256 public constant COMMAND_VALIDITY = 1 hours;
    uint256 public agentCount;

    // ============ Modifiers ============
    modifier onlyAgent() {
        require(agents[msg.sender].isAuthorized, UnauthorizedAgent());
        _;
    }

    modifier validChain(uint256 chainId) {
        require(supportedChains[chainId], InvalidDestinationChain());
        _;
    }

    // ============ Constructor ============
    constructor(address _router, address _link) CCIPReceiver(_router) {
        s_router = IRouterClient(_router);
        s_linkToken = LinkTokenInterface(_link);
    }

    // ============ Cross-Chain Messaging ============
    function sendLiquidityCommand(
        uint256 destinationChainSelector,
        string calldata commandType,
        bytes calldata payload
    ) external onlyAgent validChain(destinationChainSelector) returns (bytes32 messageId) {
        address receiver = chainHooks[destinationChainSelector];
        require(receiver != address(0), InvalidReceiverAddress());

        // Create command structure
        bytes32 commandId = keccak256(
            abi.encodePacked(
                msg.sender,
                destinationChainSelector,
                block.timestamp,
                payload
            )
        );

        // Encode message for CCIP
        bytes memory data = abi.encode(
            commandId,
            commandType,
            msg.sender,
            payload
        );

        // Create CCIP message
        Client.EVM2AnyMessage memory evm2AnyMessage = Client.EVM2AnyMessage({
            receiver: abi.encode(receiver),
            data: data,
            tokenAmounts: new Client.EVMTokenAmount[](0),
            extraArgs: Client._argsToBytes(
                Client.EVMExtraArgsV1({gasLimit: 500_000})
            ),
            feeToken: address(s_linkToken)
        });

        // Get fee and check balance
        uint256 fees = s_router.getFee(destinationChainSelector, evm2AnyMessage);
        uint256 currentBalance = s_linkToken.balanceOf(address(this));
        
        if (fees > currentBalance) {
            revert NotEnoughBalance(currentBalance, fees);
        }

        // Approve and send
        s_linkToken.approve(address(s_router), fees);
        messageId = s_router.ccipSend(destinationChainSelector, evm2AnyMessage);

        // Store command
        commands[commandId] = CrossChainCommand({
            commandId: commandId,
            commandType: commandType,
            targetChainId: destinationChainSelector,
            targetHook: receiver,
            payload: payload,
            timestamp: block.timestamp,
            executed: false
        });

        emit MessageSent(
            messageId,
            destinationChainSelector,
            receiver,
            data,
            address(s_linkToken),
            fees
        );
        
        emit LiquidityCommandSent(destinationChainSelector, commandId, commandType);

        // Update agent activity
        agents[msg.sender].lastActivity = block.timestamp;
    }

    function _ccipReceive(
        Client.Any2EVMMessage memory any2EvmMessage
    ) internal override {
        bytes32 messageId = any2EvmMessage.messageId;
        
        require(!processedMessages[messageId], MessageAlreadyProcessed(messageId));
        processedMessages[messageId] = true;

        uint256 sourceChainSelector = any2EvmMessage.sourceChainSelector;
        address sender = abi.decode(any2EvmMessage.sender, (address));

        emit MessageReceived(
            messageId,
            sourceChainSelector,
            sender,
            any2EvmMessage.data
        );

        // Decode and process message
        (
            bytes32 commandId,
            string memory commandType,
            address originAgent,
            bytes memory payload
        ) = abi.decode(any2EvmMessage.data, (bytes32, string, address, bytes));

        // Forward to local hook
        if (localHook != address(0)) {
            IAgenticLiquidityHook(localHook).receiveCrossChainSignal(
                sourceChainSelector,
                commandId,
                payload
            );
        }

        // Mark command as executed
        if (commands[commandId].timestamp != 0) {
            commands[commandId].executed = true;
        }
    }

    // ============ Agent Management ============
    function registerAgent(address agent) external onlyOwner {
        require(!agents[agent].isAuthorized, "Agent already registered");
        
        agents[agent] = AgentConfig({
            isAuthorized: true,
            reputation: 100, // Initial reputation
            lastActivity: block.timestamp
        });
        
        agentCount++;
        emit AgentRegistered(agent, true);
    }

    function revokeAgent(address agent) external onlyOwner {
        require(agents[agent].isAuthorized, "Agent not registered");
        
        agents[agent].isAuthorized = false;
        agentCount--;
        emit AgentRegistered(agent, false);
    }

    function updateAgentReputation(address agent, uint256 newReputation) external onlyOwner {
        agents[agent].reputation = newReputation;
    }

    // ============ Chain Configuration ============
    function addSupportedChain(uint256 chainId, address hookAddress) external onlyOwner {
        supportedChains[chainId] = true;
        chainHooks[chainId] = hookAddress;
        emit HookRegistered(chainId, hookAddress);
    }

    function removeSupportedChain(uint256 chainId) external onlyOwner {
        supportedChains[chainId] = false;
        delete chainHooks[chainId];
    }

    function setLocalHook(address _localHook) external onlyOwner {
        localHook = _localHook;
    }

    // ============ Withdrawal Functions ============
    function withdraw(address beneficiary) public onlyOwner {
        uint256 amount = s_linkToken.balanceOf(address(this));
        if (amount == 0) revert NothingToWithdraw();
        s_linkToken.transfer(beneficiary, amount);
    }

    function withdrawEth(address beneficiary) public onlyOwner {
        uint256 amount = address(this).balance;
        if (amount == 0) revert NothingToWithdraw();
        
        (bool sent, ) = beneficiary.call{value: amount}("");
        if (!sent) revert FailedToWithdrawEth(msg.sender, beneficiary, amount);
    }

    // ============ View Functions ============
    function getCommand(bytes32 commandId) external view returns (CrossChainCommand memory) {
        return commands[commandId];
    }

    function getAgent(address agent) external view returns (AgentConfig memory) {
        return agents[agent];
    }

    function isCommandValid(bytes32 commandId) external view returns (bool) {
        CrossChainCommand memory cmd = commands[commandId];
        if (cmd.timestamp == 0) return false;
        if (cmd.executed) return false;
        return block.timestamp <= cmd.timestamp + COMMAND_VALIDITY;
    }

    function getRouter() external view returns (address) {
        return address(s_router);
    }

    // ============ Receive ============
    receive() external payable {}
}
