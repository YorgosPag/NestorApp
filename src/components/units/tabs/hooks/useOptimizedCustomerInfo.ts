/**
 * 🚀 OPTIMIZED CUSTOMER INFO HOOK FOR UNITS
 *
 * Ultra-fast customer info hook optimized για unit tabs
 * Instant cache returns + background refresh
 * Zero loading delays for cached data
 *
 * @created 2025-12-14
 * @author Claude AI Assistant
 * @version 1.0.0
 * @enterprise Performance-first approach
 */

import { useState, useEffect, useRef, useCallback } from 'react';

// ============================================================================
// INTERFACES
// ============================================================================

interface OptimizedCustomerInfo {
  contactId: string;
  displayName: string;
  primaryPhone: string | null;
  primaryEmail: string | null;
  fetchedAt: number;
}

interface UseOptimizedCustomerInfoReturn {
  customerInfo: OptimizedCustomerInfo | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

// ============================================================================
// ULTRA-FAST CACHE
// ============================================================================

class UltraFastCache {
  private cache = new Map<string, OptimizedCustomerInfo>();
  private readonly TTL = 30 * 60 * 1000; // 30 minutes

  get(contactId: string): OptimizedCustomerInfo | null {
    const cached = this.cache.get(contactId);
    if (!cached) return null;

    // Check TTL
    if (Date.now() - cached.fetchedAt > this.TTL) {
      this.cache.delete(contactId);
      return null;
    }

    return cached;
  }

  set(contactId: string, data: OptimizedCustomerInfo): void {
    this.cache.set(contactId, data);
  }

  has(contactId: string): boolean {
    return this.cache.has(contactId);
  }

  clear(): void {
    this.cache.clear();
  }
}

// Singleton cache
const ultraCache = new UltraFastCache();

// ============================================================================
// OPTIMIZED HOOK
// ============================================================================

export function useOptimizedCustomerInfo(
  contactId: string | null | undefined,
  enabled: boolean = true
): UseOptimizedCustomerInfoReturn {

  // ========================================================================
  // STATE
  // ========================================================================

  const [customerInfo, setCustomerInfo] = useState<OptimizedCustomerInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // ========================================================================
  // FETCH FUNCTION
  // ========================================================================

  const fetchCustomerInfo = useCallback(async (id: string, signal?: AbortSignal) => {
    try {
      console.log(`🔄 Fetching customer info for: ${id}`);

      const response = await fetch(`/api/contacts/${id}`, {
        signal,
        headers: {
          'Cache-Control': 'max-age=300' // Browser cache for 5 minutes
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.success || !data.contact) {
        throw new Error('Invalid response format');
      }

      const contact = data.contact;
      const optimizedInfo: OptimizedCustomerInfo = {
        contactId: id,
        displayName: getDisplayName(contact),
        primaryPhone: getPrimaryPhone(contact),
        primaryEmail: getPrimaryEmail(contact),
        fetchedAt: Date.now()
      };

      // Cache immediately
      ultraCache.set(id, optimizedInfo);
      console.log(`✅ Cached customer info for: ${id}`);

      return optimizedInfo;

    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        console.log(`⏹️ Aborted fetch for: ${id}`);
        return null;
      }
      throw err;
    }
  }, []);

  // ========================================================================
  // REFETCH FUNCTION
  // ========================================================================

  const refetch = useCallback(() => {
    if (!contactId || !enabled) return;

    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setLoading(true);
    setError(null);

    fetchCustomerInfo(contactId, abortController.signal)
      .then((result) => {
        if (result) {
          setCustomerInfo(result);
          setError(null);
        }
      })
      .catch((err) => {
        console.error(`❌ Error fetching customer ${contactId}:`, err);
        setError(err.message || 'Unknown error');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [contactId, enabled, fetchCustomerInfo]);

  // ========================================================================
  // MAIN EFFECT - INSTANT CACHE + BACKGROUND REFRESH
  // ========================================================================

  useEffect(() => {
    if (!contactId || !enabled) {
      setCustomerInfo(null);
      setLoading(false);
      setError(null);
      return;
    }

    // STEP 1: Check cache IMMEDIATELY (zero delay)
    const cached = ultraCache.get(contactId);

    if (cached) {
      console.log(`⚡ INSTANT cache hit for: ${contactId}`);
      setCustomerInfo(cached);
      setLoading(false);
      setError(null);

      // STEP 2: Background refresh if data is older than 5 minutes
      const age = Date.now() - cached.fetchedAt;
      const shouldRefresh = age > 5 * 60 * 1000; // 5 minutes

      if (shouldRefresh) {
        console.log(`🔄 Background refresh for: ${contactId}`);
        // Background fetch without setting loading to true
        fetchCustomerInfo(contactId)
          .then((result) => {
            if (result) {
              setCustomerInfo(result);
            }
          })
          .catch((err) => {
            console.warn(`⚠️ Background refresh failed for ${contactId}:`, err);
            // Don't set error for background refresh failures
          });
      }

      return;
    }

    // STEP 3: No cache, fetch with loading state
    console.log(`💾 No cache, fetching: ${contactId}`);
    refetch();

  }, [contactId, enabled, fetchCustomerInfo, refetch]);

  // ========================================================================
  // CLEANUP
  // ========================================================================

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // ========================================================================
  // RETURN
  // ========================================================================

  return {
    customerInfo,
    loading,
    error,
    refetch
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getDisplayName(contact: any): string {
  if (contact.displayName) return contact.displayName;
  if (contact.name) return contact.name;
  if (contact.firstName || contact.lastName) {
    return [contact.firstName, contact.lastName].filter(Boolean).join(' ');
  }
  return 'Άγνωστος πελάτης';
}

function getPrimaryPhone(contact: any): string | null {
  if (contact.phone) return contact.phone;
  if (contact.primaryPhone) return contact.primaryPhone;
  if (contact.phones && contact.phones.length > 0) {
    return contact.phones[0].number || contact.phones[0];
  }
  return null;
}

function getPrimaryEmail(contact: any): string | null {
  if (contact.email) return contact.email;
  if (contact.primaryEmail) return contact.primaryEmail;
  if (contact.emails && contact.emails.length > 0) {
    return contact.emails[0].email || contact.emails[0];
  }
  return null;
}

// ============================================================================
// CACHE MANAGEMENT EXPORTS
// ============================================================================

export const customerInfoCache = {
  clear: () => ultraCache.clear(),
  has: (contactId: string) => ultraCache.has(contactId),
  get: (contactId: string) => ultraCache.get(contactId),
  size: () => ultraCache['cache'].size
};