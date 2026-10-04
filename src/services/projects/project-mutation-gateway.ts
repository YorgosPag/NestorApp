'use client';

import {
  createProject,
  updateProjectClient,
  type ProjectCreatePayload,
  type ProjectUpdatePayload,
  type ProjectUpdateClientResult,
} from '@/services/projects-client.service';
import type { ProjectAddress } from '@/types/project/addresses';

interface GuardedProjectCreateInput {
  readonly payload: ProjectCreatePayload;
}

interface GuardedProjectUpdateInput {
  readonly projectId: string;
  readonly updates: ProjectUpdatePayload;
}

export type CreateProjectSuccess = {
  readonly success: true;
  readonly projectId: string;
  /** Οι διευθύνσεις όπως τις έγραψε ο διακομιστής — μόνο όταν η δημιουργία είχε `addresses`. */
  readonly addresses?: ProjectAddress[];
};

export type CreateProjectFailure = {
  readonly success: false;
  readonly error: string;
  readonly errorCode?: string;
};

export type CreateProjectResult = CreateProjectSuccess | CreateProjectFailure;

export async function createProjectWithPolicy({
  payload,
}: GuardedProjectCreateInput): Promise<CreateProjectResult> {
  const result = await createProject(payload);
  if (result.success && result.projectId) {
    return {
      success: true,
      projectId: result.projectId,
      ...(result.addresses ? { addresses: result.addresses } : {}),
    };
  }
  return {
    success: false,
    error: result.error ?? 'Failed to create project',
    errorCode: result.errorCode,
  };
}

export async function updateProjectWithPolicy({
  projectId,
  updates,
}: GuardedProjectUpdateInput): Promise<ProjectUpdateClientResult> {
  return updateProjectClient(projectId, updates);
}
