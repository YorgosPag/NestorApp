
import { useEffect, useState, useCallback, useRef } from "react";
import type { ProjectCustomer } from "@/types/project";
import type { UseProjectCustomersState } from "../types";

// ============================================================================
// 🏢 ENTERPRISE: Hook Options για Lazy Loading
// ============================================================================

interface UseProjectCustomersOptions {
  /**
   * If false, the hook will not fetch data until enabled becomes true.
   * Useful for lazy loading - defer fetch until user needs the data.
   * @default true
   */
  enabled?: boolean;
}

// ============================================================================
// 🏢 ENTERPRISE: Extended Return Type
// ============================================================================

interface UseProjectCustomersReturn extends UseProjectCustomersState {
  /** Manually trigger a refetch */
  refetch: () => Promise<void>;
  /** Whether data has been fetched at least once */
  isFetched: boolean;
}

// ============================================================================
// 🏢 ENTERPRISE: Main Hook
// ============================================================================

export function useProjectCustomers(
  projectId: number,
  options: UseProjectCustomersOptions = {}
): UseProjectCustomersReturn {
  const { enabled = true } = options;

  const [customers, setCustomers] = useState<ProjectCustomer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFetched, setIsFetched] = useState(false);

  // Track mounted state to prevent state updates after unmount
  const mountedRef = useRef(true);
  // Track if we've already fetched once to avoid duplicate calls
  const hasFetchedRef = useRef(false);

  // 🏢 ENTERPRISE: Extracted fetch logic for reusability
  const fetchCustomers = useCallback(async () => {
    if (!projectId) return;

    setLoading(true);
    setError(null);

    try {
      console.log(`🔄 [LazyLoad] Fetching project customers for projectId: ${projectId}`);

      const response = await fetch(`/api/projects/${projectId}/customers`);

      if (!response.ok) {
        // 🎯 ENTERPRISE ERROR HANDLING: Handle both JSON and HTML error responses
        const contentType = response.headers.get('Content-Type') || '';

        if (contentType.includes('application/json')) {
          const errorData = await response.json();
          throw new Error(errorData.message || errorData.error || `HTTP ${response.status}: ${response.statusText}`);
        } else {
          // HTML error page received (Next.js development error)
          console.error('🚨 [LazyLoad] Received HTML instead of JSON');
          throw new Error(`API Error: Server returned HTML error page (Status: ${response.status})`);
        }
      }

      const result = await response.json();

      if (result.success === false) {
        throw new Error(result.message || result.error || 'Enterprise API returned error status');
      }

      // 🎯 ENTERPRISE: Handle both old format (direct array) and new format (with customers property)
      const customersData = result.customers || result;

      console.log(`✅ [LazyLoad] Project customers loaded: ${Array.isArray(customersData) ? customersData.length : 0} customers`);

      if (mountedRef.current) {
        setCustomers(Array.isArray(customersData) ? customersData : []);
        setIsFetched(true);
        hasFetchedRef.current = true;
      }

    } catch (e) {
      console.error("❌ [LazyLoad] Failed to fetch project customers:", e);
      const errorMessage = e instanceof Error ? e.message : "Κρίσιμο σφάλμα φόρτωσης πελατών.";
      if (mountedRef.current) {
        setError(errorMessage);
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [projectId]);

  // 🏢 ENTERPRISE: Manual refetch capability
  const refetch = useCallback(async () => {
    hasFetchedRef.current = false;
    await fetchCustomers();
  }, [fetchCustomers]);

  // 🏢 ENTERPRISE: Effect with enabled flag support
  useEffect(() => {
    mountedRef.current = true;

    // Only fetch if enabled AND we haven't fetched yet
    if (enabled && !hasFetchedRef.current && projectId) {
      fetchCustomers();
    }

    return () => {
      mountedRef.current = false;
    };
  }, [enabled, projectId, fetchCustomers]);

  // 🏢 ENTERPRISE: Reset on projectId change
  useEffect(() => {
    if (projectId) {
      // Reset state when projectId changes
      hasFetchedRef.current = false;
      setCustomers([]);
      setError(null);
      setIsFetched(false);
    }
  }, [projectId]);

  return {
    customers,
    loading,
    error,
    refetch,
    isFetched
  };
}
