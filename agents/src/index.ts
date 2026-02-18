/**
 * LIQUIDMIND A2A Agents
 * 
 * Multi-agent system for decentralized liquidity optimization on Hedera.
 * 
 * @module @liquidmind/agents
 */

// Core Types
export * from './types';

// Agent Implementations
export { AgentCoordinator } from './coordinator';
export { RouteOptimizer } from './route-optimizer';
export { RiskAnalyzer } from './risk-analyzer';
export { YieldAggregator } from './yield-aggregator';

// Version
export const VERSION = '0.1.0';

// Default exports for convenience
export { AgentCoordinator as Coordinator } from './coordinator';
export { RouteOptimizer as Router } from './route-optimizer';
export { RiskAnalyzer as RiskEngine } from './risk-analyzer';
export { YieldAggregator as YieldEngine } from './yield-aggregator';
