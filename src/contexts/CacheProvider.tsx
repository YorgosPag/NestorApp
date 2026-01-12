'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';

// Cache entry interface
interface CacheEntry<T = unknown> {
  data: T;
  timestamp: number;
  expiresAt: number;
  key: string;
  stale?: boolean;
}

// Cache configuration
interface CacheConfig {
  ttl?: number; // Time to live in milliseconds
  maxSize?: number; // Maximum cache entries
  enableStale?: boolean; // Return stale data while fetching fresh
}

// Cache context type
interface CacheContextType {
  get: <T>(key: string) => CacheEntry<T> | null;
  set: <T>(key: string, data: T, config?: CacheConfig) => void;
  invalidate: (key: string) => void;
  invalidatePattern: (pattern: string) => void;
  clear: () => void;
  getStats: () => CacheStats;
  prefetch: <T>(key: string, fetcher: () => Promise<T>, config?: CacheConfig) => Promise<void>;
}

interface CacheStats {
  size: number;
  hits: number;
  misses: number;
  hitRate: number;
  oldestEntry?: number;
  newestEntry?: number;
}

const CacheContext = createContext<CacheContextType | null>(null);

const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes
const DEFAULT_MAX_SIZE = 100;

export function CacheProvider({ 
  children,
  defaultTTL = DEFAULT_TTL,
  maxSize = DEFAULT_MAX_SIZE
}: { 
  children: React.ReactNode;
  defaultTTL?: number;
  maxSize?: number;
}) {
  const [cache, setCache] = useState<Map<string, CacheEntry>>(new Map());
  const statsRef = useRef({ hits: 0, misses: 0 });
  
  // Cleanup expired entries
  const cleanup = useCallback(() => {
    const now = Date.now();
    setCache(prevCache => {
      const newCache = new Map(prevCache);
      for (const [key, entry] of newCache) {
        if (entry.expiresAt < now) {
          newCache.delete(key);
        }
      }
      return newCache;
    });
  }, []);

  // Cleanup interval
  useEffect(() => {
    const interval = setInterval(cleanup, 60000); // Cleanup every minute
    return () => clearInterval(interval);
  }, [cleanup]);

  const get = useCallback<CacheContextType['get']>((key: string) => {
    const entry = cache.get(key);
    
    if (!entry) {
      statsRef.current.misses++;
      return null;
    }
    
    const now = Date.now();
    
    // Check if expired
    if (entry.expiresAt < now) {
      cache.delete(key);
      statsRef.current.misses++;
      return null;
    }
    
    // Check if stale (older than half TTL)
    const halfLife = (entry.expiresAt - entry.timestamp) / 2;
    const isStale = now > entry.timestamp + halfLife;
    
    statsRef.current.hits++;
    return {
      ...entry,
      stale: isStale
    };
  }, [cache]);

  const set = useCallback<CacheContextType['set']>(<T,>(key: string, data: T, config: CacheConfig = {}) => {
    const ttl = config.ttl ?? defaultTTL;
    const now = Date.now();
    
    const entry: CacheEntry = {
      data,
      timestamp: now,
      expiresAt: now + ttl,
      key
    };
    
    setCache(prevCache => {
      const newCache = new Map(prevCache);
      
      // Remove oldest entries if cache is full
      if (newCache.size >= maxSize && !newCache.has(key)) {
        const oldestKey = Array.from(newCache.keys())[0];
        newCache.delete(oldestKey);
      }
      
      newCache.set(key, entry);
      return newCache;
    });
  }, [defaultTTL, maxSize]);

  const invalidate = useCallback((key: string) => {
    setCache(prevCache => {
      const newCache = new Map(prevCache);
      newCache.delete(key);
      return newCache;
    });
  }, []);

  const invalidatePattern = useCallback((pattern: string) => {
    const regex = new RegExp(pattern);
    setCache(prevCache => {
      const newCache = new Map(prevCache);
      for (const key of newCache.keys()) {
        if (regex.test(key)) {
          newCache.delete(key);
        }
      }
      return newCache;
    });
  }, []);

  const clear = useCallback(() => {
    setCache(new Map());
    statsRef.current = { hits: 0, misses: 0 };
  }, []);

  const getStats = useCallback((): CacheStats => {
    const entries = Array.from(cache.values());
    const timestamps = entries.map(e => e.timestamp);
    
    return {
      size: cache.size,
      hits: statsRef.current.hits,
      misses: statsRef.current.misses,
      hitRate: statsRef.current.hits / (statsRef.current.hits + statsRef.current.misses) || 0,
      oldestEntry: timestamps.length > 0 ? Math.min(...timestamps) : undefined,
      newestEntry: timestamps.length > 0 ? Math.max(...timestamps) : undefined,
    };
  }, [cache]);

  const prefetch = useCallback<CacheContextType['prefetch']>(async <T,>(
    key: string,
    fetcher: () => Promise<T>,
    config: CacheConfig = {}
  ) => {
    try {
      const data = await fetcher();
      set(key, data, config);
    } catch (error) {
      console.warn(`Prefetch failed for key ${key}:`, error);
    }
  }, [set]);

  const value: CacheContextType = {
    get,
    set,
    invalidate,
    invalidatePattern,
    clear,
    getStats,
    prefetch
  };

  return (
    <CacheContext.Provider value={value}>
      {children}
    </CacheContext.Provider>
  );
}

export function useCache() {
  const context = useContext(CacheContext);
  if (!context) {
    throw new Error('useCache must be used within a CacheProvider');
  }
  return context;
}

// Hook for cached data fetching
export function useCachedData<T>(
  key: string,
  fetcher: () => Promise<T>,
  config: CacheConfig & { enabled?: boolean } = {}
) {
  const cache = useCache();
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isStale, setIsStale] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const { enabled = true } = config;

  const fetchData = useCallback(async (useStale = false) => {
    if (!enabled) return;

    try {
      // Check cache first
      const cached = cache.get(key);
      if (cached && (!cached.stale || useStale)) {
        setData(cached.data);
        setIsStale(cached.stale || false);
        if (!cached.stale) return;
      }

      if (!useStale) {
        setIsLoading(true);
      }
      setError(null);
      
      const result = await fetcher();
      cache.set(key, result, config);
      setData(result);
      setIsStale(false);
      
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
      // If we have stale data, keep it
      const cached = cache.get(key);
      if (cached) {
        setData(cached.data);
        setIsStale(true);
      }
    } finally {
      setIsLoading(false);
    }
  }, [cache, key, fetcher, config, enabled]);

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Return stale data immediately, then fetch fresh
  useEffect(() => {
    if (enabled) {
      const cached = cache.get(key);
      if (cached) {
        setData(cached.data);
        setIsStale(cached.stale || false);
        if (cached.stale) {
          fetchData(true); // Background refresh
        }
      }
    }
  }, [cache, key, enabled, fetchData]);

  const refetch = useCallback(() => fetchData(), [fetchData]);
  const invalidate = useCallback(() => cache.invalidate(key), [cache, key]);

  return {
    data,
    isLoading,
    isStale,
    error,
    refetch,
    invalidate
  };
}

// Hook for optimistic updates
export function useOptimisticUpdate<T>() {
  const cache = useCache();
  
  return useCallback(async <T,>(
    key: string,
    optimisticData: T,
    mutationFn: () => Promise<T>,
    config: { rollbackOnError?: boolean } = {}
  ) => {
    const { rollbackOnError = true } = config;
    
    // Store original data for rollback
    const originalEntry = cache.get(key);
    
    // Apply optimistic update
    cache.set(key, optimisticData);
    
    try {
      const result = await mutationFn();
      // Optionally update cache with result
      return result;
    } catch (error) {
      // Rollback on error
      if (rollbackOnError && originalEntry) {
        cache.set(key, originalEntry.data);
      } else if (rollbackOnError) {
        cache.invalidate(key);
      }
      throw error;
    }
  }, [cache]);
}

export type { CacheConfig, CacheEntry, CacheStats };