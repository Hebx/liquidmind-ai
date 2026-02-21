// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test, console2} from "forge-std/Test.sol";
import {AgenticLiquidityHook} from "../../src/AgenticLiquidityHook.sol";
import {LiquidMindCoordinator} from "../../src/LiquidMindCoordinator.sol";

/**
 * @title BaseSepolia Fork Tests
 * @notice End-to-end tests that fork Base Sepolia and assert real on-chain state.
 *         No mocks - every call goes to the actual deployed contracts and
 *         live Chainlink price feeds.
 */
contract BaseSepoliaForkTest is Test {
    // ── Deployed contracts (Base Sepolia) ─────────────────────────────────────
    address constant COORDINATOR  = 0x0fd80F163d9D1a62f77bd88db2eb9fd91471DddA;
    address constant HOOK         = 0x15b60e98a00d83BA4B010CceDb09864d1d93d0c0;
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

    function test_Fork_Coordinator_HasLINKBalance() public view {
        IERC20 link = IERC20(LINK_TOKEN);
        uint256 balance = link.balanceOf(COORDINATOR);
        assertGt(balance, 0, "Coordinator has no LINK balance");
        console2.log("Coordinator LINK balance (wei):", balance);
        console2.log("Coordinator LINK balance:", balance / 1e18, "LINK");
    }

    function test_Fork_Coordinator_RouterSet() public view {
        address router = coordinator.getRouter();
        assertNotEq(router, address(0), "Coordinator router is zero address");
        console2.log("CCIP Router:", router);
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
    function decimals() external view returns (uint8);
}

interface IERC20 {
    function balanceOf(address) external view returns (uint256);
}
