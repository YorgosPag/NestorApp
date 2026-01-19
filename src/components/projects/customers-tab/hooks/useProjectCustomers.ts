
import { useEffect, useState, useCallback, useRef } from "react";
// 🏢 ENTERPRISE: Centralized API client with automatic authentication
import { apiClient } from '@/lib/api/enterprise-api-client';
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

      // 🏢 ENTERPRISE: Type-safe API response with automatic authentication
      interface ProjectCustomersApiResponse {
        customers?: ProjectCustomer[];
      }

      const result = await apiClient.get<ProjectCustomersApiResponse | ProjectCustomer[]>(`/api/projects/${projectId}/customers`);

      // 🎯 ENTERPRISE: Handle both old format (direct array) and new format (with customers property)
      const customersData = Array.isArray(result)
        ? result
        : (result as ProjectCustomersApiResponse)?.customers || [];

      console.log(`✅ [LazyLoad] Project customers loaded: ${customersData.length} customers`);

      if (mountedRef.current) {
        setCustomers(customersData);
        setIsFetched(true);
        hasFetchedRef.current = true;
      }

    } catch (e) {
      console.error("❌ [LazyLoad] Failed to fetch project customers:", e);
      // 🌐 i18n: Error message converted to i18n key - 2026-01-18
      const errorMessage = e instanceof Error ? e.message : "projects.customers.errors.loadFailed";
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
