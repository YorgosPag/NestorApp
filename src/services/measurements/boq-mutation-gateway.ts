'use client';

import { boqService } from '@/services/measurements';
import type {
  BOQItem,
  BOQItemStatus,
  CreateBOQItemInput,
  UpdateBOQItemInput,
} from '@/types/boq';

interface CreateBOQItemWithPolicyInput {
  readonly data: CreateBOQItemInput;
  readonly userId: string;
  readonly companyId: string;
}

interface UpdateBOQItemWithPolicyInput {
  readonly id: string;
  readonly data: UpdateBOQItemInput;
}

interface DeleteBOQItemWithPolicyInput {
  readonly id: string;
}

interface TransitionBOQItemWithPolicyInput {
  readonly id: string;
  readonly status: BOQItemStatus;
  readonly userId: string;
}

export async function createBOQItemWithPolicy({
  data,
  userId,
  companyId,
}: CreateBOQItemWithPolicyInput): Promise<BOQItem> {
  return boqService.create(data, userId, companyId);
}

export async function updateBOQItemWithPolicy({
  id,
  data,
}: UpdateBOQItemWithPolicyInput): Promise<BOQItem | null> {
  return boqService.update(id, data);
}

export async function deleteBOQItemWithPolicy({
  id,
}: DeleteBOQItemWithPolicyInput): Promise<boolean> {
  return boqService.delete(id);
}

export async function transitionBOQItemWithPolicy({
  id,
  status,
  userId,
}: TransitionBOQItemWithPolicyInput): Promise<boolean> {
  return boqService.transition(id, status, userId);
}

interface ReopenBOQItemWithPolicyInput {
  readonly id: string;
  readonly userId: string;
}

export async function reopenBOQItemToDraftWithPolicy({
  id,
  userId,
}: ReopenBOQItemWithPolicyInput): Promise<boolean> {
  return boqService.reopenToDraft(id, userId);
}
