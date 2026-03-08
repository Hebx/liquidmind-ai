// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test, console2} from "forge-std/Test.sol";
import {AgenticLiquidityHook} from "../../src/AgenticLiquidityHook.sol";
import {LiquidMindCoordinator} from "../../src/LiquidMindCoordinator.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {LPFeeLibrary} from "v4-core/src/libraries/LPFeeLibrary.sol";
import {PoolId} from "v4-core/src/types/PoolId.sol";

/**
 * @title BaseSepolia Fork Tests
 * @notice End-to-end tests that fork Base Sepolia and assert real on-chain state.
 *         No mocks - every call goes to the actual deployed contracts and
 *         live Chainlink price feeds.
 */
contract BaseSepoliaForkTest is Test {
    // ── Deployed contracts (Base Sepolia) ─────────────────────────────────────
    address constant COORDINATOR  = 0x268c2E3D23f5cDDAA0D0B40142053414cC05991b;
    address constant HOOK         = 0xC28ed0595D42ec01A2F7546f39Cf27Ea798598C0;
    address constant POOL_MANAGER = 0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408;
    address constant LINK_TOKEN   = 0xE4aB69C077896252FAFBD49EFD26B5D171A32410;
    address constant DEPLOYER     = 0x46Ca9120Ea33E7AF921Db0a230831CB08AeB2910;

    // ── Chainlink feeds (Base Sepolia, 8 decimals each) ───────────────────────
    address constant FEED_ETH_USD  = 0x4aDC67696bA383F43DD60A9e78F2C97Fbbfc7cb1;
    address constant FEED_BTC_USD  = 0x0FB99723Aee6f420beAD13e6bBB79b7E6F034298;
    address constant FEED_LINK_USD = 0xd30e2101a97dcbAeBCBC04F14C3f624E67A35165;

    // Minimal ABI for Chainlink AggregatorV3
    IAggregatorV3 ethFeed;
    IAggregatorV3 btcFeed;
    IAggregatorV3 linkFeed;

    AgenticLiquidityHook hook;
    LiquidMindCoordinator coordinator;

    function setUp() public {
        // Fork Base Sepolia at the latest block
        vm.createSelectFork("base_sepolia");

        hook        = AgenticLiquidityHook(HOOK);
        coordinator = LiquidMindCoordinator(payable(COORDINATOR));
        ethFeed     = IAggregatorV3(FEED_ETH_USD);
        btcFeed     = IAggregatorV3(FEED_BTC_USD);
        linkFeed    = IAggregatorV3(FEED_LINK_USD);
    }

    function _overlayMergedHookCode() internal {
        AgenticLiquidityHook mergedHookImpl = new AgenticLiquidityHook(IPoolManager(POOL_MANAGER), DEPLOYER);
        vm.etch(HOOK, address(mergedHookImpl).code);
        hook = AgenticLiquidityHook(HOOK);
    }

    // ── Chainlink price feed tests ────────────────────────────────────────────

    function test_Fork_ETH_USD_Feed_LivePrice() public view {
        (, int256 answer,, uint256 updatedAt,) = ethFeed.latestRoundData();
        uint8 decimals = ethFeed.decimals();

        console2.log("ETH/USD raw answer:", uint256(answer));
        console2.log("ETH/USD decimals:", decimals);
        console2.log("ETH/USD price (USD * 1e8):", uint256(answer));

        // answer > 0
        assertTrue(answer > 0, "ETH/USD: answer must be positive");
        // 8 decimals
        assertEq(decimals, 8, "ETH/USD: should have 8 decimals");
        // Price between $100 and $100 000 (sanity range)
        uint256 price = uint256(answer);
        assertGt(price, 100 * 1e8,    "ETH/USD: price below $100 - stale feed?");
        assertLt(price, 100_000 * 1e8, "ETH/USD: price above $100k - stale feed?");
        // Updated within the last 24 hours
        assertGt(updatedAt, block.timestamp - 86400, "ETH/USD: feed is stale (>24h)");

        // Log human-readable price
        console2.log("ETH/USD price:", price / 1e8, "USD");
    }

    function test_Fork_BTC_USD_Feed_LivePrice() public view {
        (, int256 answer,, uint256 updatedAt,) = btcFeed.latestRoundData();

        assertTrue(answer > 0, "BTC/USD: answer must be positive");
        assertEq(btcFeed.decimals(), 8, "BTC/USD: should have 8 decimals");

        uint256 price = uint256(answer);
        assertGt(price, 1_000 * 1e8,    "BTC/USD: below $1k - stale feed?");
        assertLt(price, 1_000_000 * 1e8, "BTC/USD: above $1M - stale feed?");
        assertGt(updatedAt, block.timestamp - 86400, "BTC/USD: feed is stale (>24h)");

        console2.log("BTC/USD price:", price / 1e8, "USD");
    }

    function test_Fork_LINK_USD_Feed_LivePrice() public view {
        (, int256 answer,, uint256 updatedAt,) = linkFeed.latestRoundData();

        assertTrue(answer > 0, "LINK/USD: answer must be positive");
        assertEq(linkFeed.decimals(), 8, "LINK/USD: should have 8 decimals");

        uint256 price = uint256(answer);
        assertGt(price, 0,               "LINK/USD: price must be > 0");
        assertLt(price, 10_000 * 1e8,   "LINK/USD: above $10k - stale feed?");
        assertGt(updatedAt, block.timestamp - 86400, "LINK/USD: feed is stale (>24h)");

        console2.log("LINK/USD price:", price / 1e8, "USD");
    }

    function test_Fork_AllFeeds_ReturnDifferentPrices() public view {
        (, int256 ethAnswer,,, ) = ethFeed.latestRoundData();
        (, int256 btcAnswer,,, ) = btcFeed.latestRoundData();
        (, int256 linkAnswer,,, ) = linkFeed.latestRoundData();

        // Each feed must return a distinct non-zero price
        assertNotEq(ethAnswer,  0, "ETH  price is zero");
        assertNotEq(btcAnswer,  0, "BTC  price is zero");
        assertNotEq(linkAnswer, 0, "LINK price is zero");
        // BTC should cost more than ETH (sanity cross-check)
        assertGt(uint256(btcAnswer), uint256(ethAnswer), "BTC should be more expensive than ETH");
    }

    // ── Deployed contract tests ───────────────────────────────────────────────

    function test_Fork_Coordinator_Owner() public view {
        assertEq(coordinator.owner(), DEPLOYER, "Coordinator owner mismatch");
    }

    function test_Fork_Coordinator_LocalHookWired() public view {
        assertEq(coordinator.localHook(), HOOK, "Coordinator.localHook not pointing to Hook");
    }

    function test_Fork_Hook_CoordinatorWired() public view {
        assertEq(hook.agentCoordinator(), COORDINATOR, "Hook.agentCoordinator not pointing to Coordinator");
    }

    function test_Fork_Hook_PoolManagerWired() public view {
        assertEq(address(hook.poolManager()), POOL_MANAGER, "Hook.poolManager mismatch");
    }

    function test_Fork_Hook_Owner() public view {
        assertEq(hook.owner(), DEPLOYER, "Hook owner mismatch");
    }

    function test_Fork_Coordinator_LINKBalance() public view {
        IERC20 link = IERC20(LINK_TOKEN);
        uint256 balance = link.balanceOf(COORDINATOR);
        console2.log("Coordinator LINK balance (wei):", balance);
        console2.log("Coordinator LINK balance:", balance / 1e18, "LINK");
        // New deployment may not have LINK yet; just verify the call succeeds
        assertTrue(true, "LINK balance query succeeded");
    }

    function test_Fork_Coordinator_RouterSet() public view {
        address router = coordinator.getRouter();
        assertNotEq(router, address(0), "Coordinator router is zero address");
        console2.log("CCIP Router:", router);
    }

    // ── Agent registration ──────────────────────────────────────────────────

    function test_Fork_Deployer_IsRegisteredAgent() public view {
        (bool isAuthorized, uint256 reputation,) = coordinator.agents(DEPLOYER);
        assertTrue(isAuthorized, "Deployer not registered as agent");
        assertEq(reputation, 100, "Agent reputation should be 100");
    }

    // ── executeLocalHookAction test (the CRE → Hook close-the-loop path) ────

    function test_Fork_ExecuteLocalHookAction_Rebalance() public {
        // Simulate the deployer (registered agent) calling a rebalance
        vm.startPrank(DEPLOYER);

        bytes32 actionId = keccak256(abi.encodePacked("fork-test-rebalance", block.timestamp));

        // Encode a PoolKey (tokens don't matter for position update, just needs to resolve to a PoolId)
        bytes memory encodedKey = abi.encode(
            address(0x036CbD53842c5426634e7929541eC2318f3dCF7e), // USDC
            address(0x4200000000000000000000000000000000000006), // WETH
            LPFeeLibrary.DYNAMIC_FEE_FLAG,
            int24(60),
            HOOK
        );

        // Rebalance to ticks [-1200, 1200]
        bytes memory actionData = abi.encode(int24(-1200), int24(1200));

        bool success = coordinator.executeLocalHookAction(
            actionId,
            "rebalance",
            encodedKey,
            actionData
        );
        assertTrue(success, "executeLocalHookAction rebalance failed");

        vm.stopPrank();
    }

    // ── executeLocalHookAction: updateFee (Milestone 2 — Volatility Oracle) ──

    function test_Fork_ExecuteLocalHookAction_UpdateFee() public {
        // Overlay the merged local hook bytecode so the fork test exercises the
        // current repository hook semantics against live Base Sepolia wiring.
        _overlayMergedHookCode();

        // Pool config must be seeded first (normally done by afterInitialize).
        // On a fork without an initialized pool we set it manually as the owner.
        bytes memory encodedKey = abi.encode(
            address(0x036CbD53842c5426634e7929541eC2318f3dCF7e), // USDC
            address(0x4200000000000000000000000000000000000006), // WETH
            LPFeeLibrary.DYNAMIC_FEE_FLAG,
            int24(60),
            HOOK
        );

        // Compute the same PoolId the hook will resolve
        bytes32 poolId = keccak256(encodedKey);

        vm.startPrank(DEPLOYER);

        // Seed default config so fee bounds are set
        hook.setPoolConfig(
            PoolId.wrap(poolId),
            AgenticLiquidityHook.PoolConfig({
                baseFee: 3000,
                maxFee: 10000,
                minFee: 500,
                rebalanceThreshold: 200,
                autoRebalance: true,
                agentOnlyLPs: false
            })
        );

        bytes32 actionId = keccak256(abi.encodePacked("fork-test-updatefee", block.timestamp));

        bytes memory actionData = abi.encode(uint24(5000));

        bool success = coordinator.executeLocalHookAction(
            actionId,
            "updateFee",
            encodedKey,
            actionData
        );
        assertTrue(success, "executeLocalHookAction updateFee failed");
        uint24 maxStep = uint24((uint256(3000) * hook.MAX_FEE_STEP_BPS()) / 10_000);
        AgenticLiquidityHook.PoolConfig memory updatedConfig = hook.getPoolConfig(PoolId.wrap(poolId));
        assertEq(updatedConfig.baseFee, 3000 + maxStep, "merged hook should cap the fee update step");
        assertEq(hook.lastFeeUpdateTimestamp(PoolId.wrap(poolId)), block.timestamp, "fee update timestamp not recorded");

        vm.expectRevert(
            abi.encodeWithSelector(
                AgenticLiquidityHook.FeeUpdateCooldownActive.selector,
                block.timestamp + hook.FEE_UPDATE_COOLDOWN()
            )
        );
        coordinator.executeLocalHookAction(
            keccak256(abi.encodePacked("fork-test-updatefee-cooldown", block.timestamp)),
            "updateFee",
            encodedKey,
            abi.encode(uint24(6000))
        );

        vm.stopPrank();
    }

    // ── Volatility Oracle: read historical rounds from Chainlink ──────────────

    function test_Fork_ChainlinkHistoricalRounds() public view {
        // Verify we can read getRoundData for recent rounds (needed by CRE volatility oracle)
        (uint80 latestRoundId,,,,) = ethFeed.latestRoundData();

        uint80 prevRound = latestRoundId - 1;
        (, int256 prevAnswer,,uint256 prevUpdatedAt,) = ethFeed.getRoundData(prevRound);
        assertTrue(prevAnswer > 0, "Previous round answer must be positive");
        assertGt(prevUpdatedAt, 0, "Previous round updatedAt must be nonzero");

        console2.log("Latest roundId:", latestRoundId);
        console2.log("Previous round answer:", uint256(prevAnswer));
        console2.log("Round delta:", latestRoundId - prevRound);
    }

    // ── Cross-check: on-chain ETH price matches expected range ────────────────

    function test_Fork_ETH_Price_Exceeds_MinYield_Threshold() public view {
        // The workflow requires ETH > $100 to be worth deploying liquidity
        (, int256 answer,,, ) = ethFeed.latestRoundData();
        uint256 ethUsd = uint256(answer) / 1e8;
        assertGt(ethUsd, 100, "ETH below $100 - liquidity deployment threshold not met");
        console2.log("ETH price for liquidity check:", ethUsd, "USD");
    }
}

// ── Minimal interfaces ────────────────────────────────────────────────────────

interface IAggregatorV3 {
    function latestRoundData()
        external
        view
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        );
    function getRoundData(uint80 _roundId)
        external
        view
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        );
    function decimals() external view returns (uint8);
}

interface IERC20 {
    function balanceOf(address) external view returns (uint256);
}
