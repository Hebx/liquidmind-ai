/**
 * Risk Analyzer Tests
 */

import { RiskAnalyzer } from '../src/risk-analyzer';
import { ILRiskParams, LiquidityPool, Token } from '../src/types';

describe('RiskAnalyzer', () => {
  let analyzer: RiskAnalyzer;

  const mockTokenA: Token = {
    address: '0.0.1',
    symbol: 'TOKENA',
    decimals: 8,
    name: 'Token A',
    chainId: 295,
  };

  const mockTokenB: Token = {
    address: '0.0.2',
    symbol: 'TOKENB',
    decimals: 8,
    name: 'Token B',
    chainId: 295,
  };

  const mockPool: LiquidityPool = {
    address: 'pool1',
    tokenA: mockTokenA,
    tokenB: mockTokenB,
    reserveA: BigInt(100000000000),
    reserveB: BigInt(50000000000),
    totalSupply: BigInt(1000000),
    feeTier: 30,
    protocol: 'SaucerSwap',
    apr: 0.15,
    tvl: BigInt(150000000000),
    volume24h: BigInt(5000000000),
  };

  beforeEach(() => {
    analyzer = new RiskAnalyzer({
      cacheDurationMs: 60000,
      monitoringIntervalMs: 300000,
      alertThreshold: 0.05,
    });
  });

  describe('calculateILRisk', () => {
    it('should calculate zero IL when prices match', () => {
      const params: ILRiskParams = {
        pool: mockPool,
        positionValue: BigInt(10000000000),
        entryPrice: 2.0,
        currentPrice: 2.0,
        durationDays: 30,
      };

      const risk = analyzer.calculateILRisk(params);

      expect(risk.impermanentLossPercent).toBeCloseTo(0, 5);
      expect(risk.riskLevel).toBe('low');
    });

    it('should calculate correct IL for 2x price increase', () => {
      const params: ILRiskParams = {
        pool: mockPool,
        positionValue: BigInt(10000000000),
        entryPrice: 1.0,
        currentPrice: 2.0,
        durationDays: 30,
      };

      const risk = analyzer.calculateILRisk(params);

      // IL formula: 2*sqrt(2)/(1+2) - 1 = 2*1.414/3 - 1 = 5.7%
      expect(risk.impermanentLossPercent).toBeCloseTo(5.72, 1);
      expect(risk.riskLevel).toBe('medium');
    });

    it('should calculate correct IL for 4x price increase', () => {
      const params: ILRiskParams = {
        pool: mockPool,
        positionValue: BigInt(10000000000),
        entryPrice: 1.0,
        currentPrice: 4.0,
        durationDays: 30,
      };

      const risk = analyzer.calculateILRisk(params);

      // IL formula: 2*sqrt(4)/(1+4) - 1 = 4/5 - 1 = 20%
      expect(risk.impermanentLossPercent).toBeCloseTo(20, 1);
      expect(risk.riskLevel).toBe('high');
    });

    it('should recommend hedging for extreme IL', () => {
      const params: ILRiskParams = {
        pool: mockPool,
        positionValue: BigInt(10000000000),
        entryPrice: 1.0,
        currentPrice: 5.0,
        durationDays: 30,
      };

      const risk = analyzer.calculateILRisk(params);

      expect(risk.hedgingRecommended).toBe(true);
      expect(risk.riskLevel).toBe('extreme');
    });

    it('should provide break-even calculation', () => {
      const params: ILRiskParams = {
        pool: mockPool,
        positionValue: BigInt(10000000000),
        entryPrice: 1.0,
        currentPrice: 2.0,
        durationDays: 30,
      };

      const risk = analyzer.calculateILRisk(params);

      expect(risk.breakEvenDays).toBeGreaterThan(0);
      expect(risk.recommendations.length).toBeGreaterThan(0);
    });

    it('should handle price decrease symmetrically', () => {
      const paramsIncrease: ILRiskParams = {
        pool: mockPool,
        positionValue: BigInt(10000000000),
        entryPrice: 1.0,
        currentPrice: 2.0,
        durationDays: 30,
      };

      const paramsDecrease: ILRiskParams = {
        pool: mockPool,
        positionValue: BigInt(10000000000),
        entryPrice: 2.0,
        currentPrice: 1.0,
        durationDays: 30,
      };

      const riskIncrease = analyzer.calculateILRisk(paramsIncrease);
      const riskDecrease = analyzer.calculateILRisk(paramsDecrease);

      expect(riskIncrease.impermanentLossPercent).toBeCloseTo(
        riskDecrease.impermanentLossPercent,
        5
      );
    });
  });

  describe('assessPoolRisk', () => {
    it('should return risk profile for pool', async () => {
      const profile = await analyzer.assessPoolRisk(mockPool);

      expect(profile.poolAddress).toBe(mockPool.address);
      expect(profile.volatilityScore).toBeGreaterThanOrEqual(0);
      expect(profile.volatilityScore).toBeLessThanOrEqual(100);
      expect(profile.overallRisk).toBeGreaterThanOrEqual(0);
      expect(profile.overallRisk).toBeLessThanOrEqual(100);
    });

    it('should cache risk profiles', async () => {
      const profile1 = await analyzer.assessPoolRisk(mockPool);
      const profile2 = await analyzer.assessPoolRisk(mockPool);

      expect(profile1).toEqual(profile2);
    });

    it('should assess lower risk for audited protocols', async () => {
      const auditedPool = { ...mockPool, protocol: 'SaucerSwap' };
      const unauditedPool = { ...mockPool, protocol: 'Unknown' };

      const auditedRisk = await analyzer.assessPoolRisk(auditedPool);
      const unauditedRisk = await analyzer.assessPoolRisk(unauditedPool);

      expect(auditedRisk.smartContractRisk).toBeLessThan(unauditedRisk.smartContractRisk);
    });
  });

  describe('calculateRiskAdjustedYield', () => {
    it('should adjust yield based on risk', () => {
      const opportunity = {
        id: 'opp1',
        protocol: 'SaucerSwap',
        pool: mockPool,
        apy: 0.20,
        tvl: BigInt(1000000000000),
        rewards: [],
        lockupPeriod: 0,
        depositFee: 0,
        withdrawalFee: 0,
        harvestFee: 0,
        lastUpdated: Date.now(),
      };

      const lowRiskProfile = {
        poolAddress: mockPool.address,
        volatilityScore: 20,
        liquidityRisk: 10,
        smartContractRisk: 10,
        protocolRisk: 10,
        overallRisk: 15,
        auditStatus: 'audited' as const,
      };

      const highRiskProfile = {
        poolAddress: mockPool.address,
        volatilityScore: 80,
        liquidityRisk: 70,
        smartContractRisk: 50,
        protocolRisk: 60,
        overallRisk: 70,
        auditStatus: 'unaudited' as const,
      };

      const lowRiskAdjusted = analyzer.calculateRiskAdjustedYield(opportunity, lowRiskProfile);
      const highRiskAdjusted = analyzer.calculateRiskAdjustedYield(opportunity, highRiskProfile);

      expect(lowRiskAdjusted).toBeGreaterThan(highRiskAdjusted);
    });
  });

  describe('handleTask', () => {
    it('should handle analyze-risk task for IL', async () => {
      const message = {
        id: 'msg-1',
        from: 'coordinator',
        to: 'risk-analyzer',
        type: 'task-request' as const,
        payload: {
          taskId: 'task-1',
          taskType: 'analyze-risk',
          priority: 'high' as const,
          params: {
            ilParams: {
              pool: mockPool,
              positionValue: BigInt(10000000000),
              entryPrice: 1.0,
              currentPrice: 2.0,
              durationDays: 30,
            },
          },
        },
        timestamp: Date.now(),
      };

      const result = await analyzer.handleTask(message);

      expect(result.status).toBe('success');
      expect(result.data).toBeDefined();
    });

    it('should handle analyze-risk task for pool', async () => {
      const message = {
        id: 'msg-2',
        from: 'coordinator',
        to: 'risk-analyzer',
        type: 'task-request' as const,
        payload: {
          taskId: 'task-2',
          taskType: 'analyze-risk',
          priority: 'medium' as const,
          params: {
            pool: mockPool,
          },
        },
        timestamp: Date.now(),
      };

      const result = await analyzer.handleTask(message);

      expect(result.status).toBe('success');
      expect(result.data).toBeDefined();
    });

    it('should return failure for unknown task type', async () => {
      const message = {
        id: 'msg-3',
        from: 'coordinator',
        to: 'risk-analyzer',
        type: 'task-request' as const,
        payload: {
          taskId: 'task-3',
          taskType: 'unknown-task',
          priority: 'low' as const,
          params: {},
        },
        timestamp: Date.now(),
      };

      const result = await analyzer.handleTask(message);

      expect(result.status).toBe('failure');
      expect(result.error).toContain('Unknown task type');
    });
  });
});
