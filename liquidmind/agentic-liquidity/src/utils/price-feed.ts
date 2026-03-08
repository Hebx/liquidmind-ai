/**
 * Price Feed Utilities
 *
 * Fetches live token prices from Chainlink Price Feeds on Base Sepolia
 * using the CRE SDK EVMClient capability (real on-chain reads via DON consensus).
 *
 * Feeds verified live on Base Sepolia:
 *   ETH/USD  0x4aDC67696bA383F43DD60A9e78F2C97Fbbfc7cb1
 *   BTC/USD  0x0FB99723Aee6f420beAD13e6bBB79b7E6F034298
 *   LINK/USD 0xd30e2101a97dcbAeBCBC04F14C3f624E67A35165
 *
 * Falls back to hardcoded mock prices only when runtime is unavailable
 * (e.g. local unit tests outside the CRE simulator).
 * When runtime is present, failures must surface so the canonical path fails closed.
 */

import {
  EVMClient,
  encodeCallMsg,
  LAST_FINALIZED_BLOCK_NUMBER,
  bytesToHex,
  type Runtime,
} from "@chainlink/cre-sdk";
import { encodeFunctionData, decodeFunctionResult, zeroAddress, parseAbi } from "viem";

// ABI for Chainlink AggregatorV3Interface
const AGGREGATOR_ABI = parseAbi([
  "function latestRoundData() view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)",
  "function getRoundData(uint80 _roundId) view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)",
  "function decimals() view returns (uint8)",
]);

// Base Sepolia chain selector (from @chainlink/cre-sdk ClientCapability.SUPPORTED_CHAIN_SELECTORS)
const BASE_SEPOLIA_CHAIN_SELECTOR = 10344971235874465080n;

// Verified Chainlink feed addresses on Base Sepolia (8 decimals each)
const CHAINLINK_FEEDS_BASE_SEPOLIA: Record<string, string> = {
  ETH:  "0x4aDC67696bA383F43DD60A9e78F2C97Fbbfc7cb1", // ETH/USD
  WETH: "0x4aDC67696bA383F43DD60A9e78F2C97Fbbfc7cb1", // WETH tracks ETH price
  BTC:  "0x0FB99723Aee6f420beAD13e6bBB79b7E6F034298", // BTC/USD
  WBTC: "0x0FB99723Aee6f420beAD13e6bBB79b7E6F034298", // WBTC tracks BTC price
  LINK: "0xd30e2101a97dcbAeBCBC04F14C3f624E67A35165", // LINK/USD
};

// Token address → symbol mapping for Base Sepolia tokens
const TOKEN_ADDRESSES: Record<string, string> = {
  WETH: "0x4200000000000000000000000000000000000006", // Base Sepolia canonical WETH
  USDC: "0x036CbD53842c5426634e7929541eC2318f3dCF7e", // Base Sepolia USDC
  LINK: "0xE4aB69C077896252FAFBD49EFD26B5D171A32410", // Base Sepolia LINK
};

// Supported USD quote assets for the current WETH/USDC-style path.
// These intentionally resolve to 1 USD without a Chainlink lookup.
const USD_STABLE_QUOTES = new Set(["USDC", "USDT", "DAI"]);

// Fallback mock prices — only used when runtime is undefined (offline unit tests)
const MOCK_PRICES: Record<string, number> = {
  ETH:  2000.00,
  WETH: 2000.00,
  BTC:  65000.00,
  WBTC: 65000.00,
  LINK: 15.00,
  USDC: 1.00,
  DAI:  1.00,
  USDT: 1.00,
};

// Token price cache entry
interface PriceCacheEntry {
  price: number;
  timestamp: number;
  source: string;
}

const CACHE_TTL = 60000; // 1 minute

export class PriceFeedUtil {
  private cache: Record<string, PriceCacheEntry> = {};

  /**
   * Get token price in USD.
   *
   * When `runtime` is provided (inside the CRE simulator or a live DON), this
   * calls `latestRoundData()` on the Chainlink aggregator contract deployed on
   * Base Sepolia via the EVMClient capability — real on-chain data.
   *
   * When `runtime` is omitted it falls back to hardcoded mock prices so the
   * class remains usable in plain unit tests. When `runtime` is present,
   * Chainlink read failures are surfaced instead of falling back to mock data.
   */
  async getPrice(tokenAddressOrSymbol: string, runtime?: Runtime<unknown>): Promise<number> {
    const symbol = this.resolveSymbol(tokenAddressOrSymbol);
    const cacheKey = symbol;

    const cached = this.cache[cacheKey];
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      console.log(`  💰 Cache hit: ${symbol} = $${cached.price.toFixed(4)} (${cached.source})`);
      return cached.price;
    }

    if (USD_STABLE_QUOTES.has(symbol)) {
      const stablePrice = 1.0;
      const source = runtime ? "usd-stable-parity" : "mock-stable-parity";
      this.cache[cacheKey] = { price: stablePrice, timestamp: Date.now(), source };
      console.log(`  💵 Stable quote: ${symbol}/USD = $${stablePrice.toFixed(4)} (${source})`);
      return stablePrice;
    }

    // Attempt on-chain read via CRE EVMClient
    if (runtime) {
      try {
        const price = await this.readChainlinkFeed(symbol, runtime);
        this.cache[cacheKey] = { price, timestamp: Date.now(), source: "chainlink-base-sepolia" };
        console.log(`  🔗 Chainlink (Base Sepolia): ${symbol}/USD = $${price.toFixed(4)}`);
        return price;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new Error(`Chainlink EVMClient failed for ${symbol}: ${msg}`);
      }
    }

    // Offline / no feed for this symbol → mock
    const mock = MOCK_PRICES[symbol.toUpperCase()] ?? 1.00;
    this.cache[cacheKey] = { price: mock, timestamp: Date.now(), source: "mock" };
    console.log(`  📊 Mock price: ${symbol} = $${mock.toFixed(4)}`);
    return mock;
  }

  /**
   * Fetch multiple prices concurrently.
   */
  async getPrices(
    tokenAddressesOrSymbols: string[],
    runtime?: Runtime<unknown>,
  ): Promise<Record<string, number>> {
    const results: Record<string, number> = {};
    await Promise.all(
      tokenAddressesOrSymbols.map(async (t) => {
        results[t] = await this.getPrice(t, runtime);
      }),
    );
    return results;
  }

  /**
   * Get token address from symbol (Base Sepolia addresses).
   */
  getTokenAddress(symbol: string): string | undefined {
    return TOKEN_ADDRESSES[symbol.toUpperCase()];
  }

  clearCache(): void {
    this.cache = {};
  }

  /**
   * Measure annualized volatility from the last N Chainlink rounds.
   * Reads getRoundData() for recent rounds, computes log returns, then annualizes.
   * Returns { volatility: annualized %, latestPrice, roundsRead }.
   */
  async getVolatility(
    symbol: string,
    runtime: Runtime<unknown>,
    numRounds: number = 5,
  ): Promise<{ volatility: number; latestPrice: number; roundsRead: number }> {
    const feedAddress = CHAINLINK_FEEDS_BASE_SEPOLIA[symbol.toUpperCase()];
    if (!feedAddress) {
      return { volatility: 0, latestPrice: 0, roundsRead: 0 };
    }

    const evmClient = new EVMClient(BASE_SEPOLIA_CHAIN_SELECTOR);

    // Read latest round to get the current roundId
    const latestCallData = encodeFunctionData({
      abi: AGGREGATOR_ABI,
      functionName: "latestRoundData",
      args: [],
    });

    const latestReply = evmClient
      .callContract(runtime, {
        call: encodeCallMsg({ from: zeroAddress, to: feedAddress as `0x${string}`, data: latestCallData }),
        blockNumber: LAST_FINALIZED_BLOCK_NUMBER,
      })
      .result();

    const latestDecoded = decodeFunctionResult({
      abi: AGGREGATOR_ABI,
      functionName: "latestRoundData",
      data: bytesToHex(latestReply.data),
    }) as readonly [bigint, bigint, bigint, bigint, bigint];

    const [latestRoundId, latestAnswer, , latestUpdatedAt] = latestDecoded;
    const latestPrice = Number(latestAnswer) / 1e8;

    // Collect prices from recent rounds
    const prices: { price: number; timestamp: number }[] = [
      { price: latestPrice, timestamp: Number(latestUpdatedAt) },
    ];

    for (let i = 1; i <= numRounds; i++) {
      const roundId = latestRoundId - BigInt(i);
      if (roundId <= 0n) break;

      try {
        const callData = encodeFunctionData({
          abi: AGGREGATOR_ABI,
          functionName: "getRoundData",
          args: [roundId],
        });

        const reply = evmClient
          .callContract(runtime, {
            call: encodeCallMsg({ from: zeroAddress, to: feedAddress as `0x${string}`, data: callData }),
            blockNumber: LAST_FINALIZED_BLOCK_NUMBER,
          })
          .result();

        const decoded = decodeFunctionResult({
          abi: AGGREGATOR_ABI,
          functionName: "getRoundData",
          data: bytesToHex(reply.data),
        }) as readonly [bigint, bigint, bigint, bigint, bigint];

        const [, answer, , updatedAt] = decoded;
        if (answer > 0n) {
          prices.push({ price: Number(answer) / 1e8, timestamp: Number(updatedAt) });
        }
      } catch {
        break; // round doesn't exist or reverted
      }
    }

    if (prices.length < 2) {
      return { volatility: 0, latestPrice, roundsRead: prices.length };
    }

    // Sort oldest → newest
    prices.sort((a, b) => a.timestamp - b.timestamp);

    // Compute log returns between consecutive rounds
    const logReturns: number[] = [];
    for (let i = 1; i < prices.length; i++) {
      logReturns.push(Math.log(prices[i].price / prices[i - 1].price));
    }

    // Standard deviation of log returns
    const mean = logReturns.reduce((s, r) => s + r, 0) / logReturns.length;
    const variance = logReturns.reduce((s, r) => s + (r - mean) ** 2, 0) / logReturns.length;
    const stdDev = Math.sqrt(variance);

    // Estimate average time between rounds (seconds)
    const totalTime = prices[prices.length - 1].timestamp - prices[0].timestamp;
    const avgInterval = totalTime / (prices.length - 1);

    // Annualize: scale by sqrt(seconds_per_year / avg_interval)
    const SECONDS_PER_YEAR = 365.25 * 24 * 3600;
    const periodsPerYear = avgInterval > 0 ? SECONDS_PER_YEAR / avgInterval : 365;
    const annualizedVol = stdDev * Math.sqrt(periodsPerYear) * 100; // as percentage

    return {
      volatility: Math.round(annualizedVol * 100) / 100, // 2 decimal places
      latestPrice,
      roundsRead: prices.length,
    };
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  /**
   * Call `latestRoundData()` on the Chainlink aggregator via the CRE EVMClient
   * capability.  Returns the USD price with decimal normalization (÷ 10^8).
   */
  private readChainlinkFeed(symbol: string, runtime: Runtime<unknown>): Promise<number> {
    const feedAddress = CHAINLINK_FEEDS_BASE_SEPOLIA[symbol.toUpperCase()];
    if (!feedAddress) {
      return Promise.reject(new Error(`No Base Sepolia Chainlink feed for ${symbol}`));
    }

    // Encode the latestRoundData() call
    const callData = encodeFunctionData({
      abi: AGGREGATOR_ABI,
      functionName: "latestRoundData",
      args: [],
    });

    // Create the EVMClient for Base Sepolia
    const evmClient = new EVMClient(BASE_SEPOLIA_CHAIN_SELECTOR);

    // Execute the call — this is a synchronous CRE capability call under the hood
    const reply = evmClient
      .callContract(runtime, {
        call: encodeCallMsg({
          from: zeroAddress,
          to: feedAddress as `0x${string}`,
          data: callData,
        }),
        blockNumber: LAST_FINALIZED_BLOCK_NUMBER,
      })
      .result();

    // Decode ABI response: (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)
    const decoded = decodeFunctionResult({
      abi: AGGREGATOR_ABI,
      functionName: "latestRoundData",
      data: bytesToHex(reply.data),
    }) as readonly [bigint, bigint, bigint, bigint, bigint];

    const [, answer] = decoded;

    if (answer <= 0n) {
      return Promise.reject(new Error(`Invalid price from Chainlink feed (answer=${answer})`));
    }

    // All Base Sepolia feeds use 8 decimals
    const price = Number(answer) / 1e8;
    return Promise.resolve(price);
  }

  /**
   * Resolve a token address or symbol to an uppercase ticker symbol.
   */
  private resolveSymbol(addressOrSymbol: string): string {
    const lower = addressOrSymbol.toLowerCase();
    for (const [sym, addr] of Object.entries(TOKEN_ADDRESSES)) {
      if (addr.toLowerCase() === lower) return sym;
    }
    return addressOrSymbol.toUpperCase();
  }
}

// ── Pure utility functions (no runtime dependency) ───────────────────────────

export function calculateUsdValue(
  tokenAmount: bigint,
  decimals: number,
  price: number,
): number {
  return (Number(tokenAmount) / Math.pow(10, decimals)) * price;
}

export function formatPrice(price: number): string {
  if (price >= 1000) {
    return `$${price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  } else if (price >= 1) {
    return `$${price.toFixed(4)}`;
  }
  return `$${price.toFixed(6)}`;
}

export function calculatePriceImpact(
  inputAmount: bigint,
  outputAmount: bigint,
  inputPrice: number,
  outputPrice: number,
  inputDecimals: number,
  outputDecimals: number,
): number {
  const inputValue = (Number(inputAmount) / Math.pow(10, inputDecimals)) * inputPrice;
  const outputValue = (Number(outputAmount) / Math.pow(10, outputDecimals)) * outputPrice;
  return ((inputValue - outputValue) / inputValue) * 100;
}

export { TOKEN_ADDRESSES, CHAINLINK_FEEDS_BASE_SEPOLIA as CHAINLINK_FEEDS };
