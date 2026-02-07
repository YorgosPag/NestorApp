'use client';

/**
 * Construction Phases & Tasks — Client Services (ADR-034)
 *
 * CRUD operations for construction phases and tasks via API endpoints.
 * Follows the same pattern as building-services.ts (Enterprise API Client).
 *
 * @see src/app/api/buildings/[buildingId]/construction-phases/route.ts
 */

import { apiClient } from '@/lib/api/enterprise-api-client';
import type {
  ConstructionPhase,
  ConstructionTask,
  ConstructionPhaseCreatePayload,
  ConstructionPhaseUpdatePayload,
  ConstructionTaskCreatePayload,
  ConstructionTaskUpdatePayload,
} from '@/types/building/construction';

// ─── Response Interfaces ─────────────────────────────────────────────────

interface ConstructionDataApiResponse {
  success: boolean;
  phases: ConstructionPhase[];
  tasks: ConstructionTask[];
  buildingId: string;
}

interface CreateApiResponse {
  success: boolean;
  id: string;
  type: 'phase' | 'task';
}

interface UpdateApiResponse {
  success: boolean;
  id: string;
  type: 'phase' | 'task';
}

interface DeleteApiResponse {
  success: boolean;
  id: string;
  type: 'phase' | 'task';
  cascadedTasks?: number;
}

// ─── GET: Load Construction Data ─────────────────────────────────────────

export async function getConstructionData(
  buildingId: string
): Promise<{ phases: ConstructionPhase[]; tasks: ConstructionTask[] }> {
  try {
    const result = await apiClient.get<ConstructionDataApiResponse>(
      `/api/buildings/${buildingId}/construction-phases`
    );

    return {
      phases: result?.phases ?? [],
      tasks: result?.tasks ?? [],
    };
  } catch (error) {
    console.error('❌ [getConstructionData] Error:', error);
    return { phases: [], tasks: [] };
  }
}

// ─── CREATE: Phase ───────────────────────────────────────────────────────

export async function createConstructionPhase(
  buildingId: string,
  data: ConstructionPhaseCreatePayload
): Promise<{ success: boolean; phaseId?: string; error?: string }> {
  try {
    const result = await apiClient.post<CreateApiResponse>(
      `/api/buildings/${buildingId}/construction-phases`,
      { type: 'phase', ...data }
    );

    return { success: true, phaseId: result?.id };
  } catch (error) {
    console.error('❌ [createConstructionPhase] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ─── UPDATE: Phase ───────────────────────────────────────────────────────

export async function updateConstructionPhase(
  buildingId: string,
  phaseId: string,
  updates: ConstructionPhaseUpdatePayload
): Promise<{ success: boolean; error?: string }> {
  try {
    await apiClient.patch<UpdateApiResponse>(
      `/api/buildings/${buildingId}/construction-phases`,
      { type: 'phase', id: phaseId, updates }
    );

    return { success: true };
  } catch (error) {
    console.error('❌ [updateConstructionPhase] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ─── DELETE: Phase ───────────────────────────────────────────────────────

export async function deleteConstructionPhase(
  buildingId: string,
  phaseId: string
): Promise<{ success: boolean; cascadedTasks?: number; error?: string }> {
  try {
    const result = await apiClient.delete<DeleteApiResponse>(
      `/api/buildings/${buildingId}/construction-phases?type=phase&id=${encodeURIComponent(phaseId)}`
    );

    return { success: true, cascadedTasks: result?.cascadedTasks };
  } catch (error) {
    console.error('❌ [deleteConstructionPhase] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ─── CREATE: Task ────────────────────────────────────────────────────────

export async function createConstructionTask(
  buildingId: string,
  data: ConstructionTaskCreatePayload
): Promise<{ success: boolean; taskId?: string; error?: string }> {
  try {
    const result = await apiClient.post<CreateApiResponse>(
      `/api/buildings/${buildingId}/construction-phases`,
      { type: 'task', ...data }
    );

    return { success: true, taskId: result?.id };
  } catch (error) {
    console.error('❌ [createConstructionTask] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ─── UPDATE: Task ────────────────────────────────────────────────────────

export async function updateConstructionTask(
  buildingId: string,
  taskId: string,
  updates: ConstructionTaskUpdatePayload
): Promise<{ success: boolean; error?: string }> {
  try {
    await apiClient.patch<UpdateApiResponse>(
      `/api/buildings/${buildingId}/construction-phases`,
      { type: 'task', id: taskId, updates }
    );

    return { success: true };
  } catch (error) {
    console.error('❌ [updateConstructionTask] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ─── DELETE: Task ────────────────────────────────────────────────────────

export async function deleteConstructionTask(
  buildingId: string,
  taskId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await apiClient.delete<DeleteApiResponse>(
      `/api/buildings/${buildingId}/construction-phases?type=task&id=${encodeURIComponent(taskId)}`
    );

    return { success: true };
  } catch (error) {
    console.error('❌ [deleteConstructionTask] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
