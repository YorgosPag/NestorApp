
'use client';

/**
 * 🏢 ENTERPRISE BUILDINGS & COMPANIES DATA SERVICES - PRODUCTION READY
 *
 * Αντικατέστησε τα sample data με επαγγελματικά Firebase/Database services.
 * Όλα τα δεδομένα προέρχονται από production βάση δεδομένων.
 */

import { doc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';
// 🏢 ENTERPRISE: Centralized real-time service for cross-page sync
import { RealtimeService } from '@/services/realtime';
// 🏢 ENTERPRISE: Centralized API client (Fortune-500 pattern)
import { apiClient } from '@/lib/api/enterprise-api-client';
// 🏢 ENTERPRISE: Multi-address support (ADR-167)
import type { ProjectAddress } from '@/types/project/addresses';

/**
 * 🏢 ENTERPRISE: Building update payload type
 * Type-safe updates for building modifications
 */
export interface BuildingUpdatePayload {
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
  projectId?: string | null;  // 🏢 ENTERPRISE: Link building to project
  companyId?: string | null;  // 🏢 ENTERPRISE: Link building to company
  company?: string;           // 🏢 ENTERPRISE: Company display name
  addresses?: ProjectAddress[];  // 🏢 ENTERPRISE: Multi-address support (ADR-167)
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
  updates: BuildingUpdatePayload
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log(`🏗️ [updateBuilding] Updating building ${buildingId} via API...`);

    // 🏢 ENTERPRISE: Use centralized API client (automatic Bearer token)
    // 🔒 SECURITY: apiClient handles Firebase ID token injection
    await apiClient.patch('/api/buildings', { buildingId, ...updates });

    console.log(`✅ [updateBuilding] Building ${buildingId} updated successfully`);

    // 🏢 ENTERPRISE: Centralized Real-time Service (cross-page sync)
    // Dispatch event for all components to update their local state
    RealtimeService.dispatchBuildingUpdated({
      buildingId,
      updates: {
        name: updates.name,
        address: updates.address,
        city: updates.city,
        status: updates.status,
        totalArea: updates.totalArea,
        floors: updates.floors,
      },
      timestamp: Date.now()
    });

    return { success: true };

  } catch (error) {
    console.error('❌ [updateBuilding] Error:', error);
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
): Promise<{ success: boolean; buildingId?: string; error?: string }> {
  try {
    console.log(`🏗️ [createBuilding] Creating new building via API...`);

    // 🏢 ENTERPRISE: Use centralized API client (automatic Bearer token)
    // 🔒 SECURITY: apiClient handles Firebase ID token injection
    interface BuildingCreateResult {
      buildingId: string;
    }
    const result = await apiClient.post<BuildingCreateResult>('/api/buildings', data);

    const buildingId = result?.buildingId;
    console.log(`✅ [createBuilding] Building created with ID: ${buildingId}`);

    // 🏢 ENTERPRISE: Centralized Real-time Service (cross-page sync)
    RealtimeService.dispatchBuildingCreated({
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
    console.error('❌ [createBuilding] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * 🏗️ ENTERPRISE: Διαγραφή κτιρίου από το Firebase
 * Διαγράφει τα δεδομένα από τη βάση και ενημερώνει το real-time service
 */
export async function deleteBuilding(
  buildingId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log(`🏗️ [deleteBuilding] Deleting building ${buildingId}...`);

    const buildingRef = doc(db, COLLECTIONS.BUILDINGS, buildingId);
    await deleteDoc(buildingRef);

    console.log(`✅ [deleteBuilding] Building ${buildingId} deleted successfully`);

    // 🏢 ENTERPRISE: Centralized Real-time Service (cross-page sync)
    RealtimeService.dispatchBuildingDeleted({
      buildingId,
      timestamp: Date.now()
    });

    return { success: true };

  } catch (error) {
    console.error('❌ [deleteBuilding] Error:', error);
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
  companyId: string;
  companyName: string;
}

export async function getProjectsList(): Promise<ProjectListItem[]> {
  try {
    interface ProjectFromAPI {
      id: string;
      name: string;
      title: string;
      companyId: string;
      company: string;
    }

    interface ProjectListResponse {
      projects: ProjectFromAPI[];
      count: number;
    }

    const result = await apiClient.get<ProjectListResponse>('/api/projects/list');

    if (!result || !result.projects) {
      console.warn('⚠️ [getProjectsList] Invalid response from API');
      return [];
    }

    const projects: ProjectListItem[] = result.projects.map(project => ({
      id: project.id,
      name: project.title || project.name || 'entities.project.unknown',
      companyId: project.companyId || '',
      companyName: project.company || '',
    }));

    console.log(`✅ Loaded ${projects.length} projects via Enterprise API`);
    return projects;

  } catch (error) {
    console.error('❌ [getProjectsList] Error fetching projects from API:', error);
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

    const result = await apiClient.get<ProjectGetResult>(`/api/projects/${projectId}`);

    if (!result?.project) {
      console.warn(`⚠️ [getProjectAddresses] No project data for ${projectId}`);
      return { addresses: [] };
    }

    return {
      addresses: result.project.addresses || [],
      legacyAddress: result.project.address,
      legacyCity: result.project.city,
    };
  } catch (error) {
    console.error('❌ [getProjectAddresses] Error:', error);
    return { addresses: [] };
  }
}

