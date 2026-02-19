import {
  ILRiskParams,
  ILRiskAssessment,
  PoolRiskProfile,
  LiquidityPool,
  A2AMessage,
  TaskResult,
  YieldOpportunity,
} from './types';

/**
 * Risk Analyzer Agent
 * 
 * Calculates impermanent loss (IL) risk and assesses pool risk profiles.
 * Provides risk scoring for liquidity positions and yield opportunities.
 */

export class RiskAnalyzer {
  private poolHistories: Map<string, PriceHistory> = new Map();
  private riskProfiles: Map<string, PoolRiskProfile> = new Map();
  private volatilityCache: Map<string, number> = new Map();
  private agentId: string = 'risk-analyzer';

  constructor(private config: RiskAnalyzerConfig) {}

  /**
   * Initialize with historical data
   */
  async initialize(): Promise<void> {
    await this.loadHistoricalData();
    this.startMonitoring();
  }

  /**
   * Calculate impermanent loss risk for a position
   */
  calculateILRisk(params: ILRiskParams): ILRiskAssessment {
    const { pool, positionValue, entryPrice, currentPrice, durationDays } = params;

    // Calculate price ratio
    const priceRatio = currentPrice / entryPrice;
    const sqrtRatio = Math.sqrt(priceRatio);

    // Impermanent loss formula: 2√r/(1+r) - 1
    const ilPercent = (2 * sqrtRatio) / (1 + priceRatio) - 1;
    const ilAbsolute = Math.abs(ilPercent);

    // Calculate USD loss
    const estimatedDollarLoss = Number(positionValue) * ilAbsolute;

    // Determine risk level
    let riskLevel: ILRiskAssessment['riskLevel'];
    if (ilAbsolute < 0.02) {
      riskLevel = 'low';
    } else if (ilAbsolute < 0.10) {
      riskLevel = 'medium';
    } else if (ilAbsolute < 0.25) {
      riskLevel = 'high';
    } else {
      riskLevel = 'extreme';
    }

    // Calculate break-even based on fees earned
    const dailyFeeApr = pool.apr / 365;
    const daysToBreakEven = ilAbsolute > 0 ? ilAbsolute / dailyFeeApr : 0;

    // Generate recommendations
    const recommendations = this.generateILRecommendations(
      ilAbsolute,
      daysToBreakEven,
      durationDays,
      pool
    );

    return {
      impermanentLossPercent: ilAbsolute * 100,
      estimatedDollarLoss,
      riskLevel,
      breakEvenDays: Math.ceil(daysToBreakEven),
      hedgingRecommended: ilAbsolute > 0.03,
      recommendations,
    };
  }

  /**
   * Assess risk profile for a liquidity pool
   */
  async assessPoolRisk(pool: LiquidityPool): Promise<PoolRiskProfile> {
    const cached = this.riskProfiles.get(pool.address);
    if (cached && Date.now() - this.lastUpdate < this.config.cacheDurationMs) {
      return cached;
    }

    // Calculate volatility score (0-100)
    const volatilityScore = await this.calculateVolatilityScore(pool);

    // Calculate liquidity risk (0-100)
    const liquidityRisk = this.calculateLiquidityRisk(pool);

    // Smart contract risk based on audits and history
    const smartContractRisk = this.assessSmartContractRisk(pool);

    // Protocol risk based on TVL and reputation
    const protocolRisk = this.assessProtocolRisk(pool);

    // Overall risk score (weighted average)
    const overallRisk = Math.round(
      volatilityScore * 0.35 +
      liquidityRisk * 0.25 +
      smartContractRisk * 0.25 +
      protocolRisk * 0.15
    );

    const profile: PoolRiskProfile = {
      poolAddress: pool.address,
      volatilityScore,
      liquidityRisk,
      smartContractRisk,
      protocolRisk,
      overallRisk,
      auditStatus: this.getAuditStatus(pool.protocol),
    };

    this.riskProfiles.set(pool.address, profile);
    return profile;
  }

  /**
   * Calculate risk-adjusted yield for opportunities
   */
  calculateRiskAdjustedYield(
    opportunity: YieldOpportunity,
    riskProfile: PoolRiskProfile
  ): number {
    // Sharpe-like ratio: (APY - riskFreeRate) / riskScore
    const riskFreeRate = 0.02; // 2% baseline
    const excessReturn = opportunity.apy - riskFreeRate;
    const riskScore = riskProfile.overallRisk / 100;

    return excessReturn / (riskScore + 0.01); // Add small buffer to avoid div by zero
  }

  /**
   * Handle incoming A2A messages
   */
  async handleTask(message: A2AMessage): Promise<TaskResult> {
    const taskType = (message.payload as any).taskType;
    const params = (message.payload as any).params;

    try {
      switch (taskType) {
        case 'analyze-risk':
          if (params.ilParams) {
            const ilRisk = this.calculateILRisk(params.ilParams);
            return {
              taskId: (message.payload as any).taskId,
              status: 'success',
              data: ilRisk,
              completedAt: Date.now(),
            };
          }
          if (params.pool) {
            const poolRisk = await this.assessPoolRisk(params.pool);
            return {
              taskId: (message.payload as any).taskId,
              status: 'success',
              data: poolRisk,
              completedAt: Date.now(),
            };
          }
          throw new Error('Missing risk analysis parameters');

        case 'monitor-il':
          const ilParams = params as ILRiskParams;
          const monitoringResult = this.calculateILRisk(ilParams);
          
          // Emit alert if risk is high
          if (monitoringResult.riskLevel === 'high' || monitoringResult.riskLevel === 'extreme') {
            this.emitRiskAlert(ilParams.pool.address, monitoringResult);
          }

          return {
            taskId: (message.payload as any).taskId,
            status: 'success',
            data: monitoringResult,
            completedAt: Date.now(),
          };

        default:
          return {
            taskId: (message.payload as any).taskId,
            status: 'failure',
            data: null,
            error: `Unknown task type: ${taskType}`,
            completedAt: Date.now(),
          };
      }
    } catch (error) {
      return {
        taskId: (message.payload as any).taskId,
        status: 'failure',
        data: null,
        error: error instanceof Error ? error.message : 'Unknown error',
        completedAt: Date.now(),
      };
    }
  }

  // Private methods

  private async calculateVolatilityScore(pool: LiquidityPool): Promise<number> {
    const cacheKey = `${pool.tokenA.address}-${pool.tokenB.address}`;
    const cached = this.volatilityCache.get(cacheKey);
    if (cached !== undefined) {
      return cached;
    }

    const historyA = this.poolHistories.get(pool.tokenA.address);
    const historyB = this.poolHistories.get(pool.tokenB.address);

    if (!historyA || !historyB) {
      return 50; // Default medium volatility
    }

    // Calculate realized volatility
    const returnsA = this.calculateReturns(historyA.prices);
    const returnsB = this.calculateReturns(historyB.prices);

    const volA = this.standardDeviation(returnsA) * Math.sqrt(365) * 100;
    const volB = this.standardDeviation(returnsB) * Math.sqrt(365) * 100;

    // Combined volatility score (0-100)
    const avgVol = (volA + volB) / 2;
    const score = Math.min(100, avgVol * 2); // Scale: 50% vol = 100 score

    this.volatilityCache.set(cacheKey, score);
    return score;
  }

  private calculateLiquidityRisk(pool: LiquidityPool): number {
    const tvl = Number(pool.tvl);
    const volume24h = Number(pool.volume24h);

    // Factors that increase liquidity risk
    const lowTvlPenalty = tvl < 100000 ? 30 : tvl < 500000 ? 15 : 0;
    const lowVolumePenalty = volume24h < tvl * 0.05 ? 20 : 0;
    const concentrationPenalty = this.assessConcentrationRisk(pool) ? 25 : 0;

    return Math.min(100, lowTvlPenalty + lowVolumePenalty + concentrationPenalty);
  }

  private assessSmartContractRisk(pool: LiquidityPool): number {
    // Base risk scores by protocol reputation
    const protocolRisk: Record<string, number> = {
      'SaucerSwap': 10,
      'Pangolin': 15,
      'HeliSwap': 20,
      'Unknown': 50,
    };

    return protocolRisk[pool.protocol] || 40;
  }

  private assessProtocolRisk(pool: LiquidityPool): number {
    const tvlScore = Math.max(0, 30 - Math.log10(Number(pool.tvl) + 1) * 3);
    const ageScore = this.assessProtocolAge(pool.protocol) ? 10 : 30;
    
    return Math.min(100, tvlScore + ageScore);
  }

  private assessProtocolAge(protocol: string): boolean {
    // Known mature protocols
    const matureProtocols = ['SaucerSwap', 'Pangolin'];
    return matureProtocols.includes(protocol);
  }

  private assessConcentrationRisk(pool: LiquidityPool): boolean {
    // Check if liquidity is too concentrated (simplified)
    // In production, would analyze LPs distribution
    return false;
  }

  private getAuditStatus(protocol: string): PoolRiskProfile['auditStatus'] {
    const auditedProtocols = ['SaucerSwap', 'Pangolin'];
    return auditedProtocols.includes(protocol) ? 'audited' : 'unaudited';
  }

  private generateILRecommendations(
    ilPercent: number,
    daysToBreakEven: number,
    durationDays: number,
    pool: LiquidityPool
  ): string[] {
    const recommendations: string[] = [];

    if (ilPercent > 0.05) {
      recommendations.push('Consider exiting position - IL exceeds 5%');
      recommendations.push('Evaluate hedging with perpetual futures');
    } else if (ilPercent > 0.02) {
      recommendations.push('Monitor position closely - IL approaching 2%');
    }

    if (daysToBreakEven > durationDays * 2) {
      recommendations.push(`Break-even time (${Math.ceil(daysToBreakEven)} days) exceeds expected hold period`);
    }

    if (pool.apr < 0.05) {
      recommendations.push('Low APR may not compensate for IL risk');
    }

    if (recommendations.length === 0) {
      recommendations.push('Position within acceptable risk parameters');
    }

    return recommendations;
  }

  private calculateReturns(prices: number[]): number[] {
    const returns: number[] = [];
    for (let i = 1; i < prices.length; i++) {
      const currentPrice = prices[i];
      const prevPrice = prices[i - 1];
      if (currentPrice !== undefined && prevPrice !== undefined && prevPrice !== 0) {
        returns.push(Math.log(currentPrice / prevPrice));
      }
    }
    return returns;
  }

  private standardDeviation(values: number[]): number {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  }

  private async loadHistoricalData(): Promise<void> {
    // In production, load from database or API
    // Placeholder for historical price data
  }

  private startMonitoring(): void {
    setInterval(async () => {
      // Refresh volatility calculations
      this.volatilityCache.clear();
    }, this.config.monitoringIntervalMs);
  }

  private emitRiskAlert(poolAddress: string, risk: ILRiskAssessment): void {
    // In production, emit event for coordinator
    console.warn(`[RISK ALERT] Pool ${poolAddress}: ${risk.riskLevel.toUpperCase()} IL risk detected`);
  }

  private get lastUpdate(): number {
    return Date.now() - this.config.cacheDurationMs;
  }
}

interface RiskAnalyzerConfig {
  cacheDurationMs: number;
  monitoringIntervalMs: number;
  alertThreshold: number;
}

interface PriceHistory {
  tokenAddress: string;
  prices: number[];
  timestamps: number[];
}
