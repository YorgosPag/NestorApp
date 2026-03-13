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
import { COLLECTIONS } from '@/config/firestore-collections';
// 🏢 ENTERPRISE: Direct Firestore writes removed - now using Admin SDK via API endpoints
import type { Project, ProjectStatus } from '@/types/project';
import type { ProjectAddress } from '@/types/project/addresses';
// 🏢 ENTERPRISE: Centralized real-time service for cross-page sync
import { RealtimeService, type ProjectUpdatedPayload } from '@/services/realtime';
// 🏢 ENTERPRISE: Centralized API client (Fortune-500 pattern)
import { apiClient } from '@/lib/api/enterprise-api-client';
import { createModuleLogger } from '@/lib/telemetry';

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
): Promise<{ success: boolean; projectId?: string; error?: string }> {
  try {
    logger.info('Creating new project via API');

    // 🏢 ENTERPRISE: Use centralized API client (automatic Bearer token)
    // 🔒 SECURITY: apiClient handles Firebase ID token injection
    interface ProjectCreateResult {
      projectId: string;
    }
    const result = await apiClient.post<ProjectCreateResult>('/api/projects/list', data);

    const projectId = result?.projectId;
    logger.info('Project created', { projectId });

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
    logger.error('Error creating project', { error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
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
): Promise<{ success: boolean; error?: string }> {
  try {
    logger.info('Updating project via API', { projectId });

    // 🏢 ENTERPRISE: Use centralized API client (automatic Bearer token)
    // 🔒 SECURITY: apiClient handles Firebase ID token injection
    await apiClient.patch(`/api/projects/${projectId}`, updates);

    logger.info('Project updated successfully', { projectId });

    // 🏢 ENTERPRISE: Centralized Real-time Service (cross-page sync)
    // Dynamic dispatch: only include non-undefined fields to avoid overwriting existing values
    const dispatchUpdates: ProjectUpdatedPayload['updates'] = {};
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        (dispatchUpdates as Record<string, unknown>)[key] = value;
      }
    }
    RealtimeService.dispatch('PROJECT_UPDATED', {
      projectId,
      updates: dispatchUpdates,
      timestamp: Date.now()
    });

    return { success: true };

  } catch (error) {
    logger.error('Error updating project', { projectId, error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
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
    await apiClient.delete(`/api/projects/${projectId}`);

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
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// ============================================================================
// CASCADE DELETE PREVIEW
// ============================================================================

interface CascadeChildItem {
  id: string;
  name: string;
}

export interface CascadePreviewData {
  projectId: string;
  projectName: string;
  buildings: Array<CascadeChildItem & {
    units: CascadeChildItem[];
    parking: CascadeChildItem[];
    storage: CascadeChildItem[];
    floors: CascadeChildItem[];
  }>;
  totals: {
    buildings: number;
    units: number;
    parking: number;
    storage: number;
    floors: number;
    total: number;
  };
}

/**
 * 🏢 ENTERPRISE: Fetch cascade delete preview for a project
 *
 * Returns all child entities (buildings, units, parking, storage, floors)
 * that would be cascade-deleted if this project is deleted.
 * Used by the confirmation dialog to show full impact.
 */
export async function getProjectCascadePreview(
  projectId: string
): Promise<{ success: boolean; data?: CascadePreviewData; error?: string }> {
  try {
    const response = await apiClient.get<{ data: CascadePreviewData }>(
      `/api/projects/${projectId}/cascade-preview`
    );
    return { success: true, data: response.data };
  } catch (error) {
    logger.error('Error fetching cascade preview', { projectId, error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
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
