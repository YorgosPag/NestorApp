'use client';

import type { Opportunity } from '@/types/crm';
import type { CrmTask } from '@/types/crm';
import { deleteOpportunity, updateOpportunity } from '@/services/opportunities.service';
import { completeTask, deleteTask, updateTask } from '@/services/tasks.service';

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
