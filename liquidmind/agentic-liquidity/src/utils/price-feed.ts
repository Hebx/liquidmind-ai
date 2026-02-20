/**
 * Price Feed Utilities
 *
 * Fetches and caches token prices from multiple sources:
 * - Chainlink Price Feeds (primary) - mock for CRE WASM
 * - CoinGecko API (fallback) - disabled in CRE WASM (no fetch)
 * - Mock prices for symbols (CRE-safe)
 */

// Token price cache
interface PriceCache {
  [tokenAddress: string]: {
    price: number;
    timestamp: number;
    source: string;
  };
}

const CACHE_TTL = 60000; // 1 minute

// Chainlink Price Feed addresses (mainnet examples)
const CHAINLINK_FEEDS: Record<string, string> = {
  "ETH": "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419",
  "BTC": "0xF4030086522a5bEEa4988F8cA5B36dbC97BeE88c",
  "LINK": "0x2c1d072e956AFFC0D435Cb7AC38EF18d24d9127c",
  "USDC": "0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6",
  "DAI": "0xAed0c38402a5d19df6E4c03F4E2DceD6e29c1ee9",
  "USDT": "0x3E7d1eAB13ad0104d2750B8863b489D65364e32D"
};

// Token address mapping
const TOKEN_ADDRESSES: Record<string, string> = {
  "WETH": "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
  "WBTC": "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
  "LINK": "0x514910771AF9Ca656af840dff83E8264EcF986CA",
  "USDC": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  "DAI": "0x6B175474E89094C44Da98b954EedeAC495271d0F",
  "USDT": "0xdAC17F958D2ee523a2206206994597C13D831ec7",
  "UNI": "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984"
};

export class PriceFeedUtil {
  private cache: PriceCache = {};
  private readonly coingeckoApiKey?: string;

  constructor(coingeckoApiKey?: string) {
    this.coingeckoApiKey = coingeckoApiKey;
  }

  /**
   * Get token price in USD
   */
  async getPrice(tokenAddress: string): Promise<number> {
    const normalizedAddress = this.normalizeAddress(tokenAddress);
    
    // Check cache
    const cached = this.cache[normalizedAddress];
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      console.log(`  💰 Cache hit: ${tokenAddress} = $${cached.price}`);
      return cached.price;
    }

    // Try Chainlink first
    try {
      const price = await this.getChainlinkPrice(normalizedAddress);
      this.cache[normalizedAddress] = {
        price,
        timestamp: Date.now(),
        source: "chainlink"
      };
      return price;
    } catch (error) {
      console.log(`  ⚠️  Chainlink failed for ${tokenAddress}, trying CoinGecko...`);
    }

    // Fallback to CoinGecko
    try {
      const price = await this.getCoinGeckoPrice(normalizedAddress);
      this.cache[normalizedAddress] = {
        price,
        timestamp: Date.now(),
        source: "coingecko"
      };
      return price;
    } catch (error) {
      console.log(`  ⚠️  CoinGecko failed for ${tokenAddress}`);
    }

    // Final fallback: mock price for testing
    const mockPrice = this.getMockPrice(normalizedAddress);
    this.cache[normalizedAddress] = {
      price: mockPrice,
      timestamp: Date.now(),
      source: "mock"
    };
    return mockPrice;
  }

  /**
   * Get multiple token prices efficiently
   */
  async getPrices(tokenAddresses: string[]): Promise<Record<string, number>> {
    const results: Record<string, number> = {};
    
    await Promise.all(
      tokenAddresses.map(async (addr) => {
        results[addr] = await this.getPrice(addr);
      })
    );
    
    return results;
  }

  /**
   * Get price from Chainlink Price Feed (mock for CRE WASM compatibility)
   */
  private async getChainlinkPrice(tokenAddress: string): Promise<number> {
    const tokenSymbol = this.getTokenSymbol(tokenAddress).toUpperCase();
    const mockPrices: Record<string, number> = {
      "ETH": 3200.5,
      "WETH": 3200.5,
      "BTC": 67500.0,
      "WBTC": 67500.0,
      "LINK": 18.75,
      "USDC": 1.0,
      "DAI": 0.9998,
      "USDT": 1.0,
      "UNI": 12.5
    };
    const price = mockPrices[tokenSymbol] ?? mockPrices[tokenSymbol.slice(0, 6)];
    if (price !== undefined) {
      return price;
    }
    throw new Error(`No Chainlink feed for ${tokenSymbol}`);
  }

  /**
   * Get price from CoinGecko API (skipped in CRE WASM - no fetch/axios)
   */
  private async getCoinGeckoPrice(tokenAddress: string): Promise<number> {
    // CRE WASM runtime does not support axios/fetch - always throw to use mock fallback
    throw new Error(`CoinGecko not available in CRE WASM for ${tokenAddress}`);
  }

  /**
   * Get token symbol from address or symbol
   */
  private getTokenSymbol(addressOrSymbol: string): string {
    const normalized = addressOrSymbol.toLowerCase();
    // Reverse lookup by address
    for (const [symbol, addr] of Object.entries(TOKEN_ADDRESSES)) {
      if (addr.toLowerCase() === normalized) return symbol;
    }
    // Already a symbol (e.g. WETH, USDC)
    const upper = addressOrSymbol.toUpperCase();
    if (TOKEN_ADDRESSES[upper]) return upper;
    return upper.slice(0, 6);
  }

  /**
   * Get token address from symbol
   */
  getTokenAddress(symbol: string): string | undefined {
    return TOKEN_ADDRESSES[symbol.toUpperCase()];
  }

  /**
   * Normalize Ethereum address
   */
  private normalizeAddress(address: string): string {
    return address.toLowerCase();
  }

  /**
   * Mock price for testing
   */
  private getMockPrice(tokenAddress: string): number {
    const mockPrices: Record<string, number> = {
      "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2": 3200.50, // WETH
      "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599": 67500.00, // WBTC
      "0x514910771af9ca656af840dff83e8264ecf986ca": 18.75,   // LINK
      "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48": 1.00,    // USDC
      "0x6b175474e89094c44da98b954eedeac495271d0f": 0.9998,  // DAI
      "0xdac17f958d2ee523a2206206994597c13d831ec7": 1.00     // USDT
    };

    return mockPrices[tokenAddress.toLowerCase()] || 100.00;
  }

  /**
   * Clear price cache
   */
  clearCache(): void {
    this.cache = {};
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; entries: string[] } {
    return {
      size: Object.keys(this.cache).length,
      entries: Object.keys(this.cache)
    };
  }
}

/**
 * Calculate USD value from token amount
 */
export function calculateUsdValue(
  tokenAmount: bigint, 
  decimals: number, 
  price: number
): number {
  const normalized = Number(tokenAmount) / Math.pow(10, decimals);
  return normalized * price;
}

/**
 * Format price for display
 */
export function formatPrice(price: number): string {
  if (price >= 1000) {
    return `$${price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  } else if (price >= 1) {
    return `$${price.toFixed(4)}`;
  } else {
    return `$${price.toFixed(6)}`;
  }
}

/**
 * Calculate price impact
 */
export function calculatePriceImpact(
  inputAmount: bigint,
  outputAmount: bigint,
  inputPrice: number,
  outputPrice: number,
  inputDecimals: number,
  outputDecimals: number
): number {
  const inputValue = Number(inputAmount) / Math.pow(10, inputDecimals) * inputPrice;
  const outputValue = Number(outputAmount) / Math.pow(10, outputDecimals) * outputPrice;
  
  return ((inputValue - outputValue) / inputValue) * 100;
}

export { TOKEN_ADDRESSES, CHAINLINK_FEEDS };
