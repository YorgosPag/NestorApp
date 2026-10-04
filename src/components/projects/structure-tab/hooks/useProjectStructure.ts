
// 🏢 ENTERPRISE: Centralized API client with automatic authentication
import { apiClient } from '@/lib/api/enterprise-api-client';
import { API_ROUTES } from '@/config/domain-constants';
import type { UseProjectStructureState } from "../types";
// 🏢 ENTERPRISE: Types imported from contracts (not server actions file)
import type { ProjectStructure } from "@/services/projects/contracts";
import { createModuleLogger } from '@/lib/telemetry';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useLazyProjectResource } from '../../hooks/useLazyProjectResource';

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

// 🏢 ENTERPRISE: Type-safe API response with automatic authentication
interface ProjectStructureApiResponse {
  structure: ProjectStructure;
  summary?: Record<string, unknown>;
}

async function fetchProjectStructure(projectId: string): Promise<ProjectStructure | null> {
  logger.info('Fetching project structure', { projectId });
  try {
    const result = await apiClient.get<ProjectStructureApiResponse>(API_ROUTES.PROJECTS.STRUCTURE(projectId));
    logger.info('Project structure loaded', { summary: result?.summary });
    return result?.structure || null;
  } catch (e) {
    logger.error('Failed to fetch project structure', { error: e });
    throw e;
  }
}

// ============================================================================
// 🏢 ENTERPRISE: Main Hook — lifecycle in useLazyProjectResource (SSoT)
// ============================================================================

export function useProjectStructure(
  projectId: string,
  options: UseProjectStructureOptions = {}
): UseProjectStructureReturn {
  const { enabled = true } = options;
  const { t } = useTranslation(['projects', 'projects-data', 'projects-ika']);

  const { data, loading, error, refetch, isFetched } = useLazyProjectResource<ProjectStructure | null>({
    projectId,
    enabled,
    empty: null,
    fetcher: fetchProjectStructure,
    fallbackError: t("structure.errors.loadFailed"),
  });

  return { structure: data, loading, error, refetch, isFetched };
}
