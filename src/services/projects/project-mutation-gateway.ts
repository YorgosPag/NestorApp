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

export async function createProjectWithPolicy({
  payload,
}: GuardedProjectCreateInput): Promise<{ success: boolean; projectId?: string; error?: string }> {
  return createProject(payload);
}

export async function updateProjectWithPolicy({
  projectId,
  updates,
}: GuardedProjectUpdateInput): Promise<{ success: boolean; error?: string; _v?: number }> {
  return updateProjectClient(projectId, updates);
}
