/**
 * Token Cache Manager
 * 
 * Provides efficient caching for token counts to avoid recomputing
 * token counts for messages and resources repeatedly.
 * 
 * Uses LRU (Least Recently Used) eviction policy with configurable limits.
 */

interface CacheEntry {
  tokens: number;
  timestamp: number;
  contentHash: string;
}

interface TokenCacheOptions {
  maxSize?: number;
  ttlMs?: number;
}

class TokenCache {
  private cache: Map<string, CacheEntry>;
  private maxSize: number;
  private ttlMs: number;
  private accessOrder: string[];

  constructor(options: TokenCacheOptions = {}) {
    this.maxSize = options.maxSize || 1000;
    this.ttlMs = options.ttlMs || 1000 * 60 * 60 * 24; // 24 hours default
    this.cache = new Map();
    this.accessOrder = [];
  }

  /**
   * Generate a simple hash for content
   */
  private hashContent(content: string): string {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }

  /**
   * Estimate token count from text
   * Uses approximation: ~4 characters per token for English text
   */
  estimateTokens(text: string): number {
    if (!text || text.length === 0) return 0;
    // Approximate: 1 token ≈ 4 characters for English text
    // This is a rough estimate - actual tokenization varies by model
    return Math.ceil(text.length / 4);
  }

  /**
   * Get cached token count or compute and cache
   */
  getOrCompute(key: string, content: string): number {
    const contentHash = this.hashContent(content);
    const cached = this.cache.get(key);

    // Check if cache entry is valid
    if (cached && cached.contentHash === contentHash) {
      // Check TTL
      if (Date.now() - cached.timestamp < this.ttlMs) {
        this.updateAccessOrder(key);
        return cached.tokens;
      }
    }

    // Compute and cache
    const tokens = this.estimateTokens(content);
    this.set(key, tokens, contentHash);
    return tokens;
  }

  /**
   * Set a cache entry
   */
  set(key: string, tokens: number, contentHash: string): void {
    // Evict if at capacity
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictLRU();
    }

    this.cache.set(key, {
      tokens,
      timestamp: Date.now(),
      contentHash,
    });

    this.updateAccessOrder(key);
  }

  /**
   * Get cached value without computing
   */
  get(key: string): number | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    // Check TTL
    if (Date.now() - cached.timestamp > this.ttlMs) {
      this.delete(key);
      return null;
    }

    this.updateAccessOrder(key);
    return cached.tokens;
  }

  /**
   * Delete a cache entry
   */
  delete(key: string): void {
    this.cache.delete(key);
    this.accessOrder = this.accessOrder.filter(k => k !== key);
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    this.accessOrder = [];
  }

  /**
   * Update access order for LRU
   */
  private updateAccessOrder(key: string): void {
    // Remove if exists
    this.accessOrder = this.accessOrder.filter(k => k !== key);
    // Add to end (most recent)
    this.accessOrder.push(key);
  }

  /**
   * Evict least recently used entry
   */
  private evictLRU(): void {
    if (this.accessOrder.length === 0) return;
    const lruKey = this.accessOrder.shift();
    if (lruKey) {
      this.cache.delete(lruKey);
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; maxSize: number; hitRate: number } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: 0, // Would need to track hits/misses for accurate calculation
    };
  }
}

// Global token cache instance
let globalTokenCache: TokenCache | null = null;

export function getTokenCache(): TokenCache {
  if (!globalTokenCache) {
    globalTokenCache = new TokenCache({
      maxSize: 2000, // Support up to 2000 cached entries
      ttlMs: 1000 * 60 * 60 * 24 * 7, // 7 days TTL for message caching
    });
  }
  return globalTokenCache;
}

export function resetTokenCache(): void {
  if (globalTokenCache) {
    globalTokenCache.clear();
  }
  globalTokenCache = null;
}

// Export the class for testing
export { TokenCache };
export type { TokenCacheOptions, CacheEntry };
