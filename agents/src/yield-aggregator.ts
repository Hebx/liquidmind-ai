import {
  YieldOpportunity,
  YieldStatus,
  YieldComparison,
  LiquidityPool,
  Token,
  A2AMessage,
  TaskResult,
  RewardToken,
} from './types';

/**
 * Yield Aggregator Agent
 * 
 * Monitors and aggregates yield opportunities across Hedera DEX protocols.
 * Compares APYs, TVL, and reward structures to find best deployment targets.
 */

export class YieldAggregator {
  private yieldCache: YieldOpportunity[] = [];
  private tokenPrices: Map<string, number> = new Map();
  private lastUpdate: number = 0;
  private agentId: string = 'yield-aggregator';

  constructor(
    private config: YieldAggregatorConfig,
    private protocols: string[] = ['SaucerSwap', 'Pangolin', 'HeliSwap']
  ) {}

  /**
   * Initialize the aggregator
   */
  async initialize(): Promise<void> {
    await this.fetchAllYields();
    this.startPeriodicRefresh();
  }

  /**
   * Fetch yields from all configured protocols
   */
  async fetchAllYields(): Promise<YieldStatus> {
    const allOpportunities: YieldOpportunity[] = [];
    
    for (const protocol of this.protocols) {
      try {
        const opps = await this.fetchProtocolYields(protocol);
        allOpportunities.push(...opps);
      } catch (error) {
        console.error(`Error fetching yields for ${protocol}:`, error);
      }
    }

    this.yieldCache = allOpportunities;
    this.lastUpdate = Date.now();
    this.emitYieldUpdated(allOpportunities.length);

    if (allOpportunities.length === 0) {
        return {
            opportunities: [],
            bestApy: undefined as any,
            timestamp: this.lastUpdate,
        };
    }

    const sorted = [...allOpportunities].sort((a, b) => b.apy - a.apy);
    const bestApy = sorted[0]!;

    return {
      opportunities: allOpportunities,
      bestApy,
      timestamp: this.lastUpdate,
    };
  }

  /**
   * Fetch yields for a specific protocol
   */
  async fetchProtocolYields(protocol: string): Promise<YieldOpportunity[]> {
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
    try {
      const response = await fetch(`${this.config.saucerSwapApi}/pools`);
      const data = await response.json();
      const pools = Array.isArray(data) ? data : [];

      return pools.map((pool: SaucerSwapPool) => this.transformSaucerSwapPool(pool));
    } catch (error) {
      console.error('Error fetching SaucerSwap yields:', error);
      return [];
    }
  }

  private async fetchPangolinYields(): Promise<YieldOpportunity[]> {
    return [];
  }

  private async fetchHeliSwapYields(): Promise<YieldOpportunity[]> {
    return [];
  }

  private transformSaucerSwapPool(pool: SaucerSwapPool): YieldOpportunity {
    const id = `saucerswap-${pool.id}`;
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
          chainId: 295,
        },
        tokenB: {
          address: pool.token1.address,
          symbol: pool.token1.symbol,
          decimals: pool.token1.decimals,
          name: pool.token1.symbol,
          chainId: 295,
        },
        reserveA: BigInt(pool.liquidity),
        reserveB: BigInt(pool.liquidity),
        totalSupply: BigInt(pool.liquidity),
        feeTier: pool.fee,
        protocol: 'SaucerSwap',
        apr: feeApr,
        tvl: this.estimateTvl(pool),
        volume24h: BigInt(0),
      },
      apy: totalApy,
      tvl: this.estimateTvl(pool),
      rewards: this.extractRewards(pool),
      lockupPeriod: 0,
      depositFee: 0,
      withdrawalFee: 0,
      harvestFee: 0,
      lastUpdated: Date.now(),
    };
  }

  private calculateFeeApr(pool: SaucerSwapPool): number {
    const feeRate = pool.fee / 10000;
    const estimatedTurnover = 0.1;
    return feeRate * estimatedTurnover * 365;
  }

  private calculateRewardApr(pool: SaucerSwapPool): number {
    return 0.05;
  }

  private estimateTvl(pool: SaucerSwapPool): bigint {
    return BigInt(pool.liquidity) * BigInt(2);
  }

  private extractRewards(pool: SaucerSwapPool): RewardToken[] {
    return [
      {
        token: {
          address: '0.0.1463300',
          symbol: 'SAUCE',
          decimals: 6,
          name: 'SAUCE',
          chainId: 295,
        },
        dailyEmission: BigInt(10000000000),
        valuePerDay: 1000,
      },
    ];
  }

  /**
   * Compare opportunities across protocols
   */
  compareOpportunities(opportunities: YieldOpportunity[]): YieldComparison {
    if (opportunities.length === 0) {
        throw new Error("No opportunities to compare");
    }
    const sorted = [...opportunities].sort((a, b) => b.apy - a.apy);
    const bestApy = sorted[0]!;

    return {
      opportunities: sorted,
      bestApy,
      averageApy: opportunities.reduce((acc, curr) => acc + curr.apy, 0) / opportunities.length,
      timestamp: Date.now(),
    };
  }

  /**
   * Score an opportunity based on yield and risk
   */
  scoreOpportunity(opportunity: YieldOpportunity, riskScore: number): number {
    return opportunity.apy / (riskScore + 1);
  }

  /**
   * Select the best opportunity based on risk-adjusted return
   */
  selectBest(opportunities: YieldOpportunity[], riskScores: Record<string, number>): YieldOpportunity {
    if (opportunities.length === 0) {
        throw new Error("No opportunities to select from");
    }
    const scored = opportunities.map((opp) => {
      const risk = riskScores[opp.pool.address] !== undefined ? riskScores[opp.pool.address]! : 50;
      const score = this.scoreOpportunity(opp, risk);
      console.log(`Opp ${opp.id}: APY=${opp.apy}, Risk=${risk}, Score=${score}`);
      return { opp, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored[0]?.opp || opportunities[0]!;
  }

  /**
   * Handle incoming A2A messages
   */
  async handleTask(message: A2AMessage): Promise<TaskResult> {
    const payload = message.payload as any;
    const taskType = payload.taskType;
    const params = payload.params;

    try {
      switch (taskType) {
        case 'fetch-yields':
          const result = await this.fetchAllYields();
          return {
            taskId: payload.taskId,
            status: 'success',
            data: result,
            completedAt: Date.now(),
          };

        case 'compare-yields':
          const comparison = this.compareOpportunities(params.opportunities);
          return {
            taskId: payload.taskId,
            status: 'success',
            data: comparison,
            completedAt: Date.now(),
          };

        default:
          return {
            taskId: payload.taskId,
            status: 'failure',
            data: null,
            error: `Unknown task type: ${taskType}`,
            completedAt: Date.now(),
          };
      }
    } catch (error) {
      return {
        taskId: payload.taskId,
        status: 'failure',
        data: null,
        error: error instanceof Error ? error.message : 'Unknown error',
        completedAt: Date.now(),
      };
    }
  }

  private startPeriodicRefresh(): void {
    setInterval(() => {
      this.fetchAllYields();
    }, this.config.refreshIntervalMs);
  }

  private emitYieldUpdated(count: number): void {
    console.log(`[YIELD] Updated ${count} yield opportunities`);
  }
}

interface YieldAggregatorConfig {
  saucerSwapApi: string;
  refreshIntervalMs: number;
  stalenessThresholdMs: number;
}

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
  apy7d: number;
  tvl: number;
}
