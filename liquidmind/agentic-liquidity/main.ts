/**
 * Agentic Liquidity CRE Workflow
 *
 * Current milestone workflow for:
 * 1. Interpreting liquidity intent inputs
 * 2. Computing fee and range guidance from market data
 * 3. Preparing action payloads for Base Sepolia coordinator execution
 *
 * Notes:
 * - Real Chainlink price and historical round reads are part of the live path.
 * - HTTP-triggered intent ingestion is the next milestone.
 * - A2A, x402, and broader cross-chain execution remain exploratory or deferred.
 */

import { cre, type Runtime } from "@chainlink/cre-sdk";
import { Runner } from "@chainlink/cre-sdk";
import { PriceFeedUtil } from "./src/utils/price-feed.js";
import { encodeFunctionData, encodeAbiParameters, parseAbi, type Hex } from "viem";

// Workflow configuration
interface LiquidityIntent {
  action: "deposit" | "withdraw" | "rebalance";
  tokenA: string;
  tokenB: string;
  amount: bigint;
  preferredChains: string[];
  riskTolerance: "low" | "medium" | "high";
  minYield: number; // APY %
}

interface AgentConsensus {
  routeOptimizer: {
    recommendedPool: string;
    expectedApy: number;
    impermanentLossRisk: number;
  };
  riskAnalyzer: {
    riskScore: number; // 0-100
    volatilityIndex: number;
    auditStatus: boolean;
  };
  yieldAggregator: {
    optimalAllocation: Record<string, number>;
    projectedYield: number;
  };
}

// ============ On-Chain Action Prep ============

/** Base Sepolia deployed addresses */
const CONTRACTS = {
  HOOK:        "0xC28ed0595D42ec01A2F7546f39Cf27Ea798598C0" as Hex,
  COORDINATOR: "0x268c2E3D23f5cDDAA0D0B40142053414cC05991b" as Hex,
  POOL_MANAGER: "0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408" as Hex,
  // Base Sepolia canonical token addresses
  WETH: "0x4200000000000000000000000000000000000006" as Hex,
  USDC: "0x036CbD53842c5426634e7929541eC2318f3dCF7e" as Hex,
} as const;

/** Convert a USD price to the approximate Uniswap v4 tick.
 *  tick = ln(price) / ln(1.0001)
 *  For USDC/WETH pool: price = USDC per WETH (i.e. ETH/USD)
 *  Since currency0 < currency1 by address order, if USDC < WETH in address space
 *  the pool price = WETH/USDC = 1/ETH_USD_price → tick is negative. */
function priceToTick(usdPrice: number, isToken0Usdc: boolean): number {
  const logBase = Math.log(1.0001);
  if (isToken0Usdc) {
    // token0=USDC, token1=WETH → sqrtPrice = sqrt(ETH/USDC price) = sqrt(1/usdPrice)
    return Math.round(Math.log(1 / usdPrice) / logBase);
  } else {
    // token0=WETH, token1=USDC → sqrtPrice = sqrt(USDC/ETH price) = sqrt(usdPrice)
    return Math.round(Math.log(usdPrice) / logBase);
  }
}

/** Snap a tick to the nearest valid multiple of tickSpacing (rounding toward negative infinity) */
function snapTick(tick: number, spacing: number): number {
  const rem = ((tick % spacing) + spacing) % spacing; // positive remainder
  return tick - rem;
}

/** Choose a half-range in tick units based on risk tolerance */
function getHalfRange(riskTolerance: LiquidityIntent["riskTolerance"]): number {
  if (riskTolerance === "low")    return 600;   // ~±6% price range
  if (riskTolerance === "medium") return 1200;  // ~±12%
  return 2400;                                  // ~±24% for high risk
}

/**
 * Build the calldata for Coordinator.executeLocalHookAction() that will
 * apply the CRE-computed rebalance tick bounds to the AgenticLiquidityHook.
 */
function buildRebalanceCalldata(
  tickLower: number,
  tickUpper: number,
  actionId: Hex
): {
  coordinatorCalldata: Hex;
  tickLower: number;
  tickUpper: number;
  actionId: Hex;
} {
  const TICK_SPACING = 60;
  const POOL_FEE = 3000;

  // Encode PoolKey struct: (currency0, currency1, fee, tickSpacing, hooks)
  const encodedPoolKey = encodeAbiParameters(
    [{
      type: "tuple",
      components: [
        { name: "currency0", type: "address" },
        { name: "currency1", type: "address" },
        { name: "fee",        type: "uint24"  },
        { name: "tickSpacing",type: "int24"   },
        { name: "hooks",      type: "address" },
      ],
    }],
    [{
      currency0:   CONTRACTS.USDC < CONTRACTS.WETH ? CONTRACTS.USDC : CONTRACTS.WETH,
      currency1:   CONTRACTS.USDC < CONTRACTS.WETH ? CONTRACTS.WETH : CONTRACTS.USDC,
      fee:         POOL_FEE,
      tickSpacing: TICK_SPACING,
      hooks:       CONTRACTS.HOOK,
    }]
  );

  // Encode rebalance actionData: abi.encode(int24 tickLower, int24 tickUpper)
  const actionData = encodeAbiParameters(
    [{ name: "tickLower", type: "int24" }, { name: "tickUpper", type: "int24" }],
    [tickLower, tickUpper]
  );

  // Full calldata for Coordinator.executeLocalHookAction(bytes32, string, bytes, bytes)
  const coordinatorCalldata = encodeFunctionData({
    abi: parseAbi([
      "function executeLocalHookAction(bytes32 actionId, string actionType, bytes encodedKey, bytes actionData) returns (bool)"
    ]),
    functionName: "executeLocalHookAction",
    args: [actionId, "rebalance", encodedPoolKey, actionData],
  });

  return { coordinatorCalldata, tickLower, tickUpper, actionId };
}

/**
 * Build calldata for Coordinator.executeLocalHookAction() that sets the
 * dynamic LP fee on the AgenticLiquidityHook based on live volatility.
 */
function buildUpdateFeeCalldata(
  newFee: number,
  actionId: Hex
): {
  coordinatorCalldata: Hex;
  newFee: number;
  actionId: Hex;
} {
  const TICK_SPACING = 60;
  const POOL_FEE = 3000;

  const encodedPoolKey = encodeAbiParameters(
    [{
      type: "tuple",
      components: [
        { name: "currency0", type: "address" },
        { name: "currency1", type: "address" },
        { name: "fee",        type: "uint24"  },
        { name: "tickSpacing",type: "int24"   },
        { name: "hooks",      type: "address" },
      ],
    }],
    [{
      currency0:   CONTRACTS.USDC < CONTRACTS.WETH ? CONTRACTS.USDC : CONTRACTS.WETH,
      currency1:   CONTRACTS.USDC < CONTRACTS.WETH ? CONTRACTS.WETH : CONTRACTS.USDC,
      fee:         POOL_FEE,
      tickSpacing: TICK_SPACING,
      hooks:       CONTRACTS.HOOK,
    }]
  );

  const actionData = encodeAbiParameters(
    [{ name: "newFee", type: "uint24" }],
    [newFee]
  );

  const coordinatorCalldata = encodeFunctionData({
    abi: parseAbi([
      "function executeLocalHookAction(bytes32 actionId, string actionType, bytes encodedKey, bytes actionData) returns (bool)"
    ]),
    functionName: "executeLocalHookAction",
    args: [actionId, "updateFee", encodedPoolKey, actionData],
  });

  return { coordinatorCalldata, newFee, actionId };
}

/**
 * Map annualized volatility (%) to an optimal Uniswap v4 LP fee (in hundredths of a bip).
 *
 * Tiers:
 *   vol < 20%  → 500  (0.05%)  — stable-ish pair
 *   vol < 40%  → 3000 (0.30%)  — normal
 *   vol < 80%  → 5000 (0.50%)  — elevated
 *   vol < 120% → 8000 (0.80%)  — high
 *   vol ≥ 120% → 10000 (1.00%) — extreme
 */
function volatilityToFee(annualizedVol: number): number {
  if (annualizedVol < 20) return 500;
  if (annualizedVol < 40) return 3000;
  if (annualizedVol < 80) return 5000;
  if (annualizedVol < 120) return 8000;
  return 10000;
}

interface WorkflowState {
  intent: LiquidityIntent;
  consensus?: AgentConsensus;
  approved?: boolean;
  executionHash?: string;
  positionId?: string;
  hookAction?: {
    tickLower: number;
    tickUpper: number;
    actionId: Hex;
    coordinatorCalldata: Hex;
    coordinator: Hex;
  };
  feeAction?: {
    newFee: number;
    volatility: number;
    actionId: Hex;
    coordinatorCalldata: Hex;
    coordinator: Hex;
  };
}

// Price feed utility instance
const priceFeed = new PriceFeedUtil();

// Step 1: Intent Analysis
async function analyzeIntent(state: WorkflowState, runtime?: Runtime<Config>): Promise<WorkflowState> {
  console.log("🔍 Analyzing user intent...");

  const intent = state.intent;

  if (!intent.tokenA || !intent.tokenB) throw new Error("Invalid intent: missing token pair");
  if (intent.amount <= 0n) throw new Error("Invalid intent: amount must be positive");

  // Fetch live prices from Chainlink feeds on Base Sepolia via CRE EVMClient
  const [priceA, priceB] = await Promise.all([
    priceFeed.getPrice(intent.tokenA, runtime),
    priceFeed.getPrice(intent.tokenB, runtime),
  ]);

  console.log(`  Token A (${intent.tokenA}) Price: $${priceA}`);
  console.log(`  Token B (${intent.tokenB}) Price: $${priceB}`);
  console.log(`  Action: ${intent.action}`);
  console.log(`  Risk Tolerance: ${intent.riskTolerance}`);

  // ─── Compute optimal tick range for the hook rebalance ───────────────────
  // Determine token ordering in pool (lower address = currency0)
  const isUsdcToken0 = CONTRACTS.USDC.toLowerCase() < CONTRACTS.WETH.toLowerCase();
  const ethUsdPrice  = intent.tokenA.toUpperCase().includes("ETH") ? priceA : priceB;
  const currentTick  = priceToTick(ethUsdPrice, isUsdcToken0);
  const halfRange    = getHalfRange(intent.riskTolerance);
  const TICK_SPACING = 60;
  const tickLower    = snapTick(currentTick - halfRange, TICK_SPACING);
  const tickUpper    = snapTick(currentTick + halfRange, TICK_SPACING);

  console.log(`  ETH/USD price  : $${ethUsdPrice.toFixed(2)}`);
  console.log(`  Approx tick    : ${currentTick}`);
  console.log(`  Optimal range  : [${tickLower}, ${tickUpper}]  (±${halfRange} ticks)`);

  // Build the calldata to send from e2e test to Coordinator.executeLocalHookAction()
  const actionId = `0x${Date.now().toString(16).padStart(64, "0")}` as `0x${string}`;
  const hookAction = buildRebalanceCalldata(tickLower, tickUpper, actionId);

  console.log(`  ACTION_CALLDATA_COORDINATOR: ${CONTRACTS.COORDINATOR}`);
  console.log(`  ACTION_CALLDATA: ${hookAction.coordinatorCalldata}`);
  console.log(`  HOOK_TICK_LOWER: ${tickLower}`);
  console.log(`  HOOK_TICK_UPPER: ${tickUpper}`);

  // ─── Milestone 2: Live Volatility → Dynamic Fee ──────────────────────────
  let feeAction: WorkflowState["feeAction"];
  if (runtime) {
    try {
      const ethSymbol = intent.tokenA.toUpperCase().includes("ETH") ? intent.tokenA : intent.tokenB;
      const volResult = await priceFeed.getVolatility(ethSymbol, runtime, 5);

      const optimalFee = volatilityToFee(volResult.volatility);
      const feeActionId = `0x${(Date.now() + 1).toString(16).padStart(64, "0")}` as `0x${string}`;
      const feeCalldata = buildUpdateFeeCalldata(optimalFee, feeActionId);

      console.log(`  ─── Volatility Oracle ───────────────────────────`);
      console.log(`  VOLATILITY_ANNUALIZED: ${volResult.volatility}%`);
      console.log(`  VOLATILITY_ROUNDS_READ: ${volResult.roundsRead}`);
      console.log(`  OPTIMAL_FEE: ${optimalFee} (${(optimalFee / 10000 * 100).toFixed(2)}%)`);
      console.log(`  FEE_ACTION_CALLDATA: ${feeCalldata.coordinatorCalldata}`);

      feeAction = {
        ...feeCalldata,
        volatility: volResult.volatility,
        coordinator: CONTRACTS.COORDINATOR,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`  ⚠️  Volatility measurement failed: ${msg} — skipping fee update`);
    }
  }

  return {
    ...state,
    intent,
    hookAction: { ...hookAction, coordinator: CONTRACTS.COORDINATOR },
    feeAction,
  };
}

// Step 2: simulation-only strategy coordination used for local planning output
async function coordinateAgents(state: WorkflowState): Promise<WorkflowState> {
  console.log("🤖 Running simulated strategy modules...");

  // Simulation-only coordination helpers for local workflow evaluation.
  // These outputs are synthetic placeholders and not live external orchestration.
  const consensus: AgentConsensus = await Promise.all([
    // Route Optimizer Agent
    callRouteOptimizer(state.intent),
    // Risk Analyzer Agent
    callRiskAnalyzer(state.intent),
    // Yield Aggregator Agent
    callYieldAggregator(state.intent)
  ]).then(([routeOptimizer, riskAnalyzer, yieldAggregator]) => ({
    routeOptimizer,
    riskAnalyzer,
    yieldAggregator
  }));

  console.log(`  ✅ Simulated route optimizer output: Pool ${consensus.routeOptimizer.recommendedPool}`);
  console.log(`  ✅ Simulated risk analyzer output: Score ${consensus.riskAnalyzer.riskScore}/100`);
  console.log(`  ✅ Simulated yield aggregator output: APY ${consensus.yieldAggregator.projectedYield}%`);

  return {
    ...state,
    consensus
  };
}

// Step 3: Risk Assessment
async function assessRisk(state: WorkflowState): Promise<WorkflowState> {
  console.log("⚠️  Assessing risk...");

  const { consensus, intent } = state;

  if (!consensus) {
    throw new Error("Missing agent consensus");
  }

  // Risk thresholds based on user tolerance
  const riskThresholds = {
    low: 30,
    medium: 60,
    high: 85
  };

  const maxRisk = riskThresholds[intent.riskTolerance];
  const riskScore = consensus.riskAnalyzer.riskScore;

  if (riskScore > maxRisk) {
    throw new Error(`Risk score ${riskScore} exceeds tolerance threshold ${maxRisk}`);
  }

  // Check minimum yield requirement
  if (consensus.yieldAggregator.projectedYield < intent.minYield) {
    throw new Error(
      `Projected yield ${consensus.yieldAggregator.projectedYield}% ` +
      `below minimum ${intent.minYield}%`
    );
  }

  console.log(`  ✅ Risk score ${riskScore} within tolerance (${maxRisk})`);
  console.log(`  ✅ Yield ${consensus.yieldAggregator.projectedYield}% meets minimum ${intent.minYield}%`);

  return state;
}

// Step 4: Opportunity Discovery
async function discoverOpportunity(state: WorkflowState): Promise<WorkflowState> {
  console.log("🔎 Discovering optimal opportunity...");

  const { consensus } = state;

  // Fetch additional market data
  const tvl = await fetchPoolTVL(consensus!.routeOptimizer.recommendedPool);
  const volume24h = await fetchPoolVolume(consensus!.routeOptimizer.recommendedPool);

  console.log(`  Pool TVL: $${tvl.toLocaleString()}`);
  console.log(`  24h Volume: $${volume24h.toLocaleString()}`);
  console.log(`  Expected APY: ${consensus!.yieldAggregator.projectedYield}%`);

  return state;
}

// Step 5: simulation-only settlement and execution placeholder handling
async function executeWithPayment(state: WorkflowState): Promise<WorkflowState> {
  console.log("💰 Preparing simulated settlement details...");

  const { consensus, intent } = state;

  // Synthetic settlement amount used only by the local simulation path
  const paymentAmount = calculateExecutionFee(intent.amount);

  // Build a synthetic receipt for the simulation path
  const escrowReceipt = await lockPaymentEscrow({
    amount: paymentAmount,
    beneficiary: consensus!.routeOptimizer.recommendedPool,
    condition: "liquidity-deployment-success"
  });

  console.log(`  💵 Simulated settlement amount: ${paymentAmount} wei`);
  console.log(`  📄 Simulated settlement receipt: ${escrowReceipt.id}`);

  // Produce a synthetic execution reference for downstream simulation steps
  const executionHash = await executeLiquidityDeployment({
    pool: consensus!.routeOptimizer.recommendedPool,
    tokenA: intent.tokenA,
    tokenB: intent.tokenB,
    amount: intent.amount,
    escrowId: escrowReceipt.id
  });

  console.log(`  ✅ Simulated execution reference: ${executionHash}`);

  return {
    ...state,
    executionHash,
    approved: true
  };
}

// Step 6: simulation-only monitoring plus action payload emission
async function monitorPosition(state: WorkflowState): Promise<WorkflowState> {
  console.log("📊 Monitoring simulated position state...");

  const { executionHash } = state;

  const receipt = await waitForConfirmation(executionHash!);
  const positionId = receipt.logs[0].topics[1];

  console.log(`  ✅ Simulated position id: ${positionId}`);

  await scheduleRebalanceCheck(positionId, {
    interval: 3600,
    threshold: 5
  });

  console.log(`  📅 Simulated rebalance schedule created (every hour, 5% threshold)`);

  emitPreparedActionPayloads(state);

  return {
    ...state,
    positionId
  };
}

function emitPreparedActionPayloads(state: WorkflowState): void {
  console.log("");
  console.log("─── Prepared Action Payloads ─────────────────────────────────────────");
  console.log("  These payloads are the current canonical workflow output.");
  console.log("  Submission happens outside this package via operator/test flows.");

  // ─── Emit the CRE → Hook rebalance action payload ───────────────────────
  if (state.hookAction) {
    const { tickLower, tickUpper, coordinatorCalldata, coordinator } = state.hookAction;
    console.log("─── Rebalance Action Ready for On-Chain Submission ──────────────────");
    console.log(`  Coordinator     : ${coordinator}`);
    console.log(`  Tick Lower      : ${tickLower}`);
    console.log(`  Tick Upper      : ${tickUpper}`);
    console.log("──────────────────────────────────────────────────────────────────────");
    console.log(`HOOK_ACTION_COORDINATOR=${coordinator}`);
    console.log(`HOOK_ACTION_CALLDATA=${coordinatorCalldata}`);
    console.log(`HOOK_ACTION_TICK_LOWER=${tickLower}`);
    console.log(`HOOK_ACTION_TICK_UPPER=${tickUpper}`);
  }

  // ─── Emit the CRE → Hook dynamic fee update action payload ─────────────
  if (state.feeAction) {
    const { newFee, volatility, coordinatorCalldata, coordinator } = state.feeAction;
    console.log("─── Dynamic Fee Update Ready for On-Chain Submission ────────────────");
    console.log(`  Coordinator     : ${coordinator}`);
    console.log(`  Volatility      : ${volatility}% annualized`);
    console.log(`  Optimal Fee     : ${newFee} (${(newFee / 10000 * 100).toFixed(2)}%)`);
    console.log("──────────────────────────────────────────────────────────────────────");
    console.log(`FEE_ACTION_COORDINATOR=${coordinator}`);
    console.log(`FEE_ACTION_CALLDATA=${coordinatorCalldata}`);
    console.log(`FEE_ACTION_NEW_FEE=${newFee}`);
    console.log(`FEE_ACTION_VOLATILITY=${volatility}`);
  }
}

// Config type for workflow
interface Config {
  schedule?: string;
  httpTrigger?: { path: string; method: string };
}

// Cron-triggered canonical workflow path.
// Current honest scope: real Chainlink-backed analysis plus action payload preparation only.
const onCronTrigger = async (runtime: Runtime<Config>): Promise<WorkflowState> => {
  // Default demo intent for cron-triggered development/test runs.
  // Keep this aligned with the current canonical scope: rebalance/updateFee payload prep.
  const intent: LiquidityIntent = {
    action: "rebalance",
    tokenA: "WETH",
    tokenB: "USDC",
    amount: 1000000n,
    preferredChains: ["base-sepolia"],
    riskTolerance: "medium",
    minYield: 5
  };

  let state: WorkflowState = { intent };
  state = await analyzeIntent(state, runtime);
  emitPreparedActionPayloads(state);

  return state;
};

const initWorkflow = (config: Config) => {
  const cron = new cre.capabilities.CronCapability();
  const schedule = (config as { schedule?: string }).schedule ?? "*/30 * * * * *";
  return [cre.handler(cron.trigger({ schedule }), onCronTrigger)];
};

export async function main() {
  const runner = await Runner.newRunner<Config>();
  await runner.run(initWorkflow);
}

// Workflow runner for local simulation only (not exported - Javy rejects exported fns with params)
// This deeper flow is intentionally not part of the canonical onCronTrigger path.
async function runLiquidityWorkflow(intent: LiquidityIntent): Promise<WorkflowState> {
  let state: WorkflowState = { intent };
  state = await analyzeIntent(state); // no runtime → mock prices (local-only path)
  state = await coordinateAgents(state);
  state = await assessRisk(state);
  state = await discoverOpportunity(state);
  state = await executeWithPayment(state);
  state = await monitorPosition(state);
  return state;
}

// Simulation-only helper functions below return synthetic values.
// They are placeholders for local evaluation and are not live integrations.
async function callRouteOptimizer(_intent: LiquidityIntent) {
  void _intent;
  // Synthetic route optimizer output for local-only evaluation
  return {
    recommendedPool: `0x${Array(40).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join("")}`,
    expectedApy: 12.5 + Math.random() * 10,
    impermanentLossRisk: Math.random() * 20
  };
}

async function callRiskAnalyzer(_intent: LiquidityIntent) {
  void _intent;
  // Synthetic risk analyzer output for local-only evaluation
  return {
    riskScore: 25 + Math.floor(Math.random() * 40),
    volatilityIndex: Math.random() * 50,
    auditStatus: true
  };
}

async function callYieldAggregator(_intent: LiquidityIntent) {
  // Synthetic yield aggregator output for local-only evaluation
  return {
    optimalAllocation: {
      [_intent.tokenA]: 0.5,
      [_intent.tokenB]: 0.5
    },
    projectedYield: 8 + Math.random() * 15
  };
}

async function fetchPoolTVL(_pool: string): Promise<number> {
  void _pool;
  // Synthetic TVL sample for local-only evaluation
  return 1000000 + Math.floor(Math.random() * 5000000);
}

async function fetchPoolVolume(_pool: string): Promise<number> {
  void _pool;
  // Synthetic volume sample for local-only evaluation
  return 50000 + Math.floor(Math.random() * 500000);
}

function calculateExecutionFee(amount: bigint): bigint {
  // 0.1% fee
  return amount * 100n / 100000n;
}

interface EscrowConfig {
  amount: bigint;
  beneficiary: string;
  condition: string;
}

async function lockPaymentEscrow(config: EscrowConfig) {
  // Synthetic settlement receipt generator used only by the simulation path.
  console.log(`  🔒 Creating simulated settlement receipt: ${config.condition}`);
  return {
    id: `escrow-${Date.now()}`,
    amount: config.amount,
    lockedAt: Date.now()
  };
}

interface DeploymentConfig {
  pool: string;
  tokenA: string;
  tokenB: string;
  amount: bigint;
  escrowId: string;
}

async function executeLiquidityDeployment(config: DeploymentConfig): Promise<string> {
  // Synthetic execution reference generator used only by local workflow simulation.
  console.log(`  🚀 Simulating liquidity deployment to pool ${config.pool.slice(0, 10)}...`);
  return `0x${Array(64).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join("")}`;
}

interface TransactionReceipt {
  status: boolean;
  logs: Array<{
    topics: string[];
  }>;
}

async function waitForConfirmation(_hash: string): Promise<TransactionReceipt> {
  void _hash;
  // Synthetic confirmation used only by the local simulation path.
  return {
    status: true,
    logs: [{
      topics: [`pos-${Date.now()}`, `0x${Array(64).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join("")}`]
    }]
  };
}

interface RebalanceConfig {
  interval: number;
  threshold: number;
}

async function scheduleRebalanceCheck(_positionId: string, config: RebalanceConfig) {
  void _positionId;
  // Placeholder scheduling log for local-only workflow evaluation.
  console.log(`  ⏰ Simulated rebalance schedule (interval: ${config.interval}s, threshold: ${config.threshold}%)`);
}

