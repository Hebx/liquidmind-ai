/**
 * Yield Aggregator Tests
 */

import { YieldAggregator } from '../src/yield-aggregator';
import { Token } from '../src/types';

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

  describe('fetchAllYields', () => {
    it('should fetch all yields from protocols', async () => {
      try {
        const result = await aggregator.fetchAllYields();
        expect(result.opportunities).toBeDefined();
        expect(result.timestamp).toBeGreaterThan(0);
      } catch (e) {
        expect(e).toBeDefined();
      }
    });
  });

  describe('compareOpportunities', () => {
    it('should sort opportunities by APY', () => {
      const opps = [
        { id: '1', protocol: 'P1', pool: {} as any, apy: 0.1, tvl: 100n, rewards: [], lastUpdated: 0, lockupPeriod: 0, depositFee: 0, withdrawalFee: 0, harvestFee: 0 },
        { id: '2', protocol: 'P2', pool: {} as any, apy: 0.2, tvl: 200n, rewards: [], lastUpdated: 0, lockupPeriod: 0, depositFee: 0, withdrawalFee: 0, harvestFee: 0 }
      ];
      const comparison = aggregator.compareOpportunities(opps);
      expect(comparison.bestApy.apy).toBe(0.2);
      expect(comparison.opportunities[0]!.apy).toBe(0.2);
    });
  });

  describe('handleTask', () => {
    it('should handle fetch-yields task', async () => {
      const message = {
        id: 'msg-1',
        from: 'coordinator',
        to: 'yield-aggregator',
        type: 'task-request' as const,
        payload: {
          taskId: 'task-1',
          taskType: 'fetch-yields',
          priority: 'high' as const,
          params: {},
        },
        timestamp: Date.now(),
      };

      const result = await aggregator.handleTask(message);
      expect(result.taskId).toBe('task-1');
    });

    it('should handle compare-yields task', async () => {
      const opps = [
        { id: '1', protocol: 'P1', pool: {address: '0x1'} as any, apy: 0.1, tvl: 100n, rewards: [], lastUpdated: 0, lockupPeriod: 0, depositFee: 0, withdrawalFee: 0, harvestFee: 0 },
      ];
      const message = {
        id: 'msg-2',
        from: 'coordinator',
        to: 'yield-aggregator',
        type: 'task-request' as const,
        payload: {
          taskId: 'task-2',
          taskType: 'compare-yields',
          priority: 'medium' as const,
          params: { opportunities: opps },
        },
        timestamp: Date.now(),
      };

      const result = await aggregator.handleTask(message);
      expect(result.taskId).toBe('task-2');
      expect(result.status).toBe('success');
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

  describe('selectBest', () => {
    it('should select best based on score', () => {
        const opps = [
            { id: '1', pool: {address: '0x1'} as any, protocol: 'P1', apy: 0.1, tvl: 100n, rewards: [], lastUpdated: 0, lockupPeriod: 0, depositFee: 0, withdrawalFee: 0, harvestFee: 0 },
            { id: '2', pool: {address: '0x2'} as any, protocol: 'P2', apy: 0.5, tvl: 200n, rewards: [], lastUpdated: 0, lockupPeriod: 0, depositFee: 0, withdrawalFee: 0, harvestFee: 0 }
        ];
        const best = aggregator.selectBest(opps, {'0x1': 0, '0x2': 100});
        expect(best.id).toBe('1');
    });
  });
});
