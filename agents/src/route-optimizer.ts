import {
  Route,
  RouteOptimizationRequest,
  RouteOptimizationResult,
  LiquidityPool,
  Token,
  A2AMessage,
  TaskResult,
} from './types';

/**
 * Route Optimizer Agent
 * 
 * Finds optimal liquidity routes across DEX protocols on Hedera.
 * Uses graph algorithms to find best paths considering price impact,
 * fees, and slippage.
 */

export class RouteOptimizer {
  private pools: Map<string, LiquidityPool> = new Map();
  private graph: PoolGraph = new Map();
  private priceCache: Map<string, number> = new Map();
  private lastUpdate: number = 0;
  private agentId: string = 'route-optimizer';

  constructor(private config: RouteOptimizerConfig) {}

  /**
   * Initialize the optimizer with pool data
   */
  async initialize(): Promise<void> {
    await this.fetchPoolData();
    this.buildGraph();
    this.startCacheRefresh();
  }

  /**
   * Find optimal route for a token swap
   */
  async findOptimalRoute(
    request: RouteOptimizationRequest
  ): Promise<RouteOptimizationResult> {
    const { tokenIn, tokenOut, amountIn, maxSlippage } = request;

    // Ensure fresh data
    if (Date.now() - this.lastUpdate > this.config.cacheDurationMs) {
      await this.fetchPoolData();
      this.buildGraph();
    }

    // Find all possible routes
    const allRoutes = this.findAllRoutes(tokenIn, tokenOut, 3); // max 3 hops

    if (allRoutes.length === 0) {
      throw new Error(`No route found from ${tokenIn.symbol} to ${tokenOut.symbol}`);
    }

    // Calculate expected output for each route
    const evaluatedRoutes: Route[] = [];
    for (const path of allRoutes) {
      try {
        const route = this.evaluateRoute(path, amountIn, maxSlippage);
        if (route.slippage <= maxSlippage) {
          evaluatedRoutes.push(route);
        }
      } catch (e) {
        // Route evaluation failed, skip
      }
    }

    // Sort by best expected output
    evaluatedRoutes.sort((a, b) => {
      const aValue = Number(a.expectedOutput) * (1 - a.priceImpact);
      const bValue = Number(b.expectedOutput) * (1 - b.priceImpact);
      return bValue - aValue;
    });

    if (evaluatedRoutes.length === 0) {
      throw new Error('No viable routes found within slippage tolerance');
    }

    return {
      optimalRoute: evaluatedRoutes[0],
      alternatives: evaluatedRoutes.slice(1, 4),
      confidence: this.calculateConfidence(evaluatedRoutes[0]),
      timestamp: Date.now(),
    };
  }

  /**
   * Handle incoming A2A messages
   */
  async handleTask(message: A2AMessage): Promise<TaskResult> {
    const taskType = (message.payload as any).taskType;
    const params = (message.payload as any).params;

    try {
      switch (taskType) {
        case 'optimize-route':
          const result = await this.findOptimalRoute(params as RouteOptimizationRequest);
          return {
            taskId: (message.payload as any).taskId,
            status: 'success',
            data: result,
            completedAt: Date.now(),
          };

        case 'fetch-prices':
          const prices = await this.getTokenPrices(params.tokens);
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

  /**
   * Get current token prices
   */
  async getTokenPrices(tokens: Token[]): Promise<Map<string, number>> {
    const prices = new Map<string, number>();
    
    for (const token of tokens) {
      const cachedPrice = this.priceCache.get(token.address);
      if (cachedPrice) {
        prices.set(token.address, cachedPrice);
      } else {
        // Fetch price from oracle/DEX
        const price = await this.fetchTokenPrice(token);
        this.priceCache.set(token.address, price);
        prices.set(token.address, price);
      }
    }

    return prices;
  }

  // Private methods

  private async fetchPoolData(): Promise<void> {
    // In production, fetch from SaucerSwap and other DEX APIs
    // For now, this is a placeholder
    const response = await fetch(`${this.config.saucerSwapApi}/pools`);
    const pools: LiquidityPool[] = await response.json();

    this.pools.clear();
    for (const pool of pools) {
      this.pools.set(pool.address, pool);
    }

    this.lastUpdate = Date.now();
  }

  private buildGraph(): void {
    this.graph.clear();

    for (const pool of this.pools.values()) {
      this.addEdge(pool.tokenA.address, pool.tokenB.address, pool);
      this.addEdge(pool.tokenB.address, pool.tokenA.address, pool);
    }
  }

  private addEdge(from: string, to: string, pool: LiquidityPool): void {
    if (!this.graph.has(from)) {
      this.graph.set(from, []);
    }
    this.graph.get(from)!.push({ to, pool });
  }

  private findAllRoutes(
    start: Token,
    end: Token,
    maxHops: number
  ): LiquidityPool[][] {
    const routes: LiquidityPool[][] = [];
    const visited = new Set<string>();

    const dfs = (
      current: string,
      target: string,
      path: LiquidityPool[],
      depth: number
    ) => {
      if (depth > maxHops) return;
      if (current === target && path.length > 0) {
        routes.push([...path]);
        return;
      }

      visited.add(current);
      const edges = this.graph.get(current);

      if (edges) {
        for (const edge of edges) {
          if (!visited.has(edge.to)) {
            path.push(edge.pool);
            dfs(edge.to, target, path, depth + 1);
            path.pop();
          }
        }
      }

      visited.delete(current);
    };

    dfs(start.address, end.address, [], 0);
    return routes;
  }

  private evaluateRoute(
    pools: LiquidityPool[],
    amountIn: bigint,
    maxSlippage: number
  ): Route {
    let currentAmount = amountIn;
    let totalPriceImpact = 0;
    let totalFee = 0;
    const path: Token[] = [];

    for (let i = 0; i < pools.length; i++) {
      const pool = pools[i];
      const isTokenA = pool.tokenA.address === (i === 0 ? '' : ''); // simplified

      // Calculate output using constant product formula
      const reserveIn = isTokenA ? pool.reserveA : pool.reserveB;
      const reserveOut = isTokenA ? pool.reserveB : pool.reserveA;

      const amountInWithFee = currentAmount * BigInt(10000 - pool.feeTier) / BigInt(10000);
      const numerator = amountInWithFee * reserveOut;
      const denominator = reserveIn + amountInWithFee;
      const amountOut = numerator / denominator;

      // Calculate price impact
      const spotPrice = Number(reserveOut) / Number(reserveIn);
      const executionPrice = Number(amountOut) / Number(currentAmount);
      const priceImpact = Math.abs(spotPrice - executionPrice) / spotPrice;

      totalPriceImpact += priceImpact;
      totalFee += pool.feeTier / 10000;

      if (i === 0) {
        path.push(pool.tokenA);
      }
      path.push(pool.tokenB);

      currentAmount = amountOut;
    }

    const slippage = totalPriceImpact + 0.005; // Add 0.5% buffer

    return {
      path,
      pools,
      expectedOutput: currentAmount,
      priceImpact: totalPriceImpact,
      gasEstimate: BigInt(pools.length * 100000), // Estimate
      totalFee,
      slippage,
    };
  }

  private calculateConfidence(route: Route): number {
    // Confidence based on price impact and liquidity depth
    const impactScore = Math.max(0, 1 - route.priceImpact * 10);
    const poolCountScore = Math.max(0, 1 - route.pools.length * 0.1);
    return (impactScore + poolCountScore) / 2;
  }

  private async fetchTokenPrice(token: Token): Promise<number> {
    // In production, fetch from price oracle
    // For now, return mock price
    return 1.0;
  }

  private startCacheRefresh(): void {
    setInterval(() => {
      this.fetchPoolData().then(() => this.buildGraph());
    }, this.config.refreshIntervalMs);
  }
}

interface RouteOptimizerConfig {
  saucerSwapApi: string;
  cacheDurationMs: number;
  refreshIntervalMs: number;
  maxHops: number;
}

type PoolGraph = Map<string, Edge[]>;

interface Edge {
  to: string;
  pool: LiquidityPool;
}
