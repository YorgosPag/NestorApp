/**
 * 🎣 ENTERPRISE CUSTOMER INFO HOOK
 *
 * Κεντρικοποιημένο hook για customer information management
 * Enterprise-class data fetching με caching, error handling και optimization
 *
 * @created 2025-12-14
 * @author Claude AI Assistant
 * @version 1.0.0
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { getContactDisplayName, getPrimaryPhone } from '@/types/contacts/helpers';
import type {
  CustomerBasicInfo,
  CustomerExtendedInfo,
  UseCustomerInfoReturn,
  UseCustomerInfoConfig
} from '../types/CustomerInfoTypes';

// ============================================================================
// CACHE MANAGEMENT
// ============================================================================

interface CustomerCache {
  [contactId: string]: {
    basic: CustomerBasicInfo | null;
    extended: CustomerExtendedInfo | null;
    timestamp: number;
    basicError: string | null;
    extendedError: string | null;
  };
}

/**
 * In-memory cache για customer info
 * Enterprise-class caching με TTL και LRU eviction
 * OPTIMIZED για better performance
 */
class CustomerInfoCache {
  private cache: CustomerCache = {};
  private readonly maxSize = 200; // Increased cache size
  private readonly defaultTTL = 15 * 60 * 1000; // 15 minutes (longer TTL)

  get(contactId: string, ttl: number = this.defaultTTL) {
    const entry = this.cache[contactId];
    if (!entry) return null;

    const now = Date.now();
    if (now - entry.timestamp > ttl) {
      delete this.cache[contactId];
      return null;
    }

    return entry;
  }

  set(contactId: string, data: Partial<CustomerCache[string]>) {
    // LRU eviction
    if (Object.keys(this.cache).length >= this.maxSize) {
      const oldestKey = Object.keys(this.cache)[0];
      delete this.cache[oldestKey];
    }

    this.cache[contactId] = {
      basic: null,
      extended: null,
      timestamp: Date.now(),
      basicError: null,
      extendedError: null,
      ...this.cache[contactId],
      ...data
    };
  }

  invalidate(contactId?: string) {
    if (contactId) {
      delete this.cache[contactId];
    } else {
      this.cache = {};
    }
  }

  clear() {
    this.cache = {};
  }
}

// Singleton cache instance
const customerCache = new CustomerInfoCache();

// ============================================================================
// FETCH FUNCTIONS
// ============================================================================

/**
 * Fetch basic customer info από το νέο enterprise API
 */
async function fetchCustomerBasicInfo(contactId: string): Promise<CustomerBasicInfo> {
  try {
    const response = await fetch(`/api/contacts/${contactId}`);

    if (!response.ok) {
      throw new Error(`Failed to fetch customer: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    // Ελέγχω αν το API επέστρεψε success: false
    if (!data.success) {
      throw new Error(data.error || 'API returned error');
    }

    const contact = data.contact;

    return {
      contactId: contact.contactId,
      displayName: contact.displayName,
      primaryPhone: contact.primaryPhone,
      primaryEmail: contact.primaryEmail,
      status: contact.status || 'active',
      avatarUrl: contact.avatarUrl
    };

  } catch (error) {
    console.error(`❌ Failed to fetch customer basic info for ${contactId}:`, error);
    throw new Error(
      error instanceof Error
        ? error.message
        : 'Αδυναμία φόρτωσης στοιχείων πελάτη'
    );
  }
}

/**
 * Fetch extended customer info με units και άλλα στατιστικά από enterprise APIs
 */
async function fetchCustomerExtendedInfo(contactId: string): Promise<CustomerExtendedInfo> {
  try {
    // Παράλληλη φόρτωση basic info και units info από τα νέα enterprise APIs
    const [basicInfo, unitsResponse] = await Promise.all([
      fetchCustomerBasicInfo(contactId),
      fetch(`/api/contacts/${contactId}/units`)
    ]);

    if (!unitsResponse.ok) {
      throw new Error(`Failed to fetch customer units: ${unitsResponse.status}`);
    }

    const unitsData = await unitsResponse.json();

    // Ελέγχω αν το units API επέστρεψε success: false
    if (!unitsData.success) {
      throw new Error(unitsData.error || 'Units API returned error');
    }

    const units = unitsData.units || [];

    return {
      ...basicInfo,
      unitsCount: unitsData.unitsCount || units.length,
      unitIds: units.map((unit: unknown) => (unit as { id: string }).id),
      totalValue: unitsData.totalValue || 0,
      profession: unitsData.contactInfo?.profession || null,
      city: unitsData.contactInfo?.city || null,
      lastContactDate: unitsData.contactInfo?.lastContactDate
        ? new Date(unitsData.contactInfo.lastContactDate)
        : undefined
    };

  } catch (error) {
    console.error(`❌ Failed to fetch customer extended info for ${contactId}:`, error);
    throw new Error(
      error instanceof Error
        ? error.message
        : 'Αδυναμία φόρτωσης εκτεταμένων στοιχείων πελάτη'
    );
  }
}

// ============================================================================
// MAIN HOOK
// ============================================================================

/**
 * Enterprise customer info hook με advanced features
 *
 * @example
 * ```typescript
 * const { customerInfo, loading, error, refetch } = useCustomerInfo('contact_123', {
 *   fetchExtended: true,
 *   cacheTimeout: 300000, // 5 minutes
 *   retries: 3
 * });
 * ```
 */
export function useCustomerInfo(
  contactId: string | null | undefined,
  config: UseCustomerInfoConfig = {}
): UseCustomerInfoReturn {
  const {
    fetchExtended = false,
    cacheTimeout = 5 * 60 * 1000, // 5 minutes default
    retries = 2,
    enabled = true,
    staleTime = 60 * 1000 // 1 minute stale time
  } = config;

  // ========================================================================
  // STATE MANAGEMENT
  // ========================================================================

  const [customerInfo, setCustomerInfo] = useState<CustomerBasicInfo | null>(null);
  const [extendedInfo, setExtendedInfo] = useState<CustomerExtendedInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingExtended, setLoadingExtended] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extendedError, setExtendedError] = useState<string | null>(null);

  // ========================================================================
  // FETCH FUNCTIONS με RETRY LOGIC
  // ========================================================================

  const fetchWithRetry = useCallback(async <T>(
    fetchFn: () => Promise<T>,
    maxRetries: number = retries
  ): Promise<T> => {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fetchFn();
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));

        if (attempt === maxRetries) {
          throw lastError;
        }

        // Exponential backoff
        const delay = Math.min(1000 * Math.pow(2, attempt), 5000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  }, [retries]);

  // ========================================================================
  // BASIC INFO FETCHING
  // ========================================================================

  const fetchBasicInfo = useCallback(async () => {
    if (!contactId || !enabled) return;

    // Check cache first
    const cached = customerCache.get(contactId, cacheTimeout);
    if (cached?.basic && !cached.basicError) {
      setCustomerInfo(cached.basic);
      setError(null);
      return;
    }

    if (cached?.basicError) {
      setError(cached.basicError);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const info = await fetchWithRetry(() => fetchCustomerBasicInfo(contactId));

      setCustomerInfo(info);
      setError(null);

      // Update cache
      customerCache.set(contactId, {
        basic: info,
        basicError: null,
        timestamp: Date.now()
      });

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Άγνωστο σφάλμα';
      setError(errorMessage);

      // Cache error για short period
      customerCache.set(contactId, {
        basicError: errorMessage,
        timestamp: Date.now()
      });

    } finally {
      setLoading(false);
    }
  }, [contactId, enabled, cacheTimeout, fetchWithRetry]);

  // ========================================================================
  // EXTENDED INFO FETCHING
  // ========================================================================

  const fetchExtendedInfoInternal = useCallback(async () => {
    if (!contactId || !enabled) return;

    // Check cache first
    const cached = customerCache.get(contactId, cacheTimeout);
    if (cached?.extended && !cached.extendedError) {
      setExtendedInfo(cached.extended);
      setExtendedError(null);
      return;
    }

    if (cached?.extendedError) {
      setExtendedError(cached.extendedError);
      return;
    }

    setLoadingExtended(true);
    setExtendedError(null);

    try {
      const info = await fetchWithRetry(() => fetchCustomerExtendedInfo(contactId));

      setExtendedInfo(info);
      setCustomerInfo(info); // Extended includes basic
      setExtendedError(null);
      setError(null);

      // Update cache
      customerCache.set(contactId, {
        basic: info,
        extended: info,
        basicError: null,
        extendedError: null,
        timestamp: Date.now()
      });

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Άγνωστο σφάλμα';
      setExtendedError(errorMessage);

      // Cache error
      customerCache.set(contactId, {
        extendedError: errorMessage,
        timestamp: Date.now()
      });

    } finally {
      setLoadingExtended(false);
    }
  }, [contactId, enabled, cacheTimeout, fetchWithRetry]);

  // ========================================================================
  // PUBLIC API FUNCTIONS
  // ========================================================================

  const refetch = useCallback(async () => {
    if (contactId) {
      customerCache.invalidate(contactId);
      await fetchBasicInfo();
    }
  }, [contactId, fetchBasicInfo]);

  const refetchExtended = useCallback(async () => {
    if (contactId) {
      customerCache.invalidate(contactId);
      await fetchExtendedInfoInternal();
    }
  }, [contactId, fetchExtendedInfoInternal]);

  const invalidateCache = useCallback(() => {
    if (contactId) {
      customerCache.invalidate(contactId);
    }
  }, [contactId]);

  // ========================================================================
  // EFFECTS
  // ========================================================================

  // Initial fetch
  useEffect(() => {
    if (fetchExtended) {
      fetchExtendedInfoInternal();
    } else {
      fetchBasicInfo();
    }
  }, [fetchExtended, fetchBasicInfo, fetchExtendedInfoInternal]);

  // Reset state when contactId changes
  useEffect(() => {
    setCustomerInfo(null);
    setExtendedInfo(null);
    setError(null);
    setExtendedError(null);
    setLoading(false);
    setLoadingExtended(false);
  }, [contactId]);

  // ========================================================================
  // MEMOIZED RETURN VALUE
  // ========================================================================

  return useMemo((): UseCustomerInfoReturn => ({
    customerInfo,
    extendedInfo,
    loading,
    loadingExtended,
    error,
    extendedError,
    refetch,
    refetchExtended,
    invalidateCache
  }), [
    customerInfo,
    extendedInfo,
    loading,
    loadingExtended,
    error,
    extendedError,
    refetch,
    refetchExtended,
    invalidateCache
  ]);
}

// ============================================================================
// UTILITY HOOKS
// ============================================================================

/**
 * Hook για batch fetching πολλαπλών customers
 */
export function useMultipleCustomerInfo(
  contactIds: string[],
  config: UseCustomerInfoConfig = {}
) {
  const [results, setResults] = useState<Record<string, UseCustomerInfoReturn>>({});

  useEffect(() => {
    const newResults: Record<string, UseCustomerInfoReturn> = {};

    contactIds.forEach(contactId => {
      // Note: This would need proper implementation with individual hooks
      // This is a placeholder for the concept
      newResults[contactId] = {
        customerInfo: null,
        extendedInfo: null,
        loading: false,
        loadingExtended: false,
        error: null,
        extendedError: null,
        refetch: async () => {},
        refetchExtended: async () => {},
        invalidateCache: () => {}
      };
    });

    setResults(newResults);
  }, [contactIds]);

  return results;
}

/**
 * Global cache management utilities
 */
export const customerInfoCache = {
  clear: () => customerCache.clear(),
  invalidate: (contactId?: string) => customerCache.invalidate(contactId),
  getStats: () => ({
    size: Object.keys(customerCache['cache']).length,
    maxSize: customerCache['maxSize']
  })
};