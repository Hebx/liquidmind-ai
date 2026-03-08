/**
 * Agentic Liquidity CRE Workflow
 *
 * Current milestone workflow for:
 * 1. Interpreting liquidity intent inputs
 * 2. Computing tick and fee guidance from market data
 * 3. Preparing a canonical rebalance payload for Base Sepolia coordinator execution
 *
 * Notes:
 * - Real Chainlink price and historical round reads are part of the live path.
 * - The workflow may also emit an updateFee sidecar action from live volatility analysis.
 * - HTTP-triggered intent ingestion shares the same canonical payload shape as local simulation.
 * - A2A, x402, and broader cross-chain execution remain exploratory or deferred.
 */

import { cre, handler, httpTrigger, type Runtime, Runner } from "@chainlink/cre-sdk";
import {
  type CanonicalWorkflowWarning,
  type PreparedFeeAction,
  type PreparedHookAction,
} from "./src/canonical-preparation";
import {
  executeCanonicalHttpWorkflow,
  prepareCanonicalHttpWorkflow,
} from "./src/canonical-intent-workflow.js";
import { PriceFeedUtil } from "./src/utils/price-feed.js";
import {
  DEFAULT_DEVELOPMENT_INTENT,
  normalizeWorkflowIntentInput,
  toIntentPayload,
  type LiquidityIntent,
  type LiquidityIntentPayload,
} from "./src/lib/intent.js";
import type { Hex } from "viem";

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

interface WorkflowState {
  intent: LiquidityIntent;
  consensus?: AgentConsensus;
  approved?: boolean;
  executionHash?: string;
  positionId?: string;
  hookAction?: PreparedHookAction;
  feeAction?: PreparedFeeAction;
  warnings?: CanonicalWorkflowWarning[];
}

interface TransportWorkflowState extends Omit<WorkflowState, "intent"> {
  intent: LiquidityIntentPayload;
}

// Price feed utility instance
const priceFeed = new PriceFeedUtil();

function createCanonicalMarketDataReader(runtime?: Runtime<Config>) {
  return {
    getPrice: (tokenAddressOrSymbol: string) => priceFeed.getPrice(tokenAddressOrSymbol, runtime),
    getVolatility: (symbol: string, numRounds: number = 5) => {
      if (!runtime) {
        throw new Error("Volatility reads require CRE runtime.");
      }

      return priceFeed.getVolatility(symbol, runtime, numRounds);
    },
  };
}

// Step 1: Intent Analysis
async function analyzeIntent(state: WorkflowState, runtime?: Runtime<Config>): Promise<WorkflowState> {
  console.log("🔍 Analyzing user intent...");

  const { intent, workflow, diagnostics } = await prepareCanonicalHttpWorkflow(state.intent, {
    marketDataReader: createCanonicalMarketDataReader(runtime),
  });

  console.log(`  Token A (${intent.tokenA}) Price: $${diagnostics.priceA}`);
  console.log(`  Token B (${intent.tokenB}) Price: $${diagnostics.priceB}`);
  console.log(`  Action: ${intent.action}`);
  console.log(`  Risk Tolerance: ${intent.riskTolerance}`);
  console.log(`  ETH/USD price  : $${diagnostics.ethUsdPrice.toFixed(2)}`);
  console.log(`  Approx tick    : ${diagnostics.currentTick}`);
  console.log(
    `  Optimal range  : [${workflow.hookAction.tickLower}, ${workflow.hookAction.tickUpper}]  ` +
      `(±${diagnostics.halfRange} ticks)`,
  );
  console.log(`  ACTION_CALLDATA_COORDINATOR: ${workflow.hookAction.coordinator}`);
  console.log(`  ACTION_CALLDATA: ${workflow.hookAction.coordinatorCalldata}`);
  console.log(`  HOOK_TICK_LOWER: ${workflow.hookAction.tickLower}`);
  console.log(`  HOOK_TICK_UPPER: ${workflow.hookAction.tickUpper}`);

  if (workflow.feeAction) {
    console.log(
      `  OPTIMAL_FEE: ${workflow.feeAction.newFee} ` +
        `(${((workflow.feeAction.newFee / 10000) * 100).toFixed(2)}%)`,
    );
    console.log(`  FEE_ACTION_CALLDATA: ${workflow.feeAction.coordinatorCalldata}`);
  }

  if (workflow.warnings) {
    for (const warning of workflow.warnings) {
      console.log(`  ⚠️  ${warning.message}`);
    }
  }

  return {
    ...state,
    intent,
    hookAction: workflow.hookAction,
    feeAction: workflow.feeAction,
    warnings: workflow.warnings,
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

  if (state.warnings) {
    for (const warning of state.warnings) {
      console.log(`  WARNING: ${warning.code} - ${warning.message}`);
    }
  }

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

async function runCanonicalWorkflow(
  intentInput: unknown,
  runtime?: Runtime<Config>,
  options: { fallbackToDefault?: boolean } = {},
): Promise<WorkflowState> {
  const intent = normalizeWorkflowIntentInput(intentInput, {
    fallbackToDefault: options.fallbackToDefault,
  });

  let state: WorkflowState = { intent };
  state = await analyzeIntent(state, runtime);
  emitPreparedActionPayloads(state);
  return state;
}

function toTransportWorkflowState(state: WorkflowState): TransportWorkflowState {
  return {
    ...state,
    intent: toIntentPayload(state.intent),
  };
}

// HTTP-triggered canonical workflow path.
// Current honest scope: real Chainlink-backed analysis plus action payload preparation only.
// This handler intentionally delegates to `executeCanonicalHttpWorkflow`, which
// is the same shared HTTP entry surface used by the Next.js route.
const onHttpTrigger = async (
  runtime: Runtime<Config>,
  request: unknown,
): Promise<TransportWorkflowState> =>
  executeCanonicalHttpWorkflow(request, {
    marketDataReader: createCanonicalMarketDataReader(runtime),
  });

// Cron-triggered development fallback path.
const onCronTrigger = async (runtime: Runtime<Config>): Promise<WorkflowState> =>
  runCanonicalWorkflow(DEFAULT_DEVELOPMENT_INTENT, runtime, { fallbackToDefault: true });

const initWorkflow = (config: Config) => {
  const cron = new cre.capabilities.CronCapability();
  const schedule = (config as { schedule?: string }).schedule ?? "*/30 * * * * *";
  const triggerConfig = config.httpTrigger ?? { path: "/intent", method: "POST" };

  return [
    handler(httpTrigger.trigger(triggerConfig), onHttpTrigger),
    handler(cron.trigger({ schedule }), onCronTrigger),
  ];
};

export async function main() {
  const runner = await Runner.newRunner<Config>();
  await runner.run(initWorkflow);
}

// Workflow runner for local simulation only (not exported - Javy rejects exported fns with params)
// This deeper flow is intentionally not part of the canonical onCronTrigger path.
async function runLiquidityWorkflow(intentInput: unknown): Promise<WorkflowState> {
  const intent = normalizeWorkflowIntentInput(intentInput, { fallbackToDefault: true });
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

