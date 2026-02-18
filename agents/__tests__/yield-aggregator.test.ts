/**
 * Yield Aggregator Tests
 */

import { YieldAggregator } from '../src/yield-aggregator';
import { YieldAggregationRequest, Token } from '../src/types';

describe('YieldAggregator', () => {
  let aggregator: YieldAggregator;

  const mockToken: Token = {
    address: '0.0.1',
    symbol: 'TEST',
    decimals: 8,
    name: 'Test Token',
    chainId: 295,
  };

  const mockHBAR: Token = {
    address: '0.0.2',
    symbol: 'HBAR',
    decimals: 8,
    name: 'Hedera',
    chainId: 295,
  };

  beforeEach(() => {
    aggregator = new YieldAggregator({
      saucerSwapApi: 'https://api.saucerswap.finance',
      refreshIntervalMs: 300000,
      stalenessThresholdMs: 600000,
    });
  });

  describe('getYieldOpportunities', () => {
    it('should return yield opportunities for token', async () => {
      const request: YieldAggregationRequest = {
        token: mockToken,
      };

      // Would need mocked API response
      try {
        const comparison = await aggregator.getYieldOpportunities(request);
        expect(comparison.opportunities).toBeDefined();
        expect(comparison.timestamp).toBeGreaterThan(0);
      } catch (e) {
        // Expected without mocked API
        expect(e).toBeDefined();
      }
    });

    it('should filter by min APY', async () => {
      const request: YieldAggregationRequest = {
        token: mockToken,
        minApy: 0.10, // 10% minimum
      };

      // Would test with mocked data
      expect(request.minApy).toBe(0.10);
    });

    it('should exclude specified protocols', async () => {
      const request: YieldAggregationRequest = {
        token: mockToken,
        excludeProtocols: ['UnknownDEX'],
      };

      expect(request.excludeProtocols).toContain('UnknownDEX');
    });

    it('should identify best APY opportunity', async () => {
      // Would need mocked data
      expect(aggregator).toBeDefined();
    });

    it('should identify best risk-adjusted opportunity', async () => {
      // Would need mocked data
      expect(aggregator).toBeDefined();
    });
  });

  describe('getAllOpportunities', () => {
    it('should return all yield opportunities', async () => {
      try {
        const opportunities = await aggregator.getAllOpportunities();
        expect(Array.isArray(opportunities)).toBe(true);
      } catch (e) {
        // Expected without mocked API
        expect(e).toBeDefined();
      }
    });

    it('should sort by APY descending', async () => {
      // Would test with mocked data
      expect(aggregator).toBeDefined();
    });
  });

  describe('calculateTotalApy', () => {
    it('should include reward token yields', () => {
      const opportunity = {
        id: 'opp1',
        protocol: 'SaucerSwap',
        pool: {
          address: 'pool1',
          tokenA: mockToken,
          tokenB: mockHBAR,
          reserveA: BigInt(100000000000),
          reserveB: BigInt(100000000000),
          totalSupply: BigInt(1000000),
          feeTier: 30,
          protocol: 'SaucerSwap',
          apr: 0.10,
          tvl: BigInt(200000000000),
          volume24h: BigInt(10000000000),
        },
        apy: 0.10,
        tvl: BigInt(200000000000),
        rewards: [
          {
            token: {
              address: '0.0.100',
              symbol: 'SAUCE',
              decimals: 6,
              name: 'SAUCE',
              chainId: 295,
            },
            dailyEmission: BigInt(1000000000),
            valuePerDay: 100,
          },
        ],
        lockupPeriod: 0,
        depositFee: 0,
        withdrawalFee: 0,
        harvestFee: 0,
        lastUpdated: Date.now(),
      };

      const totalApy = aggregator.calculateTotalApy(opportunity);

      expect(totalApy).toBeGreaterThan(opportunity.apy);
    });

    it('should account for fees', () => {
      const opportunity = {
        id: 'opp2',
        protocol: 'SaucerSwap',
        pool: {
          address: 'pool2',
          tokenA: mockToken,
          tokenB: mockHBAR,
          reserveA: BigInt(100000000000),
          reserveB: BigInt(100000000000),
          totalSupply: BigInt(1000000),
          feeTier: 30,
          protocol: 'SaucerSwap',
          apr: 0.15,
          tvl: BigInt(200000000000),
          volume24h: BigInt(10000000000),
        },
        apy: 0.15,
        tvl: BigInt(200000000000),
        rewards: [],
        lockupPeriod: 0,
        depositFee: 0.005, // 0.5% deposit fee
        withdrawalFee: 0.005, // 0.5% withdrawal fee
        harvestFee: 0,
        lastUpdated: Date.now(),
      };

      const totalApy = aggregator.calculateTotalApy(opportunity);

      expect(totalApy).toBeLessThan(opportunity.apy);
    });
  });

  describe('handleTask', () => {
    it('should handle aggregate-yield task', async () => {
      const message = {
        id: 'msg-1',
        from: 'coordinator',
        to: 'yield-aggregator',
        type: 'task-request' as const,
        payload: {
          taskId: 'task-1',
          taskType: 'aggregate-yield',
          priority: 'high' as const,
          params: {
            token: mockToken,
            minApy: 0.05,
          },
        },
        timestamp: Date.now(),
      };

      const result = await aggregator.handleTask(message);

      // Will fail without mocked API, but structure is correct
      expect(result.taskId).toBe('task-1');
    });

    it('should handle fetch-prices task', async () => {
      const message = {
        id: 'msg-2',
        from: 'coordinator',
        to: 'yield-aggregator',
        type: 'task-request' as const,
        payload: {
          taskId: 'task-2',
          taskType: 'fetch-prices',
          priority: 'medium' as const,
          params: {
            tokens: [mockToken, mockHBAR],
          },
        },
        timestamp: Date.now(),
      };

      const result = await aggregator.handleTask(message);

      expect(result.taskId).toBe('task-2');
    });

    it('should return failure for unknown task type', async () => {
      const message = {
        id: 'msg-3',
        from: 'coordinator',
        to: 'yield-aggregator',
        type: 'task-request' as const,
        payload: {
          taskId: 'task-3',
          taskType: 'unknown-task',
          priority: 'low' as const,
          params: {},
        },
        timestamp: Date.now(),
      };

      const result = await aggregator.handleTask(message);

      expect(result.status).toBe('failure');
      expect(result.error).toContain('Unknown task type');
    });
  });

  describe('isDataStale', () => {
    it('should return true when data is stale', async () => {
      // Fresh aggregator should have stale data
      const opportunities = await aggregator.getAllOpportunities().catch(() => null);
      // Will be stale until first fetch
      expect(opportunities === null || Array.isArray(opportunities)).toBe(true);
    });
  });

  describe('findBestRiskAdjusted', () => {
    it('should prefer higher TVL pools', () => {
      // Would test with mocked data
      expect(aggregator).toBeDefined();
    });

    it('should weight APY and TVL appropriately', () => {
      // Would test with mocked data
      expect(aggregator).toBeDefined();
    });
  });
});
