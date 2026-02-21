/**
 * Agentic Liquidity CRE Workflow
 *
 * Implements the 6-step Chainlink CRE workflow for autonomous liquidity management:
 * 1. Intent Analysis
 * 2. Agent Coordination (A2A)
 * 3. Risk Assessment
 * 4. Opportunity Discovery
 * 5. Execution via x402
 * 6. Monitoring & Rebalancing
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

interface WorkflowState {
  intent: LiquidityIntent;
  consensus?: AgentConsensus;
  approved?: boolean;
  executionHash?: string;
  positionId?: string;
  // On-chain action: CRE-computed tick bounds + ready-to-submit calldata
  hookAction?: {
    tickLower: number;
    tickUpper: number;
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

  return {
    ...state,
    intent,
    hookAction: { ...hookAction, coordinator: CONTRACTS.COORDINATOR },
  };
}

// Step 2: A2A Agent Coordination
async function coordinateAgents(state: WorkflowState): Promise<WorkflowState> {
  console.log("🤖 Coordinating A2A agents...");

  // Simulate A2A agent calls
  // In production, these would be actual HTTP/gRPC calls to agent services
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

  console.log(`  ✅ Route Optimizer: Pool ${consensus.routeOptimizer.recommendedPool}`);
  console.log(`  ✅ Risk Analyzer: Score ${consensus.riskAnalyzer.riskScore}/100`);
  console.log(`  ✅ Yield Aggregator: APY ${consensus.yieldAggregator.projectedYield}%`);

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

// Step 5: Execute via x402 Payment
async function executeWithPayment(state: WorkflowState): Promise<WorkflowState> {
  console.log("💰 Executing with x402 payment...");

  const { consensus, intent } = state;

  // x402 payment escrow
  const paymentAmount = calculateExecutionFee(intent.amount);

  // Lock payment in escrow
  const escrowReceipt = await lockPaymentEscrow({
    amount: paymentAmount,
    beneficiary: consensus!.routeOptimizer.recommendedPool,
    condition: "liquidity-deployment-success"
  });

  console.log(`  💵 Payment locked: ${paymentAmount} wei`);
  console.log(`  📄 Escrow: ${escrowReceipt.id}`);

  // Execute liquidity deployment
  const executionHash = await executeLiquidityDeployment({
    pool: consensus!.routeOptimizer.recommendedPool,
    tokenA: intent.tokenA,
    tokenB: intent.tokenB,
    amount: intent.amount,
    escrowId: escrowReceipt.id
  });

  console.log(`  ✅ Execution: ${executionHash}`);

  return {
    ...state,
    executionHash,
    approved: true
  };
}

// Step 6: Monitor & Rebalance + On-Chain Action Dispatch
async function monitorPosition(state: WorkflowState): Promise<WorkflowState> {
  console.log("📊 Monitoring position...");

  const { executionHash } = state;

  const receipt = await waitForConfirmation(executionHash!);
  const positionId = receipt.logs[0].topics[1];

  console.log(`  ✅ Position created: ${positionId}`);

  await scheduleRebalanceCheck(positionId, {
    interval: 3600,
    threshold: 5
  });

  console.log(`  📅 Rebalancing scheduled every hour (5% threshold)`);

  // ─── Emit the CRE → Hook action payload ────────────────────────────────
  if (state.hookAction) {
    const { tickLower, tickUpper, coordinatorCalldata, coordinator } = state.hookAction;
    console.log("");
    console.log("─── Hook Action Ready for On-Chain Submission ───────────────────────");
    console.log(`  Coordinator     : ${coordinator}`);
    console.log(`  Tick Lower      : ${tickLower}`);
    console.log(`  Tick Upper      : ${tickUpper}`);
    console.log(`  Cast command:`);
    console.log(`  cast send ${coordinator} \\`);
    console.log(`    --data ${coordinatorCalldata} \\`);
    console.log(`    --rpc-url $BASE_SEPOLIA_RPC \\`);
    console.log(`    --private-key $AGENT_PRIVATE_KEY`);
    console.log("──────────────────────────────────────────────────────────────────────");
    // Structured output for e2e script parsing
    console.log(`HOOK_ACTION_COORDINATOR=${coordinator}`);
    console.log(`HOOK_ACTION_CALLDATA=${coordinatorCalldata}`);
    console.log(`HOOK_ACTION_TICK_LOWER=${tickLower}`);
    console.log(`HOOK_ACTION_TICK_UPPER=${tickUpper}`);
  }

  return {
    ...state,
    positionId
  };
}

// Config type for workflow
interface Config {
  schedule?: string;
  httpTrigger?: { path: string; method: string };
}

// Cron-triggered liquidity workflow (Runner pattern)
const onCronTrigger = async (runtime: Runtime<Config>): Promise<WorkflowState> => {
  // Default demo intent for cron-triggered runs
  const intent: LiquidityIntent = {
    action: "deposit",
    tokenA: "WETH",
    tokenB: "USDC",
    amount: 1000000n,
    preferredChains: ["base-sepolia"],
    riskTolerance: "medium",
    minYield: 5
  };

  let state: WorkflowState = { intent };
  state = await analyzeIntent(state, runtime);
  state = await coordinateAgents(state);
  state = await assessRisk(state);
  state = await discoverOpportunity(state);
  state = await executeWithPayment(state);
  state = await monitorPosition(state);

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

// Workflow runner for local simulation (not exported - Javy rejects exported fns with params)
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

// Helper functions (would be implemented with actual services)
async function callRouteOptimizer(_intent: LiquidityIntent) {
  void _intent;
  // In production: HTTP call to route-optimizer agent
  return {
    recommendedPool: `0x${Array(40).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join("")}`,
    expectedApy: 12.5 + Math.random() * 10,
    impermanentLossRisk: Math.random() * 20
  };
}

async function callRiskAnalyzer(_intent: LiquidityIntent) {
  void _intent;
  // In production: HTTP call to risk-analyzer agent
  return {
    riskScore: 25 + Math.floor(Math.random() * 40),
    volatilityIndex: Math.random() * 50,
    auditStatus: true
  };
}

async function callYieldAggregator(_intent: LiquidityIntent) {
  // In production: HTTP call to yield-aggregator agent
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
  // In production: Subgraph or RPC call
  return 1000000 + Math.floor(Math.random() * 5000000);
}

async function fetchPoolVolume(_pool: string): Promise<number> {
  void _pool;
  // In production: Subgraph or RPC call
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
  // In production: x402 protocol integration
  console.log(`  🔒 Locking payment escrow: ${config.condition}`);
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
  // In production: CCIP + Uniswap v4 hook execution
  console.log(`  🚀 Deploying liquidity to pool ${config.pool.slice(0, 10)}...`);
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
  // In production: Poll for transaction receipt (CRE WASM has no setTimeout)
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
  // In production: Chainlink Automation integration
  console.log(`  ⏰ Rebalancing scheduled (interval: ${config.interval}s, threshold: ${config.threshold}%)`);
}

