'use client';

import { EntityLinkingService } from '@/services/entity-linking';
import type { LinkResult, UnlinkEntityParams } from '@/services/entity-linking';

interface UnlinkEntityWithPolicyInput {
  readonly params: UnlinkEntityParams;
}

interface LinkBuildingToProjectWithPolicyInput {
  readonly buildingId: string;
  readonly projectId: string;
}

export async function unlinkEntityWithPolicy({
  params,
}: UnlinkEntityWithPolicyInput): Promise<LinkResult> {
  return EntityLinkingService.unlinkEntity(params);
}

export async function linkBuildingToProjectWithPolicy({
  buildingId,
  projectId,
}: LinkBuildingToProjectWithPolicyInput): Promise<LinkResult> {
  return EntityLinkingService.linkBuildingToProject(buildingId, projectId);
}
