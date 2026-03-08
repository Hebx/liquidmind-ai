// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "v4-core/src/types/PoolId.sol";
import {Currency} from "v4-core/src/types/Currency.sol";
import {BalanceDelta} from "v4-core/src/types/BalanceDelta.sol";
import {SwapParams, ModifyLiquidityParams} from "v4-core/src/types/PoolOperation.sol";
import {TickMath} from "v4-core/src/libraries/TickMath.sol";
import {LPFeeLibrary} from "v4-core/src/libraries/LPFeeLibrary.sol";
import {StateLibrary} from "v4-core/src/libraries/StateLibrary.sol";
import {PoolSwapTest} from "v4-core/src/test/PoolSwapTest.sol";
import {PoolModifyLiquidityTest} from "v4-core/src/test/PoolModifyLiquidityTest.sol";
import {AgenticLiquidityHook} from "../src/AgenticLiquidityHook.sol";

interface IERC20 {
    function approve(address spender, uint256 amount) external returns (bool);
    function balanceOf(address) external view returns (uint256);
    function allowance(address owner, address spender) external view returns (uint256);
}

interface IWETH {
    function deposit() external payable;
}

contract TestnetFlow is Script {
    using PoolIdLibrary for PoolKey;
    using StateLibrary for IPoolManager;

    address constant POOL_MANAGER = 0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408;
    address constant USDC_ADDR    = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;
    address constant WETH_ADDR    = 0x4200000000000000000000000000000000000006;

    IPoolManager pm = IPoolManager(POOL_MANAGER);

    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);
        address hookAddress = vm.envAddress("HOOK_ADDRESS");

        console2.log("Deployer:", deployer);
        console2.log("Hook:", hookAddress);
        console2.log("WETH balance:", IERC20(WETH_ADDR).balanceOf(deployer));
        console2.log("USDC balance:", IERC20(USDC_ADDR).balanceOf(deployer));

        vm.startBroadcast(deployerKey);

        // ── Step 1: Deploy test routers ──────────────────────────────────
        console2.log("\n=== Step 1: Deploying test routers ===");
        PoolModifyLiquidityTest liqRouter = new PoolModifyLiquidityTest(pm);
        PoolSwapTest swapRouter = new PoolSwapTest(pm);
        console2.log("LiquidityRouter:", address(liqRouter));
        console2.log("SwapRouter:", address(swapRouter));

        // ── Step 2: Initialize pool ──────────────────────────────────────
        console2.log("\n=== Step 2: Initialize pool ===");

        // USDC < WETH by address (0x036C... < 0x4200...)
        PoolKey memory key = PoolKey({
            currency0: Currency.wrap(USDC_ADDR),
            currency1: Currency.wrap(WETH_ADDR),
            fee: LPFeeLibrary.DYNAMIC_FEE_FLAG,
            tickSpacing: int24(60),
            hooks: AgenticLiquidityHook(hookAddress)
        });

        // sqrtPriceX96 for ETH/USD ≈ $2000
        // In this pool: token0=USDC, token1=WETH
        // price = token1/token0 in raw units = (WETH_amount * 10^6) / (USDC_amount * 10^18)
        // For 1 WETH = 2000 USDC: price_raw = 1e6 / (2000 * 1e18) is very small
        // Actually price = amount0/amount1 for sqrtPrice, so sqrtPriceX96 = sqrt(price) * 2^96
        // price (token1 per token0) = WETH per USDC = 1/2000 * 10^(18-6) = 5e8
        // Wait, let me think more carefully:
        // sqrtPriceX96 = sqrt(token1_per_token0) * 2^96
        // token1_per_token0 = WETH_per_USDC_in_raw = (1/2000) * (10^18/10^6) = 5 * 10^8
        // sqrt(5e8) ≈ 22360.68
        // sqrtPriceX96 = 22360.68 * 2^96 ≈ 22360.68 * 79228162514264337593543950336 ≈ 1.772e33
        // Let's use TickMath to get it from a tick instead
        // tick for price 5e8: tick = log(5e8) / log(1.0001) ≈ 20.03 / 0.00009999 ≈ 200049
        // Actually let me just use a well-known tick
        // For USDC(6)/WETH(18) pair at ~$2000:
        // tick ≈ -75800 (from our CRE workflow output)
        int24 startTick = int24(-75840);
        // Snap to spacing
        startTick = (startTick / int24(60)) * int24(60);
        uint160 sqrtPriceX96 = TickMath.getSqrtPriceAtTick(startTick);

        console2.log("Start tick:", startTick);
        console2.log("sqrtPriceX96:", sqrtPriceX96);

        PoolId poolId = key.toId();
        console2.log("PoolId:");
        console2.logBytes32(PoolId.unwrap(poolId));

        try pm.initialize(key, sqrtPriceX96) {
            console2.log("Pool initialized!");
        } catch {
            console2.log("Pool already initialized, continuing with existing state");
        }

        // Verify hook seeded the config
        (, int24 currentTick,,) = pm.getSlot0(poolId);
        console2.log("Current tick from pool:", currentTick);

        // ── Step 3: Approve tokens for liquidity router ──────────────────
        console2.log("\n=== Step 3: Approve tokens ===");
        IERC20(USDC_ADDR).approve(address(liqRouter), type(uint256).max);
        IERC20(WETH_ADDR).approve(address(liqRouter), type(uint256).max);
        IERC20(USDC_ADDR).approve(address(swapRouter), type(uint256).max);
        IERC20(WETH_ADDR).approve(address(swapRouter), type(uint256).max);
        console2.log("Tokens approved for both routers");

        // ── Step 4: Add liquidity ────────────────────────────────────────
        console2.log("\n=== Step 4: Add liquidity ===");
        // Wide range around current tick
        int24 tickLower = ((startTick - int24(600)) / int24(60)) * int24(60);
        int24 tickUpper = ((startTick + int24(600)) / int24(60)) * int24(60);
        console2.log("Liquidity range tickLower:", tickLower);
        console2.log("Liquidity range tickUpper:", tickUpper);

        // Tiny liquidity sized to fit the wallet's faucet-scale Base Sepolia balances.
        ModifyLiquidityParams memory liqParams = ModifyLiquidityParams({
            tickLower: tickLower,
            tickUpper: tickUpper,
            liquidityDelta: int256(3e6),
            salt: bytes32(0)
        });

        BalanceDelta liqDelta = liqRouter.modifyLiquidity(key, liqParams, "");
        console2.log("Liquidity added!");
        console2.log("Delta amount0 (USDC):", liqDelta.amount0());
        console2.log("Delta amount1 (WETH):", liqDelta.amount1());

        // ── Step 5: Swap (USDC → WETH) to trigger beforeSwap + afterSwap hooks ──
        console2.log("\n=== Step 5: Swap USDC -> WETH (triggers hook) ===");
        SwapParams memory swapParams = SwapParams({
            zeroForOne: true,           // USDC → WETH
            amountSpecified: -100000,   // exact input: 0.1 USDC
            sqrtPriceLimitX96: TickMath.MIN_SQRT_PRICE + 1
        });

        PoolSwapTest.TestSettings memory settings = PoolSwapTest.TestSettings({
            takeClaims: false,
            settleUsingBurn: false
        });

        BalanceDelta swapDelta = swapRouter.swap(key, swapParams, settings, "");
        console2.log("Swap executed!");
        console2.log("Swap delta0 (USDC spent):", swapDelta.amount0());
        console2.log("Swap delta1 (WETH received):", swapDelta.amount1());

        // ── Step 6: Second swap (WETH → USDC) to generate more EMA data ──
        console2.log("\n=== Step 6: Swap WETH -> USDC (second hook trigger) ===");
        SwapParams memory swapParams2 = SwapParams({
            zeroForOne: false,                   // WETH → USDC
            amountSpecified: -5e13,              // exact input: 0.00005 WETH
            sqrtPriceLimitX96: TickMath.MAX_SQRT_PRICE - 1
        });

        BalanceDelta swapDelta2 = swapRouter.swap(key, swapParams2, settings, "");
        console2.log("Swap 2 executed!");
        console2.log("Swap delta0 (USDC received):", swapDelta2.amount0());
        console2.log("Swap delta1 (WETH spent):", swapDelta2.amount1());

        vm.stopBroadcast();

        // ── Step 7: Read hook state (view calls, no broadcast needed) ────
        console2.log("\n=== Step 7: Verify hook state ===");
        AgenticLiquidityHook hook = AgenticLiquidityHook(hookAddress);

        uint24 dynFee = hook.getCurrentDynamicFee(poolId);
        console2.log("Dynamic fee:", dynFee);

        uint256 volAvg = hook.getVolatilityAvgTicks(poolId);
        console2.log("Volatility avg ticks:", volAvg);

        uint256 ema = hook.volatilityEMA(poolId);
        console2.log("Raw EMA:", ema);

        int24 lastTickVal = hook.lastTick(poolId);
        console2.log("Last tick:", lastTickVal);

        int24 curTickVal = hook.currentTick(poolId);
        console2.log("Current tick:", curTickVal);

        bool needsRebal = hook.needsRebalance(poolId);
        console2.log("Needs rebalance:", needsRebal);

        AgenticLiquidityHook.LiquidityPosition memory pos = hook.getPosition(poolId);
        console2.log("Active position tickLower:", pos.tickLower);
        console2.log("Active position tickUpper:", pos.tickUpper);
        console2.log("Position liquidity:", pos.liquidity);

        AgenticLiquidityHook.PoolConfig memory cfg = hook.getPoolConfig(poolId);
        console2.log("Pool config baseFee:", cfg.baseFee);
        console2.log("Pool config minFee:", cfg.minFee);
        console2.log("Pool config maxFee:", cfg.maxFee);
        console2.log("Pool config autoRebalance:", cfg.autoRebalance);

        console2.log("\n=== TESTNET FLOW COMPLETE ===");
    }
}
