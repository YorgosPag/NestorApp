/**
 * 🔒 PR-1C: Rate Limit Store Abstraction
 *
 * Production-grade rate limit storage with Upstash Redis.
 * Implements sliding window algorithm for accurate rate limiting.
 *
 * @module lib/middleware/rate-limit-store
 * @version 2.0.0
 * @since 2026-01-29 - PR-1C Re-Architecture
 *
 * @enterprise Local_Protocol compliant:
 * - Production: Upstash Redis (required)
 * - Development: In-memory (optional Upstash override)
 * - Fail-fast in production if Upstash not configured
 */

import {
  RATE_LIMIT_CONFIG,
  getRateLimitStoreType,
  getUpstashConfig,
} from './rate-limit-config';
import { createModuleLogger } from '@/lib/telemetry';

// =============================================================================
// LOGGER (Centralized - NO console.*)
// =============================================================================

const logger = createModuleLogger('RATE_LIMIT_STORE');

// =============================================================================
// TYPES
// =============================================================================

/**
 * Result from checking rate limit (store-level, NO category)
 * Category is added by the caller (rate-limiter.ts)
 */
export interface RateLimitCheckResult {
  /** Whether the request is allowed */
  allowed: boolean;
  /** Current request count in window */
  current: number;
  /** Maximum allowed requests */
  limit: number;
  /** Milliseconds until window resets */
  resetMs: number;
}

/**
 * Rate limit store interface.
 * Implementations must provide atomic increment with TTL.
 */
export interface RateLimitStore {
  /**
   * Check and increment rate limit counter.
   *
   * @param key - Unique key for this rate limit (user+endpoint)
   * @param limit - Maximum allowed requests in window
   * @param windowMs - Window size in milliseconds
   * @returns Rate limit check result
   */
  check(key: string, limit: number, windowMs: number): Promise<RateLimitCheckResult>;

  /**
   * Reset rate limit for a key.
   */
  reset(key: string): Promise<void>;

  /**
   * Get current count for a key (for monitoring).
   */
  getCount(key: string): Promise<number>;
}

// =============================================================================
// IN-MEMORY STORE (Development/Testing Only)
// =============================================================================

interface MemoryEntry {
  timestamps: number[];
}

/**
 * In-memory rate limit store.
 * Only for development and testing - NOT for production.
 */
class InMemoryRateLimitStore implements RateLimitStore {
  private store = new Map<string, MemoryEntry>();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Start cleanup scheduler
    this.startCleanup();
  }

  async check(
    key: string,
    limit: number,
    windowMs: number
  ): Promise<RateLimitCheckResult> {
    const now = Date.now();
    const windowStart = now - windowMs;

    // Get or create entry
    let entry = this.store.get(key);
    if (!entry) {
      entry = { timestamps: [] };
      this.store.set(key, entry);
    }

    // Remove expired timestamps (sliding window)
    entry.timestamps = entry.timestamps.filter((ts) => ts > windowStart);

    const current = entry.timestamps.length;
    const allowed = current < limit;

    // Record this request if allowed
    if (allowed) {
      entry.timestamps.push(now);
    }

    // Calculate reset time
    const oldestTimestamp = entry.timestamps[0] || now;
    const resetMs = Math.max(0, oldestTimestamp + windowMs - now);

    return {
      allowed,
      current: allowed ? current + 1 : current,
      limit,
      resetMs,
    };
  }

  async reset(key: string): Promise<void> {
    this.store.delete(key);
  }

  async getCount(key: string): Promise<number> {
    const entry = this.store.get(key);
    if (!entry) return 0;

    const windowStart = Date.now() - RATE_LIMIT_CONFIG.WINDOW.MS;
    return entry.timestamps.filter((ts) => ts > windowStart).length;
  }

  private startCleanup(): void {
    if (this.cleanupInterval) return;

    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      const windowStart = now - RATE_LIMIT_CONFIG.WINDOW.MS;

      for (const [key, entry] of this.store.entries()) {
        entry.timestamps = entry.timestamps.filter((ts) => ts > windowStart);
        if (entry.timestamps.length === 0) {
          this.store.delete(key);
        }
      }
    }, 60_000); // Cleanup every minute
  }

  /**
   * Stop cleanup (for testing)
   */
  stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

// =============================================================================
// UPSTASH STORE (Production)
// =============================================================================

/**
 * Upstash Redis rate limit store.
 * Uses REST API for serverless compatibility.
 *
 * Algorithm: Sliding window using sorted sets
 * - Score = timestamp
 * - Members = request IDs (UUID or timestamp-based)
 * - ZREMRANGEBYSCORE to remove expired entries
 * - ZCARD to count current window
 */
class UpstashRateLimitStore implements RateLimitStore {
  private baseUrl: string;
  private token: string;

  constructor(url: string, token: string) {
    this.baseUrl = url;
    this.token = token;
  }

  /**
   * Execute Upstash REST command.
   */
  private async execute<T>(command: string[]): Promise<T> {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(command),
    });

    if (!response.ok) {
      throw new Error(
        `[RATE_LIMIT] Upstash error: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();
    return data.result as T;
  }

  /**
   * Execute multiple commands in a pipeline.
   */
  private async pipeline<T>(commands: string[][]): Promise<T[]> {
    const response = await fetch(`${this.baseUrl}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(commands),
    });

    if (!response.ok) {
      throw new Error(
        `[RATE_LIMIT] Upstash pipeline error: ${response.status} ${response.statusText}`
      );
    }

    const results = await response.json();
    return results.map((r: { result: T }) => r.result);
  }

  async check(
    key: string,
    limit: number,
    windowMs: number
  ): Promise<RateLimitCheckResult> {
    const now = Date.now();
    const windowStart = now - windowMs;
    const member = `${now}:${Math.random().toString(36).substring(2, 9)}`;
    const ttlSeconds = Math.ceil(windowMs / 1000) + 1;

    try {
      // Pipeline: Remove expired + Add new + Count + Set TTL
      const results = await this.pipeline<number | string>([
        // Remove entries older than window
        ['ZREMRANGEBYSCORE', key, '0', String(windowStart)],
        // Add this request
        ['ZADD', key, String(now), member],
        // Count requests in window
        ['ZCARD', key],
        // Set TTL on the key
        ['EXPIRE', key, String(ttlSeconds)],
        // Get oldest entry score for reset calculation
        ['ZRANGE', key, '0', '0', 'WITHSCORES'],
      ]);

      const current = results[2] as number;
      const allowed = current <= limit;

      // Get oldest timestamp for reset calculation
      // ZRANGE returns array of [member, score] when WITHSCORES is used
      const zrangeResult = results[4];
      const oldestData = Array.isArray(zrangeResult) ? zrangeResult as string[] : null;
      const oldestTimestamp =
        oldestData && oldestData.length >= 2 ? parseInt(oldestData[1], 10) : now;
      const resetMs = Math.max(0, oldestTimestamp + windowMs - now);

      // If over limit, remove the entry we just added
      if (!allowed) {
        await this.execute(['ZREM', key, member]);
      }

      return {
        allowed,
        current,
        limit,
        resetMs,
      };
    } catch (error) {
      logger.error('Upstash check failed', { error: String(error) });
      // Fail open in case of error (allow the request)
      // This prevents Upstash outage from blocking all requests
      return {
        allowed: true,
        current: 0,
        limit,
        resetMs: windowMs,
      };
    }
  }

  async reset(key: string): Promise<void> {
    await this.execute(['DEL', key]);
  }

  async getCount(key: string): Promise<number> {
    const now = Date.now();
    const windowStart = now - RATE_LIMIT_CONFIG.WINDOW.MS;

    // Remove expired and count
    await this.execute(['ZREMRANGEBYSCORE', key, '0', String(windowStart)]);
    return await this.execute<number>(['ZCARD', key]);
  }
}

// =============================================================================
// STORE FACTORY
// =============================================================================

let storeInstance: RateLimitStore | null = null;

/**
 * Get the rate limit store instance.
 * Creates singleton based on environment configuration.
 *
 * @returns Rate limit store instance
 * @throws Error in production if Upstash not configured
 */
export function getRateLimitStore(): RateLimitStore {
  if (storeInstance) {
    return storeInstance;
  }

  const storeType = getRateLimitStoreType();

  if (storeType === 'upstash') {
    const config = getUpstashConfig();
    if (!config) {
      // This should never happen in production due to getUpstashConfig throwing
      throw new Error('[RATE_LIMIT] Upstash configuration missing');
    }
    storeInstance = new UpstashRateLimitStore(config.url, config.token);
    logger.info('Using Upstash Redis store (production-grade)');
  } else {
    storeInstance = new InMemoryRateLimitStore();
    logger.info('Using in-memory store (development only)');
  }

  return storeInstance;
}

/**
 * Reset the store instance (for testing).
 */
export function resetStoreInstance(): void {
  if (storeInstance && storeInstance instanceof InMemoryRateLimitStore) {
    storeInstance.stopCleanup();
  }
  storeInstance = null;
}

// =============================================================================
// EXPORTS
// =============================================================================

export { InMemoryRateLimitStore, UpstashRateLimitStore };
