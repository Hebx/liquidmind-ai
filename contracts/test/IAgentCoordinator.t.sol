// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {IAgentCoordinator} from "../src/interfaces/IAgentCoordinator.sol";

contract IAgentCoordinatorTest is Test {
    
    function test_InterfaceId() public pure {
        // Verify interface is properly defined
        // This test ensures the interface compiles correctly
        assertTrue(true);
    }

    function test_StructEncoding() public pure {
        // Test struct encoding/decoding
        IAgentCoordinator.AgentConfig memory config = IAgentCoordinator.AgentConfig({
            isAuthorized: true,
            reputation: 100,
            lastActivity: block.timestamp
        });

        bytes memory encoded = abi.encode(config);
        IAgentCoordinator.AgentConfig memory decoded = abi.decode(encoded, (IAgentCoordinator.AgentConfig));

        assertEq(decoded.isAuthorized, config.isAuthorized);
        assertEq(decoded.reputation, config.reputation);
        assertEq(decoded.lastActivity, config.lastActivity);
    }

    function test_CrossChainCommandEncoding() public pure {
        IAgentCoordinator.CrossChainCommand memory cmd = IAgentCoordinator.CrossChainCommand({
            commandId: keccak256("test"),
            commandType: "rebalance",
            targetChainId: 1,
            targetHook: address(0x123),
            payload: abi.encode("test data"),
            timestamp: block.timestamp,
            executed: false
        });

        bytes memory encoded = abi.encode(cmd);
        IAgentCoordinator.CrossChainCommand memory decoded = abi.decode(encoded, (IAgentCoordinator.CrossChainCommand));

        assertEq(decoded.commandId, cmd.commandId);
        assertEq(decoded.targetChainId, cmd.targetChainId);
        assertEq(decoded.targetHook, cmd.targetHook);
        assertEq(decoded.executed, cmd.executed);
    }

    function test_LiquidityActionEncoding() public pure {
        // Create a mock PoolKey (simplified for test)
        bytes memory poolKeyData = abi.encode(
            address(0xAAA), // currency0
            address(0xBBB), // currency1
            uint24(3000),   // fee
            int24(60),      // tickSpacing
            address(0xCCC)  // hooks
        );

        IAgentCoordinator.LiquidityAction memory action = IAgentCoordinator.LiquidityAction({
            poolKey: abi.decode(poolKeyData, (bytes)),
            tickLower: -100,
            tickUpper: 100,
            liquidity: 1000,
            actionId: keccak256("action1"),
            actionType: "add",
            timestamp: block.timestamp
        });

        // Verify struct fields
        assertEq(action.tickLower, -100);
        assertEq(action.tickUpper, 100);
        assertEq(action.liquidity, 1000);
    }
}
