import {
  YieldOpportunity,
  YieldComparison,
  YieldAggregationRequest,
  Token,
  LiquidityPool,
  A2AMessage,
  TaskResult,
  RewardToken,
} from './types';

/**
 * Yield Aggregator Agent
 * 
 * Fetches and aggregates yield data from multiple DeFi protocols on Hedera.
 * Provides normalized yield comparisons and opportunity discovery.
 */

export class YieldAggregator {
  private opportunities: Map<string, YieldOpportunity> = new Map();
  private tokenPrices: Map<string, number> = new Map();
  private protocols: string[] = ['SaucerSwap', 'Pangolin', 'HeliSwap'];
  private agentId: string = 'yield-aggregator';

  constructor(private config: YieldAggregatorConfig) {}

  /**
   * Initialize and start data fetching
   */
  async initialize(): Promise<void> {
    await this.fetchAllYields();
    this.startPeriodicRefresh();
  }

  /**
   * Get yield opportunities for a specific token
   */
  async getYieldOpportunities(
    request: YieldAggregationRequest
  ): Promise<YieldComparison> {
    const { token, minApy, maxRisk, excludeProtocols } = request;

    // Refresh if data is stale
    if (this.isDataStale()) {
      await this.fetchAllYields();
    }

    // Filter opportunities
    let filtered = Array.from(this.opportunities.values()).filter((opp) => {
      const hasToken =
        opp.pool.tokenA.address === token.address ||
        opp.pool.tokenB.address === token.address;
      const meetsMinApy = minApy === undefined || opp.apy >= minApy;
      const notExcluded =
        !excludeProtocols || !excludeProtocols.includes(opp.protocol);

      return hasToken && meetsMinApy && notExcluded;
    });

    // Sort by APY descending
    filtered.sort((a, b) => b.apy - a.apy);

    const bestApy = filtered[0];
    const bestRiskAdjusted = this.findBestRiskAdjusted(filtered);

    return {
      opportunities: filtered,
      bestApy,
      bestRiskAdjusted,
      timestamp: Date.now(),
    };
  }

  /**
   * Get all yield opportunities across protocols
   */
  async getAllOpportunities(): Promise<YieldOpportunity[]> {
    if (this.isDataStale()) {
      await this.fetchAllYields();
    }
    return Array.from(this.opportunities.values()).sort((a, b) => b.apy - a.apy);
  }

  /**
   * Calculate total APY including reward tokens
   */
  calculateTotalApy(opportunity: YieldOpportunity): number {
    let totalApy = opportunity.apy;

    // Add reward token yields
    for (const reward of opportunity.rewards) {
      const rewardValue = reward.valuePerDay * 365;
      const rewardApy = rewardValue / Number(opportunity.pool.tvl);
      totalApy += rewardApy;
    }

    // Account for fees
    totalApy -= opportunity.depositFee + opportunity.withdrawalFee;

    return totalApy;
  }

  /**
   * Handle incoming A2A messages
   */
  async handleTask(message: A2AMessage): Promise<TaskResult> {
    const taskType = (message.payload as any).taskType;
    const params = (message.payload as any).params;

    try {
      switch (taskType) {
        case 'aggregate-yield':
          const comparison = await this.getYieldOpportunities(
            params as YieldAggregationRequest
          );
          return {
            taskId: (message.payload as any).taskId,
            status: 'success',
            data: comparison,
            completedAt: Date.now(),
          };

        case 'fetch-prices':
          const prices = await this.fetchTokenPrices(params.tokens);
          return {
            taskId: (message.payload as any).taskId,
            status: 'success',
            data: prices,
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

  private async fetchAllYields(): Promise<void> {
    const allOpportunities: YieldOpportunity[] = [];

    for (const protocol of this.protocols) {
      try {
        const opportunities = await this.fetchProtocolYields(protocol);
        allOpportunities.push(...opportunities);
      } catch (error) {
        console.error(`Failed to fetch yields from ${protocol}:`, error);
      }
    }

    // Update opportunities map
    this.opportunities.clear();
    for (const opp of allOpportunities) {
      this.opportunities.set(opp.id, opp);
    }

    this.lastUpdate = Date.now();

    // Emit yield updated event
    this.emitYieldUpdated(allOpportunities.length);
  }

  private async fetchProtocolYields(protocol: string): Promise<YieldOpportunity[]> {
    switch (protocol) {
      case 'SaucerSwap':
        return this.fetchSaucerSwapYields();
      case 'Pangolin':
        return this.fetchPangolinYields();
      case 'HeliSwap':
        return this.fetchHeliSwapYields();
      default:
        return [];
    }
  }

  private async fetchSaucerSwapYields(): Promise<YieldOpportunity[]> {
    const response = await fetch(`${this.config.saucerSwapApi}/pools`);
    const pools: SaucerSwapPool[] = await response.json();

    return pools.map((pool) => this.transformSaucerSwapPool(pool));
  }

  private async fetchPangolinYields(): Promise<YieldOpportunity[]> {
    // Placeholder for Pangolin integration
    return [];
  }

  private async fetchHeliSwapYields(): Promise<YieldOpportunity[]> {
    // Placeholder for HeliSwap integration
    return [];
  }

  private transformSaucerSwapPool(pool: SaucerSwapPool): YieldOpportunity {
    const id = `saucerswap-${pool.id}`;

    // Calculate APY from fee APR and rewards
    const feeApr = this.calculateFeeApr(pool);
    const rewardApr = this.calculateRewardApr(pool);
    const totalApy = (1 + feeApr) * (1 + rewardApr) - 1;

    return {
      id,
      protocol: 'SaucerSwap',
      pool: {
        address: pool.id,
        tokenA: {
          address: pool.token0.address,
          symbol: pool.token0.symbol,
          decimals: pool.token0.decimals,
          name: pool.token0.symbol,
          chainId: 295, // Hedera mainnet
        },
        tokenB: {
          address: pool.token1.address,
          symbol: pool.token1.symbol,
          decimals: pool.token1.decimals,
          name: pool.token1.symbol,
          chainId: 295,
        },
        reserveA: BigInt(pool.liquidity.toString()), // Simplified
        reserveB: BigInt(pool.liquidity.toString()),
        totalSupply: BigInt(pool.liquidity.toString()),
        feeTier: pool.fee,
        protocol: 'SaucerSwap',
        apr: feeApr,
        tvl: this.estimateTvl(pool),
        volume24h: BigInt(0), // Would need separate API call
      },
      apy: totalApy,
      tvl: this.estimateTvl(pool),
      rewards: this.extractRewards(pool),
      lockupPeriod: 0, // SaucerSwap has no lockup
      depositFee: 0,
      withdrawalFee: 0,
      harvestFee: 0,
      lastUpdated: Date.now(),
    };
  }

  private calculateFeeApr(pool: SaucerSwapPool): number {
    // Simplified calculation - in production would use actual volume data
    const feeRate = pool.fee / 10000;
    // Estimate based on typical DEX turnover
    const estimatedTurnover = 0.1; // 10% daily
    return feeRate * estimatedTurnover * 365;
  }

  private calculateRewardApr(pool: SaucerSwapPool): number {
    // Would fetch actual reward emissions
    // Placeholder - SaucerSwap has SAUCE rewards
    return 0.05; // 5% estimated
  }

  private estimateTvl(pool: SaucerSwapPool): bigint {
    // Estimate TVL from liquidity and price
    // Simplified - would need actual token prices
    return BigInt(pool.liquidity.toString()) * BigInt(2);
  }

  private extractRewards(pool: SaucerSwapPool): RewardToken[] {
    // Would extract actual reward tokens from protocol
    // Placeholder for SAUCE rewards
    return [
      {
        token: {
          address: '0.0.1463300', // SAUCE token
          symbol: 'SAUCE',
          decimals: 6,
          name: 'SAUCE',
          chainId: 295,
        },
        dailyEmission: BigInt(10000000000), // Placeholder
        valuePerDay: 1000, // Placeholder
      },
    ];
  }

  private findBestRiskAdjusted(opportunities: YieldOpportunity[]): YieldOpportunity {
    // Simple risk adjustment: APY * (TVL factor)
    // Higher TVL = lower risk
    const scored = opportunities.map((opp) => ({
      opp,
      score: opp.apy * Math.min(1, Math.log10(Number(opp.tvl) + 1) / 6),
    }));

    scored.sort((a, b) => b.score - a.score);
    return scored[0]?.opp || opportunities[0];
  }

  private async fetchTokenPrices(tokens: Token[]): Promise<Map<string, number>> {
    const prices = new Map<string, number>();

    for (const token of tokens) {
      const price = await this.fetchTokenPrice(token);
      prices.set(token.address, price);
    }

    return prices;
  }

  private async fetchTokenPrice(token: Token): Promise<number> {
    // Check cache first
    const cached = this.tokenPrices.get(token.address);
    if (cached && Date.now() - this.lastUpdate < 300000) {
      // 5 min cache
      return cached;
    }

    // In production, fetch from price oracle
    // For now, return mock prices for known tokens
    const mockPrices: Record<string, number> = {
      '0.0.1463300': 0.15, // SAUCE
      '0.0.4556315': 0.5, // HBARX
      '0.0.731861': 6.5, // USDC
      '0.0.456858': 6.5, // USDT
    };

    const price = mockPrices[token.address] || 1.0;
    this.tokenPrices.set(token.address, price);
    return price;
  }

  private startPeriodicRefresh(): void {
    setInterval(() => {
      this.fetchAllYields();
    }, this.config.refreshIntervalMs);
  }

  private isDataStale(): boolean {
    return Date.now() - this.lastUpdate > this.config.stalenessThresholdMs;
  }

  private emitYieldUpdated(count: number): void {
    // In production, emit event for coordinator
    console.log(`[YIELD] Updated ${count} yield opportunities`);
  }

  private lastUpdate: number = 0;
}

interface YieldAggregatorConfig {
  saucerSwapApi: string;
  refreshIntervalMs: number;
  stalenessThresholdMs: number;
}

// SaucerSwap API types (simplified)
interface SaucerSwapPool {
  id: string;
  token0: {
    address: string;
    symbol: string;
    decimals: number;
  };
  token1: {
    address: string;
    symbol: string;
    decimals: number;
  };
  liquidity: string;
  sqrtPriceX96: string;
  tick: number;
  fee: number;
}
