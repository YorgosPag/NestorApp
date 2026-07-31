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

/**
 * ⚠️ **Κάθε είσοδος με `id` φέρει και `companyId`** (ADR-734 §7).
 *
 * Δεν είναι διακοσμητικό ούτε επανάληψη του `create`: το `companyId` είναι ο
 * tenant **του καλούντος**, και το service το χρησιμοποιεί για να αρνηθεί γραμμή
 * που ανήκει σε άλλον — πριν από κάθε ανάγνωση ή εγγραφή. Ονομασμένα πεδία και
 * όχι θέσεις: δύο διαδοχικά `string` (`companyId`, `id`) θα μπορούσαν να
 * αντιστραφούν σιωπηλά σε κλήση με θέσεις.
 */
interface UpdateBOQItemWithPolicyInput {
  readonly companyId: string;
  readonly id: string;
  readonly data: UpdateBOQItemInput;
}

interface DeleteBOQItemWithPolicyInput {
  readonly companyId: string;
  readonly id: string;
}

interface TransitionBOQItemWithPolicyInput {
  readonly companyId: string;
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
  companyId,
  id,
  data,
}: UpdateBOQItemWithPolicyInput): Promise<BOQItem | null> {
  return boqService.update(companyId, id, data);
}

export async function deleteBOQItemWithPolicy({
  companyId,
  id,
}: DeleteBOQItemWithPolicyInput): Promise<boolean> {
  return boqService.delete(companyId, id);
}

export async function transitionBOQItemWithPolicy({
  companyId,
  id,
  status,
  userId,
}: TransitionBOQItemWithPolicyInput): Promise<boolean> {
  return boqService.transition(companyId, id, status, userId);
}

interface ReopenBOQItemWithPolicyInput {
  readonly companyId: string;
  readonly id: string;
  readonly userId: string;
}

export async function reopenBOQItemToDraftWithPolicy({
  companyId,
  id,
  userId,
}: ReopenBOQItemWithPolicyInput): Promise<boolean> {
  return boqService.reopenToDraft(companyId, id, userId);
}
