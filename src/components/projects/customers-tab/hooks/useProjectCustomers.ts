
// 🏢 ENTERPRISE: Centralized API client with automatic authentication
import { apiClient } from '@/lib/api/enterprise-api-client';
import { API_ROUTES } from '@/config/domain-constants';
import type { ProjectCustomer } from "@/types/project";
import type { UseProjectCustomersState } from "../types";
import { createModuleLogger } from '@/lib/telemetry';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useLazyProjectResource } from '../../hooks/useLazyProjectResource';

const logger = createModuleLogger('useProjectCustomers');

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

// 🏢 ENTERPRISE: Type-safe API response with automatic authentication
interface ProjectCustomersApiResponse {
  customers?: ProjectCustomer[];
}

const NO_CUSTOMERS: ProjectCustomer[] = [];

async function fetchProjectCustomers(projectId: string): Promise<ProjectCustomer[]> {
  logger.info('Fetching project customers', { projectId });
  try {
    const result = await apiClient.get<ProjectCustomersApiResponse | ProjectCustomer[]>(API_ROUTES.PROJECTS.CUSTOMERS(projectId));
    // 🎯 ENTERPRISE: Handle both old format (direct array) and new format (with customers property)
    const customersData = Array.isArray(result) ? result : result?.customers || [];
    logger.info('Project customers loaded', { count: customersData.length });
    return customersData;
  } catch (e) {
    logger.error('Failed to fetch project customers', { error: e });
    throw e;
  }
}

// ============================================================================
// 🏢 ENTERPRISE: Main Hook — lifecycle in useLazyProjectResource (SSoT)
// ============================================================================

export function useProjectCustomers(
  projectId: string,
  options: UseProjectCustomersOptions = {}
): UseProjectCustomersReturn {
  const { enabled = true } = options;
  const { t } = useTranslation(['projects', 'projects-data', 'projects-ika']);

  const { data, loading, error, refetch, isFetched } = useLazyProjectResource({
    projectId,
    enabled,
    empty: NO_CUSTOMERS,
    fetcher: fetchProjectCustomers,
    fallbackError: t("customers.errors.loadFailed"),
  });

  return { customers: data, loading, error, refetch, isFetched };
}
