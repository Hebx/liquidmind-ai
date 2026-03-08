/**
 * Legacy Mock Workflow for Local Demo Testing
 *
 * This file is retained only for local/demo scenarios.
 * It is NOT the canonical LiquidMind CRE validation path and should NOT be
 * treated as evidence for the live milestone implementation.
 *
 * It simulates the full 6-step workflow without:
 * - Real blockchain transactions
 * - Actual A2A agent calls
 * - Real x402 payments
 *
 * Prefer `npm run validate:real` for the canonical CRE workflow validation step.
 */

import { PriceFeedUtil, formatPrice, calculateUsdValue } from "./utils/price-feed.js";

// Mock state
interface MockState {
  step: number;
  intent: {
    action: "deposit" | "withdraw" | "rebalance";
    tokenA: string;
    tokenB: string;
    amount: bigint;
    riskTolerance: "low" | "medium" | "high";
    minYield: number;
  };
  prices: {
    tokenA: number;
    tokenB: number;
  };
  consensus?: {
    routeOptimizer: {
      recommendedPool: string;
      expectedApy: number;
    };
    riskAnalyzer: {
      riskScore: number;
    };
    yieldAggregator: {
      projectedYield: number;
    };
  };
  executionHash?: string;
  positionId?: string;
}

// Colors for terminal output
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m"
};

function log(title: string, message: string, color: keyof typeof colors = "reset") {
  console.log(`${colors[color]}${colors.bright}${title}${colors.reset} ${message}`);
}

function logDetail(label: string, value: string) {
  console.log(`  ${colors.dim}${label}:${colors.reset} ${value}`);
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// Step 1: Intent Analysis
// ============================================================================
async function step1IntentAnalysis(state: MockState): Promise<MockState> {
  log("\n🔍 STEP 1:", "Intent Analysis", "blue");
  console.log("─".repeat(50));
  
  const priceFeed = new PriceFeedUtil();
  
  // Get prices
  const priceA = await priceFeed.getPrice(state.intent.tokenA);
  const priceB = await priceFeed.getPrice(state.intent.tokenB);
  
  const usdValue = calculateUsdValue(state.intent.amount, 18, priceA);
  
  logDetail("Action", state.intent.action.toUpperCase());
  logDetail("Token A", `${state.intent.tokenA.slice(0, 10)}... (${formatPrice(priceA)})`);
  logDetail("Token B", `${state.intent.tokenB.slice(0, 10)}... (${formatPrice(priceB)})`);
  logDetail("Amount", `${(Number(state.intent.amount) / 1e18).toFixed(4)} tokens`);
  logDetail("USD Value", formatPrice(usdValue));
  logDetail("Risk Tolerance", state.intent.riskTolerance);
  logDetail("Min Yield Required", `${state.intent.minYield}%`);
  
  // Validate
  await sleep(500);
  log("✓", "Intent validated successfully", "green");
  
  return {
    ...state,
    prices: { tokenA: priceA, tokenB: priceB }
  };
}

// ============================================================================
// Step 2: A2A Agent Coordination
// ============================================================================
async function step2AgentCoordination(state: MockState): Promise<MockState> {
  log("\n🤖 STEP 2:", "A2A Agent Coordination", "magenta");
  console.log("─".repeat(50));
  
  // Simulate agent calls
  console.log("  📡 Calling Route Optimizer Agent...");
  await sleep(800);
  const routeOptimizer = {
    recommendedPool: `0x${Array(40).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join("")}`,
    expectedApy: 12.5 + Math.random() * 8,
    impermanentLossRisk: Math.random() * 15
  };
  logDetail("Recommended Pool", `${routeOptimizer.recommendedPool.slice(0, 16)}...`);
  logDetail("Expected APY", `${routeOptimizer.expectedApy.toFixed(2)}%`);
  
  console.log("  📡 Calling Risk Analyzer Agent...");
  await sleep(600);
  const riskAnalyzer = {
    riskScore: 20 + Math.floor(Math.random() * 40),
    volatilityIndex: Math.random() * 30,
    auditStatus: true
  };
  logDetail("Risk Score", `${riskAnalyzer.riskScore}/100`);
  logDetail("Volatility Index", riskAnalyzer.volatilityIndex.toFixed(2));
  logDetail("Audit Status", riskAnalyzer.auditStatus ? "✅ Passed" : "❌ Failed");
  
  console.log("  📡 Calling Yield Aggregator Agent...");
  await sleep(700);
  const yieldAggregator = {
    optimalAllocation: { [state.intent.tokenA]: 0.5, [state.intent.tokenB]: 0.5 },
    projectedYield: 8 + Math.random() * 12
  };
  logDetail("Projected Yield", `${yieldAggregator.projectedYield.toFixed(2)}%`);
  logDetail("Allocation", `50/50 split`);
  
  log("✓", "A2A consensus reached", "green");
  
  return {
    ...state,
    consensus: {
      routeOptimizer: { 
        recommendedPool: routeOptimizer.recommendedPool, 
        expectedApy: routeOptimizer.expectedApy 
      },
      riskAnalyzer: { riskScore: riskAnalyzer.riskScore },
      yieldAggregator: { projectedYield: yieldAggregator.projectedYield }
    }
  };
}

// ============================================================================
// Step 3: Risk Assessment
// ============================================================================
async function step3RiskAssessment(state: MockState): Promise<MockState> {
  log("\n⚠️  STEP 3:", "Risk Assessment", "yellow");
  console.log("─".repeat(50));
  
  const { consensus, intent } = state;
  
  if (!consensus) {
    throw new Error("Missing agent consensus");
  }
  
  const riskThresholds = { low: 30, medium: 60, high: 85 };
  const maxRisk = riskThresholds[intent.riskTolerance];
  const riskScore = consensus.riskAnalyzer.riskScore;
  
  logDetail("Risk Score", `${riskScore}/100`);
  logDetail("Risk Tolerance", `${intent.riskTolerance} (max: ${maxRisk})`);
  
  if (riskScore > maxRisk) {
    log("✗", `Risk score ${riskScore} exceeds threshold ${maxRisk}`, "red");
    throw new Error("Risk assessment failed");
  }
  
  logDetail("Yield Check", `${consensus.yieldAggregator.projectedYield.toFixed(2)}% >= ${intent.minYield}%`);
  
  if (consensus.yieldAggregator.projectedYield < intent.minYield) {
    log("✗", "Yield below minimum requirement", "red");
    throw new Error("Yield requirement not met");
  }
  
  await sleep(400);
  log("✓", "All risk checks passed", "green");
  
  return state;
}

// ============================================================================
// Step 4: Opportunity Discovery
// ============================================================================
async function step4OpportunityDiscovery(state: MockState): Promise<MockState> {
  log("\n🔎 STEP 4:", "Opportunity Discovery", "cyan");
  console.log("─".repeat(50));
  
  const { consensus } = state;
  
  // Simulate fetching pool data
  console.log("  📊 Fetching pool analytics...");
  await sleep(600);
  
  const tvl = 1000000 + Math.floor(Math.random() * 5000000);
  const volume24h = 50000 + Math.floor(Math.random() * 500000);
  const feeTier = [0.05, 0.3, 1][Math.floor(Math.random() * 3)];
  
  logDetail("Pool TVL", `$${tvl.toLocaleString()}`);
  logDetail("24h Volume", `$${volume24h.toLocaleString()}`);
  logDetail("Fee Tier", `${feeTier}%`);
  logDetail("Expected APY", `${consensus!.yieldAggregator.projectedYield.toFixed(2)}%`);
  
  // Calculate impermanent loss estimate
  const ilEstimate = Math.random() * 2;
  logDetail("Est. IL (30d)", `${ilEstimate.toFixed(2)}%`);
  
  await sleep(300);
  log("✓", "Opportunity validated", "green");
  
  return state;
}

// ============================================================================
// Step 5: x402 Execution
// ============================================================================
async function step5ExecutePayment(state: MockState): Promise<MockState> {
  log("\n💰 STEP 5:", "x402 Payment & Execution", "green");
  console.log("─".repeat(50));
  
  const { consensus, intent } = state;
  
  // Calculate payment
  const paymentAmount = intent.amount * 10n / 10000n; // 0.1% fee
  
  console.log("  🔒 Locking payment in x402 escrow...");
  await sleep(800);
  
  const escrowId = `escrow-${Date.now()}`;
  logDetail("Escrow ID", escrowId);
  logDetail("Payment Amount", `${(Number(paymentAmount) / 1e18).toFixed(6)} ETH`);
  logDetail("Condition", "liquidity-deployment-success");
  
  console.log("  🚀 Executing cross-chain transaction...");
  await sleep(1000);
  
  const executionHash = `0x${Array(64).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join("")}`;
  logDetail("Tx Hash", `${executionHash.slice(0, 20)}...`);
  
  console.log("  ⏳ Waiting for confirmation...");
  await sleep(1000);
  
  log("✓", "Execution confirmed", "green");
  
  return {
    ...state,
    executionHash
  };
}

// ============================================================================
// Step 6: Monitoring & Rebalancing
// ============================================================================
async function step6MonitorRebalance(state: MockState): Promise<MockState> {
  log("\n📊 STEP 6:", "Monitoring & Rebalancing", "blue");
  console.log("─".repeat(50));
  
  console.log("  📡 Setting up Chainlink Automation...");
  await sleep(600);
  
  const positionId = `pos-${Date.now()}`;
  logDetail("Position ID", positionId);
  logDetail("Check Interval", "1 hour");
  logDetail("Rebalance Threshold", "5% drift");
  logDetail("Stop Loss", "15%");
  
  console.log("  📈 Monitoring active");
  await sleep(400);
  
  log("✓", "Monitoring configured successfully", "green");
  
  return {
    ...state,
    positionId
  };
}

// ============================================================================
// Main Workflow Runner
// ============================================================================
async function runMockWorkflow(): Promise<void> {
  console.clear();
  log("🚀", "LiquidMind CRE Workflow - LEGACY MOCK MODE", "cyan");
  console.log("=".repeat(50));
  console.log(`${colors.dim}Legacy local demo only. This does not validate the canonical CRE workflow path.${colors.reset}`);
  console.log(`${colors.dim}No real transactions or live milestone execution occur here.${colors.reset}`);
  console.log("=".repeat(50));
  
  // Initial state
  const initialState: MockState = {
    step: 0,
    intent: {
      action: "deposit",
      tokenA: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
      tokenB: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // USDC
      amount: BigInt("1000000000000000000"), // 1 ETH
      riskTolerance: "medium",
      minYield: 5
    },
    prices: { tokenA: 0, tokenB: 0 }
  };
  
  const startTime = Date.now();
  
  try {
    // Run all steps
    let state = await step1IntentAnalysis(initialState);
    state = await step2AgentCoordination(state);
    state = await step3RiskAssessment(state);
    state = await step4OpportunityDiscovery(state);
    state = await step5ExecutePayment(state);
    state = await step6MonitorRebalance(state);
    
    // Success summary
    const duration = Date.now() - startTime;
    
    console.log("\n" + "=".repeat(50));
    log("✅", "LEGACY MOCK WORKFLOW COMPLETED", "green");
    console.log("=".repeat(50));
    
    logDetail("Execution Time", `${duration}ms`);
    logDetail("Position ID", state.positionId!);
    logDetail("Tx Hash", `${state.executionHash!.slice(0, 20)}...`);
    logDetail("Entry Price (Token A)", formatPrice(state.prices.tokenA));
    logDetail("Entry Price (Token B)", formatPrice(state.prices.tokenB));
    logDetail("Projected APY", `${state.consensus!.yieldAggregator.projectedYield.toFixed(2)}%`);
    logDetail("Risk Score", `${state.consensus!.riskAnalyzer.riskScore}/100`);
    
    console.log("\n" + colors.dim + "Reminder:" + colors.reset);
    console.log("  • This output is local demo data only");
    console.log("  • Use npm run validate:real for the canonical CRE validation step");
    console.log("  • Do not treat this mock output as live milestone evidence");
    
  } catch (error) {
    console.log("\n" + "=".repeat(50));
    log("❌", "WORKFLOW FAILED", "red");
    console.log("=".repeat(50));
    console.error(error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runMockWorkflow().catch(console.error);
}

export { runMockWorkflow };
export type { MockState };
