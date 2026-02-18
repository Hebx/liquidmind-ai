// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {LiquidMindCoordinator} from "../src/LiquidMindCoordinator.sol";
import {IAgentCoordinator} from "../src/interfaces/IAgentCoordinator.sol";
import {Router} from "@chainlink/contracts-ccip/src/v0.8/ccip/Router.sol";
import {LinkToken} from "@chainlink/contracts/src/v0.8/shared/token/ERC677/LinkToken.sol";
import {BurnMintERC677} from "@chainlink/contracts/src/v0.8/shared/token/ERC677/BurnMintERC677.sol";

contract LiquidMindCoordinatorTest is Test {
    LiquidMindCoordinator public coordinator;
    LinkToken public linkToken;
    
    address public owner;
    address public agent;
    address public router;
    address public localHook;

    // Chain selectors (mock values)
    uint256 constant ETH_MAINNET = 5009297550715157269;
    uint256 constant ARBITRUM = 4949039107694359620;
    uint256 constant OPTIMISM = 3734403246176062136;

    function setUp() public {
        owner = address(this);
        agent = makeAddr("agent");
        router = makeAddr("router");
        localHook = makeAddr("localHook");

        // Deploy mock LINK token
        linkToken = new LinkToken();

        // Deploy coordinator
        coordinator = new LiquidMindCoordinator(router, address(linkToken));
        
        // Fund coordinator with LINK
        linkToken.transfer(address(coordinator), 1000 ether);
    }

    function test_InitialState() public view {
        assertEq(coordinator.owner(), owner);
        assertEq(coordinator.getRouter(), router);
        assertEq(coordinator.agentCount(), 0);
    }

    function test_RegisterAgent() public {
        coordinator.registerAgent(agent);
        
        IAgentCoordinator.AgentConfig memory config = coordinator.getAgent(agent);
        assertTrue(config.isAuthorized);
        assertEq(config.reputation, 100);
        assertGt(config.lastActivity, 0);
        assertEq(coordinator.agentCount(), 1);
    }

    function test_RegisterAgent_RevertIfAlreadyRegistered() public {
        coordinator.registerAgent(agent);
        
        vm.expectRevert("Agent already registered");
        coordinator.registerAgent(agent);
    }

    function test_RevokeAgent() public {
        coordinator.registerAgent(agent);
        coordinator.revokeAgent(agent);
        
        IAgentCoordinator.AgentConfig memory config = coordinator.getAgent(agent);
        assertFalse(config.isAuthorized);
        assertEq(coordinator.agentCount(), 0);
    }

    function test_UpdateAgentReputation() public {
        coordinator.registerAgent(agent);
        coordinator.updateAgentReputation(agent, 150);
        
        IAgentCoordinator.AgentConfig memory config = coordinator.getAgent(agent);
        assertEq(config.reputation, 150);
    }

    function test_AddSupportedChain() public {
        address hook = makeAddr("hook");
        coordinator.addSupportedChain(ETH_MAINNET, hook);
        
        assertTrue(coordinator.supportedChains(ETH_MAINNET));
        assertEq(coordinator.chainHooks(ETH_MAINNET), hook);
    }

    function test_RemoveSupportedChain() public {
        address hook = makeAddr("hook");
        coordinator.addSupportedChain(ETH_MAINNET, hook);
        coordinator.removeSupportedChain(ETH_MAINNET);
        
        assertFalse(coordinator.supportedChains(ETH_MAINNET));
    }

    function test_SetLocalHook() public {
        coordinator.setLocalHook(localHook);
        assertEq(coordinator.localHook(), localHook);
    }

    function test_RegisterAgent_RevertIfNotOwner() public {
        vm.prank(agent);
        vm.expectRevert();
        coordinator.registerAgent(agent);
    }

    function test_AddSupportedChain_RevertIfNotOwner() public {
        vm.prank(agent);
        vm.expectRevert();
        coordinator.addSupportedChain(ETH_MAINNET, makeAddr("hook"));
    }

    function testFuzz_RegisterMultipleAgents(address[] calldata _agents) public {
        vm.assume(_agents.length > 0 && _agents.length <= 10);
        
        for (uint i = 0; i < _agents.length; i++) {
            vm.assume(_agents[i] != address(0));
            coordinator.registerAgent(_agents[i]);
        }
        
        assertEq(coordinator.agentCount(), _agents.length);
    }

    function test_GetCommand_NotFound() public view {
        bytes32 commandId = keccak256("nonexistent");
        IAgentCoordinator.CrossChainCommand memory cmd = coordinator.getCommand(commandId);
        
        assertEq(cmd.timestamp, 0);
        assertFalse(cmd.executed);
    }

    function test_IsCommandValid_NotFound() public view {
        bytes32 commandId = keccak256("nonexistent");
        assertFalse(coordinator.isCommandValid(commandId));
    }
}
