
import { useEffect, useState, useCallback, useRef } from "react";
// 🏢 ENTERPRISE: Centralized API client with automatic authentication
import { apiClient } from '@/lib/api/enterprise-api-client';
import type { UseProjectStructureState } from "../types";
// 🏢 ENTERPRISE: Types imported from contracts (not server actions file)
import type { ProjectStructure } from "@/services/projects/contracts";
import { createModuleLogger } from '@/lib/telemetry';
import { useTranslation } from '@/i18n/hooks/useTranslation';

const logger = createModuleLogger('useProjectStructure');

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
  projectId: string,
  options: UseProjectStructureOptions = {}
): UseProjectStructureReturn {
  const { enabled = true } = options;
  const { t } = useTranslation('projects');

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
    if (!projectId || projectId === '__new__') return;

    setLoading(true);
    setError(null);

    try {
      logger.info('Fetching project structure', { projectId });

      // 🏢 ENTERPRISE: Type-safe API response with automatic authentication
      interface ProjectStructureApiResponse {
        structure: ProjectStructure;
        summary?: Record<string, unknown>;
      }

      const result = await apiClient.get<ProjectStructureApiResponse>(`/api/projects/structure/${projectId}`);

      logger.info('Project structure loaded', { summary: result?.summary });

      if (mountedRef.current) {
        setStructure(result?.structure || null);
        setIsFetched(true);
        hasFetchedRef.current = true;
      }

    } catch (e) {
      logger.error('Failed to fetch project structure', { error: e });
      // 🌐 i18n: Error message converted to i18n key - 2026-01-18
      const errorMessage = e instanceof Error ? e.message : t("structure.errors.loadFailed");
      if (mountedRef.current) {
        setError(errorMessage);
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [projectId, t]);

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
  }, [projectId, t]);

  return {
    structure,
    loading,
    error,
    refetch,
    isFetched
  };
}
