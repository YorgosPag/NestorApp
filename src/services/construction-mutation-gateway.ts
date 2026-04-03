'use client';

import type {
  ConstructionBaselineCreatePayload,
  ConstructionPhase,
  ConstructionPhaseCreatePayload,
  ConstructionPhaseUpdatePayload,
  ConstructionTask,
  ConstructionTaskCreatePayload,
  ConstructionTaskUpdatePayload,
} from '@/types/building/construction';
import {
  createConstructionBaseline,
  createConstructionPhase,
  createConstructionTask,
  deleteConstructionBaseline,
  deleteConstructionPhase,
  deleteConstructionTask,
  updateConstructionPhase,
  updateConstructionTask,
} from '@/components/building-management/construction-services';

interface CreateConstructionPhaseWithPolicyInput {
  readonly buildingId: string;
  readonly data: ConstructionPhaseCreatePayload;
}

interface UpdateConstructionPhaseWithPolicyInput {
  readonly buildingId: string;
  readonly phaseId: string;
  readonly updates: ConstructionPhaseUpdatePayload | Record<string, unknown>;
}

interface DeleteConstructionPhaseWithPolicyInput {
  readonly buildingId: string;
  readonly phaseId: string;
}

interface CreateConstructionTaskWithPolicyInput {
  readonly buildingId: string;
  readonly data: ConstructionTaskCreatePayload;
}

interface UpdateConstructionTaskWithPolicyInput {
  readonly buildingId: string;
  readonly taskId: string;
  readonly updates: ConstructionTaskUpdatePayload | Record<string, unknown>;
}

interface DeleteConstructionTaskWithPolicyInput {
  readonly buildingId: string;
  readonly taskId: string;
}

interface CreateConstructionBaselineWithPolicyInput {
  readonly buildingId: string;
  readonly payload: ConstructionBaselineCreatePayload;
}

interface DeleteConstructionBaselineWithPolicyInput {
  readonly buildingId: string;
  readonly baselineId: string;
}

export async function createConstructionPhaseWithPolicy({
  buildingId,
  data,
}: CreateConstructionPhaseWithPolicyInput): Promise<{ success: boolean; phaseId?: string; error?: string }> {
  return createConstructionPhase(buildingId, data);
}

export async function updateConstructionPhaseWithPolicy({
  buildingId,
  phaseId,
  updates,
}: UpdateConstructionPhaseWithPolicyInput): Promise<{ success: boolean; error?: string }> {
  return updateConstructionPhase(buildingId, phaseId, updates as ConstructionPhaseUpdatePayload);
}

export async function deleteConstructionPhaseWithPolicy({
  buildingId,
  phaseId,
}: DeleteConstructionPhaseWithPolicyInput): Promise<{ success: boolean; cascadedTasks?: number; error?: string }> {
  return deleteConstructionPhase(buildingId, phaseId);
}

export async function createConstructionTaskWithPolicy({
  buildingId,
  data,
}: CreateConstructionTaskWithPolicyInput): Promise<{ success: boolean; taskId?: string; error?: string }> {
  return createConstructionTask(buildingId, data);
}

export async function updateConstructionTaskWithPolicy({
  buildingId,
  taskId,
  updates,
}: UpdateConstructionTaskWithPolicyInput): Promise<{ success: boolean; error?: string }> {
  return updateConstructionTask(buildingId, taskId, updates as ConstructionTaskUpdatePayload);
}

export async function deleteConstructionTaskWithPolicy({
  buildingId,
  taskId,
}: DeleteConstructionTaskWithPolicyInput): Promise<{ success: boolean; error?: string }> {
  return deleteConstructionTask(buildingId, taskId);
}

export async function createConstructionBaselineWithPolicy({
  buildingId,
  payload,
}: CreateConstructionBaselineWithPolicyInput): Promise<{ success: boolean; baselineId?: string; error?: string }> {
  return createConstructionBaseline(buildingId, payload);
}

export async function deleteConstructionBaselineWithPolicy({
  buildingId,
  baselineId,
}: DeleteConstructionBaselineWithPolicyInput): Promise<{ success: boolean; error?: string }> {
  return deleteConstructionBaseline(buildingId, baselineId);
}
