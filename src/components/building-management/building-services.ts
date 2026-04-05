
'use client';

/**
 * 🏢 ENTERPRISE BUILDINGS & COMPANIES DATA SERVICES - PRODUCTION READY
 *
 * Αντικατέστησε τα sample data με επαγγελματικά Firebase/Database services.
 * Όλα τα δεδομένα προέρχονται από production βάση δεδομένων.
 */

// 🏢 ENTERPRISE: Centralized real-time service for cross-page sync
import { RealtimeService, type BuildingUpdatedPayload } from '@/services/realtime';
// 🏢 ENTERPRISE: Centralized API client (Fortune-500 pattern)
import { apiClient, ApiClientError } from '@/lib/api/enterprise-api-client';
import { API_ROUTES } from '@/config/domain-constants';
// 🏢 ENTERPRISE: Multi-address support (ADR-167)
import type { ProjectAddress } from '@/types/project/addresses';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('BuildingServices');

/**
 * 🏢 ENTERPRISE: Building update payload type
 * Type-safe updates for building modifications
 */
export interface BuildingUpdatePayload {
  /** ADR-233 §3.4: locked building identifier (e.g. "Κτήριο Α") */
  code?: string;
  name?: string;
  description?: string;
  totalArea?: number;
  builtArea?: number;
  floors?: number;
  units?: number;
  totalValue?: number;
  startDate?: string;
  completionDate?: string;
  address?: string;
  city?: string;
  status?: string;
  projectId?: string | null;      // 🏢 ENTERPRISE: Link building to project
  // 🔒 SECURITY: companyId is TENANT field (immutable) — use linkedCompanyId for association
  linkedCompanyId?: string | null; // 🏢 ENTERPRISE: Company association (contact ID)
  linkedCompanyName?: string | null; // 🏢 ENTERPRISE: Company display name
  company?: string | null;         // 🏢 ENTERPRISE: Legacy company display name
  addresses?: ProjectAddress[];    // 🏢 ENTERPRISE: Multi-address support (ADR-167)
}

/**
 * 🏗️ ENTERPRISE: Ενημέρωση κτιρίου μέσω API (Admin SDK)
 *
 * 🔒 SECURITY: Firestore rules απαγορεύουν client-side writes (allow write: if false)
 *              Χρησιμοποιούμε API endpoint που τρέχει με Admin SDK
 *
 * @see src/app/api/buildings/route.ts (PATCH handler)
 */
export async function updateBuilding(
  buildingId: string,
  updates: BuildingUpdatePayload & { _v?: number }
): Promise<{ success: boolean; error?: string; _v?: number }> {
  try {
    logger.info('Updating building via API', { buildingId });

    // 🏢 ENTERPRISE: Use centralized API client (automatic Bearer token)
    // 🔒 SECURITY: apiClient handles Firebase ID token injection
    // SPEC-256A: _v included in payload for optimistic versioning
    const response = await apiClient.patch<{ data: { buildingId: string; updated: boolean; _v?: number } }>(
      API_ROUTES.BUILDINGS.LIST,
      { buildingId, ...updates }
    );

    logger.info('Building updated successfully', { buildingId });

    // 🏢 ENTERPRISE: Centralized Real-time Service (cross-page sync)
    // Dispatch ALL changed fields so components update their local state
    const { _v: _versionField, ...fieldsToDispatch } = updates;
    const dispatchUpdates: BuildingUpdatedPayload['updates'] = {};
    for (const [key, value] of Object.entries(fieldsToDispatch)) {
      if (value !== undefined) {
        (dispatchUpdates as Record<string, unknown>)[key] = value;
      }
    }
    RealtimeService.dispatch('BUILDING_UPDATED', {
      buildingId,
      updates: dispatchUpdates,
      timestamp: Date.now()
    });

    return { success: true, _v: response?.data?._v };

  } catch (error) {
    // SPEC-256A: Re-throw 409 conflicts so useVersionedSave can handle them
    if (ApiClientError.isApiClientError(error) && error.statusCode === 409) {
      throw error;
    }
    logger.error('updateBuilding failed', { error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * 🏢 ENTERPRISE: Building create payload type
 * Type-safe data for building creation
 */
export interface BuildingCreatePayload {
  /** ADR-233 §3.4: locked building identifier (e.g. "Κτήριο Α") */
  code: string;
  name: string;
  description?: string;
  address?: string;
  city?: string;
  totalArea?: number;
  builtArea?: number;
  floors?: number;
  units?: number;
  totalValue?: number;
  startDate?: string;
  completionDate?: string;
  status?: string;
  projectId?: string | null;
  companyId: string;
  company?: string;
  addresses?: ProjectAddress[];  // 🏢 ENTERPRISE: Multi-address support (ADR-167)
}

/**
 * 🏗️ ENTERPRISE: Δημιουργία νέου κτιρίου μέσω API (Admin SDK)
 *
 * 🔒 SECURITY: Firestore rules απαγορεύουν client-side writes (allow write: if false)
 *              Χρησιμοποιούμε API endpoint που τρέχει με Admin SDK
 *
 * @see src/app/api/buildings/route.ts (POST handler)
 */
export async function createBuilding(
  data: BuildingCreatePayload
): Promise<{ success: boolean; buildingId?: string; error?: string; errorCode?: string }> {
  try {
    logger.info('Creating new building via API');

    // 🏢 ENTERPRISE: Use centralized API client (automatic Bearer token)
    // 🔒 SECURITY: apiClient handles Firebase ID token injection
    interface BuildingCreateResult {
      buildingId: string;
    }
    const result = await apiClient.post<BuildingCreateResult>(API_ROUTES.BUILDINGS.LIST, data);

    const buildingId = result?.buildingId;
    logger.info('Building created', { buildingId });

    // 🏢 ENTERPRISE: Centralized Real-time Service (cross-page sync)
    RealtimeService.dispatch('BUILDING_CREATED', {
      buildingId,
      building: {
        name: data.name,
        address: data.address,
        city: data.city,
        projectId: data.projectId,
      },
      timestamp: Date.now()
    });

    return { success: true, buildingId };

  } catch (error) {
    logger.error('createBuilding failed', { error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      errorCode: ApiClientError.isApiClientError(error) ? error.errorCode : undefined,
    };
  }
}

/**
 * 🏗️ ENTERPRISE: Διαγραφή κτιρίου μέσω API (Admin SDK)
 *
 * 🔒 SECURITY: Firestore rules απαγορεύουν client-side writes (allow write: if false)
 *              Χρησιμοποιούμε API endpoint που τρέχει με Admin SDK
 *
 * @see src/app/api/buildings/[buildingId]/route.ts (DELETE handler)
 */
export async function deleteBuilding(
  buildingId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    logger.info('Deleting building via API', { buildingId });

    // 🏢 ENTERPRISE: Use centralized API client (automatic Bearer token)
    await apiClient.delete(API_ROUTES.BUILDINGS.BY_ID(buildingId));

    logger.info('Building deleted successfully', { buildingId });

    // 🏢 ENTERPRISE: Centralized Real-time Service (cross-page sync)
    RealtimeService.dispatch('BUILDING_DELETED', {
      buildingId,
      timestamp: Date.now()
    });

    return { success: true };

  } catch (error) {
    logger.error('deleteBuilding failed', { error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * 🎯 ENTERPRISE: Ανάκτηση έργων μέσω API (Admin SDK + RBAC)
 *
 * 🔒 SECURITY: Χρησιμοποιεί /api/projects/list με proper tenant isolation
 *              Super Admin → ΟΛΑ τα projects
 *              Regular user → μόνο τα projects της εταιρείας τους
 *
 * 🐛 FIX (2026-02-06): Αντικατέστησε client-side Firestore query που είχε
 *    orderBy('name') → αποκλείε documents χωρίς 'name' field
 *
 * @see src/app/api/projects/list/route.ts
 */
/** 🏢 ENTERPRISE: Project item with company info for dropdown filtering */
export interface ProjectListItem {
  id: string;
  name: string;
  /** License title (τίτλος αδείας) — shown in "Τρέχον έργο" label */
  licenseTitle?: string;
  companyId: string | null;
  /** 🏢 ADR-232: Business entity link (separate from tenant companyId) */
  linkedCompanyId: string | null;
  companyName: string;
}

export async function getProjectsList(): Promise<ProjectListItem[]> {
  try {
    interface ProjectFromAPI {
      id: string;
      name: string;
      title: string;
      companyId: string;
      linkedCompanyId: string | null;
      company: string;
    }

    interface ProjectListResponse {
      projects: ProjectFromAPI[];
      count: number;
    }

    const result = await apiClient.get<ProjectListResponse>(API_ROUTES.PROJECTS.LIST);

    if (!result || !result.projects) {
      logger.warn('Invalid response from projects API');
      return [];
    }

    const projects: ProjectListItem[] = result.projects.map(project => ({
      id: project.id,
      name: project.name || project.title || 'entities.project.unknown',
      licenseTitle: project.title || '',
      companyId: project.companyId || null,
      linkedCompanyId: project.linkedCompanyId || null,
      companyName: project.company || '',
    }));

    logger.info('Loaded projects via Enterprise API', { count: projects.length });
    return projects;

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const errorCode = ApiClientError.isApiClientError(error) ? error.errorCode : undefined;
    const statusCode = ApiClientError.isApiClientError(error) ? error.statusCode : undefined;
    logger.error(
      `getProjectsList failed: ${message} (status=${statusCode ?? 'n/a'}, code=${errorCode ?? 'n/a'})`
    );
    return [];
  }
}

/**
 * ENTERPRISE: Fetch addresses of a specific project
 *
 * Used by BuildingAddressesCard to show parent project's addresses
 * so the user can SELECT which addresses apply to the building.
 *
 * @see src/app/api/projects/[projectId]/route.ts (GET handler)
 */
/**
 * 🏢 ENTERPRISE: Fetch existing building `code` values for a project (ADR-233 §3.4).
 *
 * Used by GeneralTabContent (inline create mode) to auto-suggest the next
 * sequential code ("Κτήριο Α", "Κτήριο Β", ...) when the user picks a project.
 *
 * @param projectId - Parent project ID
 * @returns Array of codes (omits buildings without a `code` field)
 */
export async function getBuildingCodesByProject(projectId: string): Promise<string[]> {
  try {
    interface BuildingsListResponse {
      buildings: Array<{ code?: string; name?: string }>;
      count: number;
    }
    const result = await apiClient.get<BuildingsListResponse>(
      `${API_ROUTES.BUILDINGS.LIST}?projectId=${encodeURIComponent(projectId)}`
    );
    if (!result?.buildings) return [];
    return result.buildings
      .map((building) => (building.code || '').trim())
      .filter((code) => code.length > 0);
  } catch (error) {
    logger.error('getBuildingCodesByProject failed', { error, projectId });
    return [];
  }
}

export async function getProjectAddresses(
  projectId: string
): Promise<{ addresses: ProjectAddress[]; legacyAddress?: string; legacyCity?: string }> {
  try {
    interface ProjectGetResult {
      project: {
        id: string;
        addresses?: ProjectAddress[];
        address?: string;
        city?: string;
      };
    }

    const result = await apiClient.get<ProjectGetResult>(API_ROUTES.PROJECTS.BY_ID(projectId));

    if (!result?.project) {
      logger.warn('No project data found', { projectId });
      return { addresses: [] };
    }

    return {
      addresses: result.project.addresses || [],
      legacyAddress: result.project.address,
      legacyCity: result.project.city,
    };
  } catch (error) {
    logger.error('getProjectAddresses failed', { error });
    return { addresses: [] };
  }
}

