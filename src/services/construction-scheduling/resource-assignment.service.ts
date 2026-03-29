'use client';

/**
 * @module resource-assignment.service
 * @enterprise ADR-266 Phase C, Sub-phase 4 — Resource Allocation
 *
 * Client-side API functions for construction resource assignments.
 * Workers and equipment assigned to construction tasks.
 */

import { apiClient } from '@/lib/api/enterprise-api-client';
import { API_ROUTES } from '@/config/domain-constants';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import type {
  ConstructionResourceAssignment,
  ResourceAssignmentCreatePayload,
  ResourceAssignmentUpdatePayload,
} from '@/types/building/construction';

const logger = createModuleLogger('ResourceAssignmentService');

// ─── Response Interfaces ────────────────────────────────────────────────

interface AssignmentsListApiResponse {
  success: boolean;
  assignments: ConstructionResourceAssignment[];
  buildingId: string;
}

interface AssignmentMutationApiResponse {
  success: boolean;
  assignmentId?: string;
  error?: string;
}

// ─── GET: List assignments ──────────────────────────────────────────────

/** List resource assignments for a building, optionally filtered by task */
export async function fetchResourceAssignments(
  buildingId: string,
  taskId?: string
): Promise<ConstructionResourceAssignment[]> {
  try {
    const url = taskId
      ? `${API_ROUTES.BUILDINGS.CONSTRUCTION_RESOURCE_ASSIGNMENTS(buildingId)}?taskId=${encodeURIComponent(taskId)}`
      : API_ROUTES.BUILDINGS.CONSTRUCTION_RESOURCE_ASSIGNMENTS(buildingId);

    const result = await apiClient.get<AssignmentsListApiResponse>(url);
    return result?.assignments ?? [];
  } catch (error) {
    logger.error('fetchResourceAssignments failed', { error });
    return [];
  }
}

// ─── POST: Create assignment ────────────────────────────────────────────

export async function createResourceAssignment(
  buildingId: string,
  payload: ResourceAssignmentCreatePayload
): Promise<{ success: boolean; assignmentId?: string; error?: string }> {
  try {
    const result = await apiClient.post<AssignmentMutationApiResponse>(
      API_ROUTES.BUILDINGS.CONSTRUCTION_RESOURCE_ASSIGNMENTS(buildingId),
      payload
    );
    return { success: true, assignmentId: result?.assignmentId };
  } catch (error) {
    logger.error('createResourceAssignment failed', { error });
    return { success: false, error: getErrorMessage(error) };
  }
}

// ─── PATCH: Update assignment ───────────────────────────────────────────

export async function updateResourceAssignment(
  buildingId: string,
  assignmentId: string,
  updates: ResourceAssignmentUpdatePayload
): Promise<{ success: boolean; error?: string }> {
  try {
    await apiClient.patch<AssignmentMutationApiResponse>(
      API_ROUTES.BUILDINGS.CONSTRUCTION_RESOURCE_ASSIGNMENTS(buildingId),
      { id: assignmentId, updates }
    );
    return { success: true };
  } catch (error) {
    logger.error('updateResourceAssignment failed', { error });
    return { success: false, error: getErrorMessage(error) };
  }
}

// ─── DELETE: Delete assignment ──────────────────────────────────────────

export async function deleteResourceAssignment(
  buildingId: string,
  assignmentId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await apiClient.delete<AssignmentMutationApiResponse>(
      `${API_ROUTES.BUILDINGS.CONSTRUCTION_RESOURCE_ASSIGNMENTS(buildingId)}?id=${encodeURIComponent(assignmentId)}`
    );
    return { success: true };
  } catch (error) {
    logger.error('deleteResourceAssignment failed', { error });
    return { success: false, error: getErrorMessage(error) };
  }
}
