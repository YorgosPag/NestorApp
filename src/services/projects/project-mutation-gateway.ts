'use client';

import {
  createProject,
  updateProjectClient,
  type ProjectCreatePayload,
  type ProjectUpdatePayload,
} from '@/services/projects-client.service';

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
    return { success: true, projectId: result.projectId };
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
}: GuardedProjectUpdateInput): Promise<{ success: boolean; error?: string; _v?: number }> {
  return updateProjectClient(projectId, updates);
}
