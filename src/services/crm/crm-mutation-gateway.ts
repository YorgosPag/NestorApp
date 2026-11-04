'use client';

import type { Opportunity } from '@/types/crm';
import type { CrmTask } from '@/types/crm';
import { deleteOpportunity, updateOpportunity } from '@/services/opportunities.service';
import { addTask, completeTask, deleteTask, updateTask } from '@/services/tasks.service';
import { STAGE_OWNED_FIELDS } from '@/services/crm/opportunity-stage-transition';

interface GuardedOpportunityUpdateInput {
  readonly opportunityId: string;
  readonly updates: Partial<Opportunity>;
}

interface GuardedOpportunityDeleteInput {
  readonly opportunityId: string;
}

interface GuardedTaskUpdateInput {
  readonly taskId: string;
  readonly updates: Partial<CrmTask>;
}

interface GuardedTaskDeleteInput {
  readonly taskId: string;
}

interface GuardedTaskCompleteInput {
  readonly taskId: string;
  readonly notes?: string;
}

export async function updateOpportunityWithPolicy({
  opportunityId,
  updates,
}: GuardedOpportunityUpdateInput): Promise<{ success: boolean }> {
  // ADR-930: το στάδιο (και ό,τι παράγεται από αυτό) έχει ΕΝΑΝ γραφέα — `POST /api/opportunities/[id]/stage`.
  // Εδώ αρνείται ρητά αντί να το αγνοήσει σιωπηλά: ένας καλών που το στέλνει έχει σφάλμα που πρέπει να φανεί.
  const owned = STAGE_OWNED_FIELDS.filter((field) => field in updates);
  if (owned.length > 0) throw new Error(`Stage-owned fields go through the stage door: ${owned.join(', ')}`);
  return updateOpportunity(opportunityId, updates);
}

export async function deleteOpportunityWithPolicy({
  opportunityId,
}: GuardedOpportunityDeleteInput): Promise<{ success: boolean }> {
  return deleteOpportunity(opportunityId);
}

export async function updateTaskWithPolicy({
  taskId,
  updates,
}: GuardedTaskUpdateInput): Promise<void> {
  return updateTask(taskId, updates);
}

export async function deleteTaskWithPolicy({
  taskId,
}: GuardedTaskDeleteInput): Promise<void> {
  return deleteTask(taskId);
}

export async function completeTaskWithPolicy({
  taskId,
  notes,
}: GuardedTaskCompleteInput): Promise<void> {
  return completeTask(taskId, notes);
}

interface GuardedTaskCreateInput {
  readonly data: Omit<CrmTask, 'id' | 'createdAt' | 'updatedAt' | 'completedAt' | 'reminderSent'>;
}

export async function createTaskWithPolicy({ data }: GuardedTaskCreateInput): Promise<string> {
  return addTask(data);
}
