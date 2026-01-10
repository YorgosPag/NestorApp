
import { useEffect, useState, useCallback, useRef } from "react";
import type { UseProjectStructureState } from "../types";
import type { ProjectStructure } from "@/services/projects.service";

// ============================================================================
// 🏢 ENTERPRISE: Hook Options για Lazy Loading
// ============================================================================

interface UseProjectStructureOptions {
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

interface UseProjectStructureReturn extends UseProjectStructureState {
  /** Manually trigger a refetch */
  refetch: () => Promise<void>;
  /** Whether data has been fetched at least once */
  isFetched: boolean;
}

// ============================================================================
// 🏢 ENTERPRISE: Main Hook
// ============================================================================

export function useProjectStructure(
  projectId: number,
  options: UseProjectStructureOptions = {}
): UseProjectStructureReturn {
  const { enabled = true } = options;

  const [structure, setStructure] = useState<ProjectStructure | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFetched, setIsFetched] = useState(false);

  // Track mounted state to prevent state updates after unmount
  const mountedRef = useRef(true);
  // Track if we've already fetched once to avoid duplicate calls
  const hasFetchedRef = useRef(false);

  // 🏢 ENTERPRISE: Extracted fetch logic for reusability
  const fetchStructure = useCallback(async () => {
    if (!projectId) return;

    setLoading(true);
    setError(null);

    try {
      console.log(`🔄 [LazyLoad] Fetching project structure for projectId: ${projectId}`);

      const response = await fetch(`/api/projects/structure/${projectId}`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Άγνωστο σφάλμα από το API');
      }

      console.log(`✅ [LazyLoad] Project structure loaded successfully:`, result.summary);

      if (mountedRef.current) {
        setStructure(result.structure);
        setIsFetched(true);
        hasFetchedRef.current = true;
      }

    } catch (e) {
      console.error("❌ [LazyLoad] Failed to fetch project structure:", e);
      const errorMessage = e instanceof Error ? e.message : "Αποτυχία φόρτωσης δομής έργου.";
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
    await fetchStructure();
  }, [fetchStructure]);

  // 🏢 ENTERPRISE: Effect with enabled flag support
  useEffect(() => {
    mountedRef.current = true;

    // Only fetch if enabled AND we haven't fetched yet
    if (enabled && !hasFetchedRef.current && projectId) {
      fetchStructure();
    }

    return () => {
      mountedRef.current = false;
    };
  }, [enabled, projectId, fetchStructure]);

  // 🏢 ENTERPRISE: Reset on projectId change
  useEffect(() => {
    if (projectId) {
      // Reset state when projectId changes
      hasFetchedRef.current = false;
      setStructure(null);
      setError(null);
      setIsFetched(false);
    }
  }, [projectId]);

  return {
    structure,
    loading,
    error,
    refetch,
    isFetched
  };
}
