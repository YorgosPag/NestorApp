'use client';

import {
  createBuilding,
  deleteBuilding,
  updateBuilding,
  type BuildingCreatePayload,
  type BuildingUpdatePayload,
} from '@/components/building-management/building-services';

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
}: GuardedBuildingCreateInput): Promise<{ success: boolean; buildingId?: string; error?: string }> {
  return createBuilding(payload);
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
