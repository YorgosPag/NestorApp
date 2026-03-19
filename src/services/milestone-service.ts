'use client';

/**
 * Building Milestones — Client Service Layer
 *
 * CRUD operations for building milestones via API endpoints.
 * Pattern follows: src/components/building-management/construction-services.ts
 */

import { apiClient } from '@/lib/api/enterprise-api-client';
import { API_ROUTES } from '@/config/domain-constants';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import type {
  BuildingMilestone,
  MilestoneCreatePayload,
  MilestoneUpdatePayload,
} from '@/types/building/milestone';

const logger = createModuleLogger('MilestoneService');

// ─── Response Interfaces ─────────────────────────────────────────────────

interface MilestonesApiResponse {
  success: boolean;
  milestones: BuildingMilestone[];
  buildingId: string;
}

interface MilestoneMutationApiResponse {
  success: boolean;
  id: string;
}

// ─── GET: Load Milestones ────────────────────────────────────────────────

export async function getMilestones(
  buildingId: string
): Promise<BuildingMilestone[]> {
  try {
    const result = await apiClient.get<MilestonesApiResponse>(
      API_ROUTES.BUILDINGS.MILESTONES(buildingId)
    );
    return result?.milestones ?? [];
  } catch (error) {
    logger.error('getMilestones failed', { error });
    return [];
  }
}

// ─── CREATE: Milestone ───────────────────────────────────────────────────

export async function createMilestone(
  buildingId: string,
  data: MilestoneCreatePayload
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const result = await apiClient.post<MilestoneMutationApiResponse>(
      API_ROUTES.BUILDINGS.MILESTONES(buildingId),
      data
    );
    return { success: true, id: result?.id };
  } catch (error) {
    logger.error('createMilestone failed', { error });
    return {
      success: false,
      error: getErrorMessage(error),
    };
  }
}

// ─── UPDATE: Milestone ───────────────────────────────────────────────────

export async function updateMilestone(
  buildingId: string,
  milestoneId: string,
  updates: MilestoneUpdatePayload
): Promise<{ success: boolean; error?: string }> {
  try {
    await apiClient.patch<MilestoneMutationApiResponse>(
      API_ROUTES.BUILDINGS.MILESTONES(buildingId),
      { id: milestoneId, updates }
    );
    return { success: true };
  } catch (error) {
    logger.error('updateMilestone failed', { error });
    return {
      success: false,
      error: getErrorMessage(error),
    };
  }
}

// ─── DELETE: Milestone ───────────────────────────────────────────────────

export async function deleteMilestone(
  buildingId: string,
  milestoneId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await apiClient.delete<MilestoneMutationApiResponse>(
      `${API_ROUTES.BUILDINGS.MILESTONES(buildingId)}?id=${encodeURIComponent(milestoneId)}`
    );
    return { success: true };
  } catch (error) {
    logger.error('deleteMilestone failed', { error });
    return {
      success: false,
      error: getErrorMessage(error),
    };
  }
}
