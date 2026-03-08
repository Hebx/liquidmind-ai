import { createPublicClient, decodeFunctionResult, encodeFunctionData, http, parseAbi } from "viem";
import { baseSepolia } from "viem/chains";

import { CHAINLINK_FEEDS_BASE_SEPOLIA, TOKEN_ADDRESSES, USD_STABLE_QUOTES } from "./market-config";

const AGGREGATOR_ABI = parseAbi([
  "function latestRoundData() view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)",
  "function getRoundData(uint80 _roundId) view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)",
]);

export interface RpcMarketDataReaderOptions {
  env?: NodeJS.ProcessEnv;
}

export interface VolatilityResult {
  volatility: number;
  latestPrice: number;
  roundsRead: number;
}

export class RpcMarketDataReader {
  private readonly rpcUrl: string;

  constructor(options: RpcMarketDataReaderOptions = {}) {
    const env = options.env ?? process.env;
    const rpcUrl = env.BASE_SEPOLIA_RPC || env.NEXT_PUBLIC_BASE_SEPOLIA_RPC;
    if (!rpcUrl) {
      throw new Error("Missing BASE_SEPOLIA_RPC or NEXT_PUBLIC_BASE_SEPOLIA_RPC for canonical route workflow.");
    }

    this.rpcUrl = rpcUrl;
  }

  async getPrice(tokenAddressOrSymbol: string): Promise<number> {
    const symbol = this.resolveSymbol(tokenAddressOrSymbol);
    if (USD_STABLE_QUOTES.has(symbol)) {
      return 1;
    }

    const feedAddress = CHAINLINK_FEEDS_BASE_SEPOLIA[symbol];
    if (!feedAddress) {
      throw new Error(`No Base Sepolia Chainlink feed for ${symbol}.`);
    }
    const resolvedFeedAddress = feedAddress as `0x${string}`;

    const client = this.createClient();
    const data = await client.call({
      to: resolvedFeedAddress,
      data: encodeFunctionData({
        abi: AGGREGATOR_ABI,
        functionName: "latestRoundData",
      }),
    });

    const [, answer] = decodeFunctionResult({
      abi: AGGREGATOR_ABI,
      functionName: "latestRoundData",
      data: getCallDataOrThrow(data.data, `Missing Chainlink latestRoundData response for ${symbol}.`),
    }) as readonly [bigint, bigint, bigint, bigint, bigint];

    if (answer <= 0n) {
      throw new Error(`Invalid price from Chainlink feed for ${symbol}.`);
    }

    return Number(answer) / 1e8;
  }

  async getVolatility(symbol: string, numRounds: number = 5): Promise<VolatilityResult> {
    const resolvedSymbol = this.resolveSymbol(symbol);
    const feedAddress = CHAINLINK_FEEDS_BASE_SEPOLIA[resolvedSymbol];
    if (!feedAddress) {
      throw new Error(`No Base Sepolia Chainlink feed for ${resolvedSymbol}.`);
    }
    const resolvedFeedAddress = feedAddress as `0x${string}`;

    const client = this.createClient();
    const latestReply = await client.call({
      to: resolvedFeedAddress,
      data: encodeFunctionData({
        abi: AGGREGATOR_ABI,
        functionName: "latestRoundData",
      }),
    });

    const latestDecoded = decodeFunctionResult({
      abi: AGGREGATOR_ABI,
      functionName: "latestRoundData",
      data: getCallDataOrThrow(
        latestReply.data,
        `Missing Chainlink latestRoundData response for ${resolvedSymbol}.`,
      ),
    }) as readonly [bigint, bigint, bigint, bigint, bigint];

    const [latestRoundId, latestAnswer, , latestUpdatedAt] = latestDecoded;
    const latestPrice = Number(latestAnswer) / 1e8;
    const prices: Array<{ price: number; timestamp: number }> = [
      { price: latestPrice, timestamp: Number(latestUpdatedAt) },
    ];

    for (let i = 1; i <= numRounds; i += 1) {
      const roundId = latestRoundId - BigInt(i);
      if (roundId <= 0n) {
        break;
      }

      try {
        const reply = await client.call({
          to: resolvedFeedAddress,
          data: encodeFunctionData({
            abi: AGGREGATOR_ABI,
            functionName: "getRoundData",
            args: [roundId],
          }),
        });

        const decoded = decodeFunctionResult({
          abi: AGGREGATOR_ABI,
          functionName: "getRoundData",
          data: getCallDataOrThrow(
            reply.data,
            `Missing Chainlink getRoundData response for ${resolvedSymbol}.`,
          ),
        }) as readonly [bigint, bigint, bigint, bigint, bigint];

        const [, answer, , updatedAt] = decoded;
        if (answer > 0n) {
          prices.push({ price: Number(answer) / 1e8, timestamp: Number(updatedAt) });
        }
      } catch {
        break;
      }
    }

    if (prices.length < 2) {
      return { volatility: 0, latestPrice, roundsRead: prices.length };
    }

    prices.sort((left, right) => left.timestamp - right.timestamp);
    const logReturns: number[] = [];
    for (let index = 1; index < prices.length; index += 1) {
      logReturns.push(Math.log(prices[index].price / prices[index - 1].price));
    }

    const mean = logReturns.reduce((sum, value) => sum + value, 0) / logReturns.length;
    const variance =
      logReturns.reduce((sum, value) => sum + (value - mean) ** 2, 0) / logReturns.length;
    const stdDev = Math.sqrt(variance);
    const totalTime = prices[prices.length - 1].timestamp - prices[0].timestamp;
    const avgInterval = totalTime / (prices.length - 1);
    const secondsPerYear = 365.25 * 24 * 3600;
    const periodsPerYear = avgInterval > 0 ? secondsPerYear / avgInterval : 365;
    const annualizedVolatility = stdDev * Math.sqrt(periodsPerYear) * 100;

    return {
      volatility: Math.round(annualizedVolatility * 100) / 100,
      latestPrice,
      roundsRead: prices.length,
    };
  }

  private createClient() {
    return createPublicClient({
      chain: baseSepolia,
      transport: http(this.rpcUrl),
    });
  }

  private resolveSymbol(tokenAddressOrSymbol: string): string {
    const lowerCasedValue = tokenAddressOrSymbol.toLowerCase();
    for (const [symbol, address] of Object.entries(TOKEN_ADDRESSES)) {
      if (address.toLowerCase() === lowerCasedValue) {
        return symbol;
      }
    }

    return tokenAddressOrSymbol.toUpperCase();
  }
}

function getCallDataOrThrow(data: `0x${string}` | undefined, errorMessage: string): `0x${string}` {
  if (!data) {
    throw new Error(errorMessage);
  }

  return data;
}
