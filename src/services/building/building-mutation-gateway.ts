'use client';

import {
  createBuilding,
  deleteBuilding,
  updateBuilding,
  getBuildingCodesByProject,
  type BuildingCreatePayload,
  type BuildingUpdatePayload,
} from '@/components/building-management/building-services';
import { suggestNextBuildingCode } from '@/config/entity-code-config';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('BuildingMutationGateway');

interface GuardedBuildingCreateInput {
  readonly payload: BuildingCreatePayload;
}

interface GuardedBuildingUpdateInput {
  readonly buildingId: string;
  readonly updates: BuildingUpdatePayload & { _v?: number };
}

interface GuardedBuildingDeleteInput {
  readonly buildingId: string;
}

export async function createBuildingWithPolicy({
  payload,
}: GuardedBuildingCreateInput): Promise<{ success: boolean; buildingId?: string; error?: string; errorCode?: string }> {
  return createBuilding(payload);
}

/**
 * ADR-233 §3.4: Wraps createBuildingWithPolicy with a single automatic retry
 * when the server rejects the code as duplicate (race condition / stale cache).
 * On conflict, re-fetches fresh codes for the project and picks the next slot.
 */
export async function createBuildingWithCodeRetry(
  payload: BuildingCreatePayload,
): Promise<{ success: boolean; buildingId?: string; error?: string; errorCode?: string }> {
  let result = await createBuilding(payload);

  if (!result.success && result.errorCode === 'POLICY_DUPLICATE_CODE' && payload.projectId) {
    logger.warn('Building code conflict — retrying with fresh code', { staleCode: payload.code });
    const freshCodes = await getBuildingCodesByProject(String(payload.projectId));
    const freshCode = suggestNextBuildingCode(freshCodes);
    result = await createBuilding({ ...payload, code: freshCode });
  }

  return result;
}

export async function updateBuildingWithPolicy({
  buildingId,
  updates,
}: GuardedBuildingUpdateInput): Promise<{ success: boolean; error?: string; _v?: number }> {
  return updateBuilding(buildingId, updates);
}

export async function deleteBuildingWithPolicy({
  buildingId,
}: GuardedBuildingDeleteInput): Promise<{ success: boolean; error?: string }> {
  return deleteBuilding(buildingId);
}
