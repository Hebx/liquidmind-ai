/**
 * LIQUIDMIND A2A Agent Types
 * 
 * Core TypeScript interfaces for the Agent-to-Agent protocol
 * implementing liquidity optimization, risk analysis, and yield aggregation.
 */

// ============================================================================
// Core Agent Types
// ============================================================================

export type AgentRole = 'coordinator' | 'route-optimizer' | 'risk-analyzer' | 'yield-aggregator';

export type AgentStatus = 'idle' | 'busy' | 'error' | 'offline';

export type TaskType = 
  | 'optimize-route'
  | 'analyze-risk'
  | 'aggregate-yield'
  | 'execute-swap'
  | 'rebalance-pool'
  | 'monitor-il'
  | 'fetch-prices';

export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';

export type TaskStatus = 'pending' | 'in-progress' | 'completed' | 'failed';

// ============================================================================
// Agent Identity
// ============================================================================

export interface AgentIdentity {
  id: string;
  name: string;
  role: AgentRole;
  version: string;
  capabilities: string[];
  endpoint?: string;
  publicKey?: string;
}

// ============================================================================
// A2A Protocol Messages
// ============================================================================

export interface A2AMessage {
  id: string;
  from: string;
  to: string;
  type: MessageType;
  payload: unknown;
  timestamp: number;
  signature?: string;
}

export type MessageType = 
  | 'task-request'
  | 'task-response'
  | 'task-result'
  | 'status-query'
  | 'status-response'
  | 'broadcast'
  | 'error';

export interface TaskRequest {
  taskId: string;
  taskType: TaskType;
  priority: TaskPriority;
  deadline?: number;
  params: Record<string, unknown>;
}

export interface TaskResponse {
  taskId: string;
  accepted: boolean;
  estimatedDuration?: number;
  reason?: string;
}

export interface TaskResult {
  taskId: string;
  status: 'success' | 'failure';
  data: unknown;
  error?: string;
  completedAt: number;
}

// ============================================================================
// Liquidity & Routing Types
// ============================================================================

export interface Token {
  address: string;
  symbol: string;
  decimals: number;
  name: string;
  chainId: number;
}

export interface LiquidityPool {
  address: string;
  tokenA: Token;
  tokenB: Token;
  reserveA: bigint;
  reserveB: bigint;
  totalSupply: bigint;
  feeTier: number; // basis points
  protocol: string; // e.g., 'SaucerSwap', 'Pangolin'
  apr: number;
  tvl: bigint;
  volume24h: bigint;
}

export interface Route {
  path: Token[];
  pools: LiquidityPool[];
  expectedOutput: bigint;
  priceImpact: number;
  gasEstimate: bigint;
  totalFee: number;
  slippage: number;
}

export interface RouteOptimizationRequest {
  tokenIn: Token;
  tokenOut: Token;
  amountIn: bigint;
  maxSlippage: number;
  deadline: number;
  preferredProtocols?: string[];
}

export interface RouteOptimizationResult {
  optimalRoute: Route;
  alternatives: Route[];
  confidence: number;
  timestamp: number;
}

// ============================================================================
// Risk Analysis Types
// ============================================================================

export interface ILRiskParams {
  pool: LiquidityPool;
  positionValue: bigint;
  entryPrice: number;
  currentPrice: number;
  durationDays: number;
}

export interface ILRiskAssessment {
  impermanentLossPercent: number;
  estimatedDollarLoss: number;
  riskLevel: 'low' | 'medium' | 'high' | 'extreme';
  breakEvenDays: number;
  hedgingRecommended: boolean;
  recommendations: string[];
}

export interface PoolRiskProfile {
  poolAddress: string;
  volatilityScore: number; // 0-100
  liquidityRisk: number; // 0-100
  smartContractRisk: number; // 0-100
  protocolRisk: number; // 0-100
  overallRisk: number; // 0-100
  auditStatus: 'audited' | 'unaudited' | 'in-review';
  lastIncident?: string;
}

// ============================================================================
// Yield Aggregation Types
// ============================================================================

export interface YieldOpportunity {
  id: string;
  protocol: string;
  pool: LiquidityPool;
  apy: number;
  tvl: bigint;
  rewards: RewardToken[];
  lockupPeriod: number; // days, 0 if none
  depositFee: number;
  withdrawalFee: number;
  harvestFee: number;
  lastUpdated: number;
}

export interface RewardToken {
  token: Token;
  dailyEmission: bigint;
  valuePerDay: number;
}

export interface YieldComparison {
  opportunities: YieldOpportunity[];
  bestApy: YieldOpportunity;
  bestRiskAdjusted: YieldOpportunity;
  timestamp: number;
}

export interface YieldAggregationRequest {
  token: Token;
  minApy?: number;
  maxRisk?: number;
  excludeProtocols?: string[];
}

// ============================================================================
// Agent Configuration
// ============================================================================

export interface AgentConfig {
  agentId: string;
  privateKey: string;
  coordinatorEndpoint: string;
  hederaNetwork: 'mainnet' | 'testnet' | 'previewnet';
  saucerSwapApi: string;
  pangolinApi?: string;
  refreshInterval: number; // ms
  minConfidence: number; // 0-1
  maxSlippage: number; // %
  defaultDeadline: number; // seconds
}

// ============================================================================
// Event Types
// ============================================================================

export interface AgentEvent {
  type: EventType;
  agentId: string;
  timestamp: number;
  data: unknown;
}

export type EventType =
  | 'agent-started'
  | 'agent-stopped'
  | 'task-received'
  | 'task-started'
  | 'task-completed'
  | 'task-failed'
  | 'route-found'
  | 'risk-detected'
  | 'yield-updated'
  | 'error-occurred';

// ============================================================================
// Hedera-Specific Types
// ============================================================================

export interface HederaToken {
  tokenId: string; // 0.0.x format
  address: string; // EVM format
  symbol: string;
  decimals: number;
  isHTS: boolean;
}

export interface SaucerSwapPool {
  id: string;
  token0: HederaToken;
  token1: HederaToken;
  sqrtPriceX96: bigint;
  liquidity: bigint;
  tick: number;
  fee: number;
}
