'use client';

/**
 * 🏢 ENTERPRISE: Client-side Projects Service
 *
 * Provides client-side CRUD operations for Projects with real-time sync.
 * Uses Firebase client SDK for direct Firestore operations.
 * Dispatches events via RealtimeService for cross-page synchronization.
 *
 * NOTE: Server-side operations (server actions) are in projects.service.ts
 * This file is for client-side operations that need immediate real-time dispatch.
 */

import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { API_ROUTES } from '@/config/domain-constants';
import { COLLECTIONS } from '@/config/firestore-collections';
// 🏢 ENTERPRISE: Direct Firestore writes removed - now using Admin SDK via API endpoints
import type { Project, ProjectStatus } from '@/types/project';
import type { LandownerEntry } from '@/types/ownership-table';
import type { ProjectAddress } from '@/types/project/addresses';
// 🏢 ENTERPRISE: Centralized real-time service for cross-page sync
import { RealtimeService, type ProjectUpdatedPayload } from '@/services/realtime';
// 🏢 ENTERPRISE: Centralized API client (Fortune-500 pattern)
import { apiClient, ApiClientError } from '@/lib/api/enterprise-api-client';
import { invalidateProjectsList } from '@/hooks/useProjectsList';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';

const logger = createModuleLogger('ProjectsClientService');

/**
 * 🏢 ENTERPRISE: Project create payload type
 * Type-safe data for project creation
 *
 * 🏢 ADR-167: Multi-address support
 * - Legacy fields (address, city) maintained for backward compatibility
 * - New addresses[] array for multi-address projects
 */
export interface ProjectCreatePayload {
  name: string;
  title?: string;
  description?: string;
  status?: ProjectStatus;
  companyId: string;
  company?: string;
  /** 🏢 ADR-232: Business entity link (separate from tenant companyId) */
  linkedCompanyId?: string | null;
  // Legacy fields (auto-synced from primary address)
  address?: string;
  city?: string;
  // 🏢 ENTERPRISE: Multi-address support (ADR-167)
  addresses?: ProjectAddress[];
}

/**
 * 🏢 ENTERPRISE: Project update payload type
 * Type-safe updates for project modifications
 *
 * 🏢 ADR-167: Multi-address support
 * - Legacy fields (address, city) maintained for backward compatibility
 * - New addresses[] array for multi-address projects
 */
export interface ProjectUpdatePayload {
  name?: string;
  title?: string;
  description?: string;
  status?: ProjectStatus;
  // Legacy fields (auto-synced from primary address)
  address?: string;
  city?: string;
  // 🏢 ENTERPRISE: Multi-address support (ADR-167)
  addresses?: ProjectAddress[];
  /** 🏢 ADR-232: Business entity link (separate from tenant companyId) */
  linkedCompanyId?: string | null;
  // Extended project fields
  buildingBlock?: string;
  protocolNumber?: string;
  licenseNumber?: string;
  issuingAuthority?: string;
  issueDate?: string;
  client?: string;
  location?: string;
  type?: string;
  priority?: string;
  riskLevel?: string;
  complexity?: string;
  budget?: number;
  totalValue?: number;
  totalArea?: number;
  duration?: number;
  startDate?: string | null;
  completionDate?: string | null;
  // 🏢 SPEC-256A: Optimistic versioning
  _v?: number;
  /** ADR-244: Οικοπεδούχοι — SSoT */
  landowners?: LandownerEntry[] | null;
  /** ADR-244: Ποσοστό αντιπαροχής (%) */
  bartexPercentage?: number | null;
  /** ADR-244: Denormalized contact IDs for queries */
  landownerContactIds?: string[] | null;
}

/**
 * 🎯 ENTERPRISE: Δημιουργία νέου έργου μέσω API (Admin SDK)
 *
 * 🔒 SECURITY: Firestore rules απαγορεύουν client-side writes (allow write: if false)
 *              Χρησιμοποιούμε API endpoint που τρέχει με Admin SDK
 *
 * @see src/app/api/projects/list/route.ts (POST handler)
 */
export async function createProject(
  data: ProjectCreatePayload
): Promise<{ success: boolean; projectId?: string; error?: string; errorCode?: string }> {
  try {
    logger.info('Creating new project via API');

    // 🏢 ENTERPRISE: Use centralized API client (automatic Bearer token)
    // 🔒 SECURITY: apiClient handles Firebase ID token injection
    interface ProjectCreateResult {
      projectId: string;
    }
    const result = await apiClient.post<ProjectCreateResult>(API_ROUTES.PROJECTS.LIST, data);

    const projectId = result?.projectId;
    logger.info('Project created', { projectId });

    // 🏢 Invalidate client-side projects cache — every useProjectsList
    // consumer (forms, dropdowns, pickers) will auto-refetch and show the
    // new project without a manual reload.
    invalidateProjectsList();

    // 🏢 ENTERPRISE: Centralized Real-time Service (cross-page sync)
    RealtimeService.dispatch('PROJECT_CREATED', {
      projectId,
      project: {
        name: data.name,
        title: data.title,
        status: data.status,
        companyId: data.companyId,
      },
      timestamp: Date.now()
    });

    return { success: true, projectId };

  } catch (error) {
    const message = getErrorMessage(error);
    const errorCode = ApiClientError.isApiClientError(error) ? error.errorCode : undefined;
    const statusCode = ApiClientError.isApiClientError(error) ? error.statusCode : undefined;
    logger.error(`Error creating project: ${message} (status=${statusCode ?? 'n/a'}, code=${errorCode ?? 'n/a'})`);
    return {
      success: false,
      error: message,
      errorCode,
    };
  }
}

/**
 * 🎯 ENTERPRISE: Ενημέρωση έργου μέσω API (Admin SDK)
 *
 * 🔒 SECURITY: Firestore rules απαγορεύουν client-side writes (allow write: if false)
 *              Χρησιμοποιούμε API endpoint που τρέχει με Admin SDK
 *
 * @see src/app/api/projects/[projectId]/route.ts (PATCH handler)
 */
export async function updateProjectClient(
  projectId: string,
  updates: ProjectUpdatePayload
): Promise<{ success: boolean; error?: string; _v?: number }> {
  try {
    logger.info('Updating project via API', { projectId });

    // 🏢 ENTERPRISE: Use centralized API client (automatic Bearer token)
    // 🔒 SECURITY: apiClient handles Firebase ID token injection
    // SPEC-256A: _v included in payload for optimistic versioning
    const response = await apiClient.patch<{ _v?: number }>(
      API_ROUTES.PROJECTS.BY_ID(projectId),
      updates
    );

    logger.info('Project updated successfully', { projectId });

    // 🏢 ENTERPRISE: Centralized Real-time Service (cross-page sync)
    // Dynamic dispatch: only include non-undefined fields to avoid overwriting existing values
    const { _v: _versionField, ...fieldsToDispatch } = updates;
    const dispatchUpdates: ProjectUpdatedPayload['updates'] = {};
    for (const [key, value] of Object.entries(fieldsToDispatch)) {
      if (value !== undefined) {
        (dispatchUpdates as Record<string, unknown>)[key] = value;
      }
    }
    RealtimeService.dispatch('PROJECT_UPDATED', {
      projectId,
      updates: dispatchUpdates,
      timestamp: Date.now()
    });

    return { success: true, _v: response?._v };

  } catch (error) {
    // SPEC-256A: Re-throw 409 conflicts so useVersionedSave can handle them
    if (ApiClientError.isApiClientError(error) && error.statusCode === 409) {
      throw error;
    }
    logger.error('Error updating project', { projectId, error });
    return {
      success: false,
      error: getErrorMessage(error)
    };
  }
}

/**
 * 🎯 ENTERPRISE: Διαγραφή έργου μέσω API (Admin SDK)
 *
 * 🔒 SECURITY: Firestore rules απαγορεύουν client-side writes (allow write: if false)
 *              Χρησιμοποιούμε API endpoint που τρέχει με Admin SDK
 *
 * @see src/app/api/projects/[projectId]/route.ts (DELETE handler)
 */
export async function deleteProject(
  projectId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    logger.info('Deleting project via API', { projectId });

    // 🏢 ENTERPRISE: Use centralized API client (automatic Bearer token)
    // 🔒 SECURITY: apiClient handles Firebase ID token injection
    await apiClient.delete(API_ROUTES.PROJECTS.BY_ID(projectId));

    logger.info('Project deleted successfully', { projectId });

    // 🏢 ENTERPRISE: Centralized Real-time Service (cross-page sync)
    RealtimeService.dispatch('PROJECT_DELETED', {
      projectId,
      timestamp: Date.now()
    });

    return { success: true };

  } catch (error) {
    logger.error('Error deleting project', { projectId, error });
    return {
      success: false,
      error: getErrorMessage(error)
    };
  }
}

/**
 * 🎯 ENTERPRISE: Λίστα έργων από Firebase (Client-side)
 * Για περιπτώσεις που χρειάζεται client-side fetch
 */
export async function getProjectsClient(limitCount: number = 100): Promise<Project[]> {
  try {
    logger.info('Starting Firestore query');

    const projectsQuery = query(
      collection(db, COLLECTIONS.PROJECTS),
      orderBy('name', 'asc'),
      limit(limitCount)
    );
    const snapshot = await getDocs(projectsQuery);

    const projects = snapshot.docs.map(docSnap => ({
      id: docSnap.id,
      ...docSnap.data()
    })) as Project[];

    logger.info('Loaded projects from Firebase', { count: projects.length });
    return projects;

  } catch (error) {
    logger.error('Error loading projects', { error });
    return [];
  }
}
