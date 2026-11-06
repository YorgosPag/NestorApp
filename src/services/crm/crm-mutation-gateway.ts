'use client';

import type { Opportunity } from '@/types/crm';
import type { CrmTask } from '@/types/crm';
import { addTask, completeTask, deleteTask, updateTask } from '@/services/tasks.service';
import { STAGE_OWNED_FIELDS } from '@/services/crm/opportunity-stage-transition';
import { OWNER_OWNED_FIELDS } from '@/services/crm/opportunity-owner-transfer';
import {
  OPPORTUNITY_EDITABLE_FIELDS,
  opportunityCreateBody,
  opportunityUpdateBody,
  pickEditableFields,
  type OpportunityCreateResponse,
  type OpportunityEditableField,
  type OpportunityUpdateResponse,
} from '@/services/crm/opportunity-fields-schema';
import {
  deleteOpportunityRequest,
  patchOpportunity,
  postOpportunity,
  type OpportunityWriteResult,
} from '@/components/crm/opportunity-write/opportunity-write-api';

/**
 * Άρνηση της πόρτας πεδίων ευκαιρίας (ADR-930 §3.10) — φέρει το τυποποιημένο αποτέλεσμα, ώστε η οθόνη να ξεχωρίσει
 * τη **σύγκρουση** (κάποιος άλλαξε στο μεταξύ τα ίδια πεδία) από την άρνηση ή την αποτυχία.
 */
export class OpportunityWriteError extends Error {
  constructor(readonly result: Exclude<OpportunityWriteResult<unknown>, { kind: 'ok' }>) {
    super(`Opportunity write ${result.kind}`);
    this.name = 'OpportunityWriteError';
  }
}

export function isOpportunityWriteConflict(error: unknown): boolean {
  return error instanceof OpportunityWriteError && error.result.kind === 'conflict';
}

function unwrap<T>(result: OpportunityWriteResult<T>): T {
  if (result.kind === 'ok') return result.response;
  throw new OpportunityWriteError(result);
}

interface GuardedOpportunityCreateInput {
  /** Τα πεδία της φόρμας· ό,τι δεν είναι επεξεργάσιμο (κατάσταση, στιγμές…) το παράγει ο server. */
  readonly data: Readonly<Partial<Opportunity>>;
}

interface GuardedOpportunityUpdateInput {
  readonly opportunityId: string;
  /** Η ευκαιρία όπως την **είδε** ο άνθρωπος — από εδώ βγαίνει το `expected` της σύγκρουσης κατά πεδίο. */
  readonly original: Readonly<Partial<Opportunity>>;
  readonly updates: Partial<Opportunity>;
}

interface GuardedOpportunityDeleteInput {
  readonly opportunityId: string;
}

function isEditableField(field: string): field is OpportunityEditableField {
  return (OPPORTUNITY_EDITABLE_FIELDS as readonly string[]).includes(field);
}

/** Νέα ευκαιρία από την ΜΙΑ πόρτα (`POST /api/opportunities`): ο server παράγει κατάσταση, στιγμές, δημιουργό, ιστορικό. */
export async function createOpportunityWithPolicy({ data }: GuardedOpportunityCreateInput): Promise<OpportunityCreateResponse> {
  const body = opportunityCreateBody.parse({
    ...pickEditableFields(data),
    ...(data.stage ? { stage: data.stage } : {}),
    ...(data.assignedTo ? { assignedTo: data.assignedTo } : {}),
  });
  return unwrap(await postOpportunity(body));
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
  original,
  updates,
}: GuardedOpportunityUpdateInput): Promise<OpportunityUpdateResponse> {
  // ADR-930: το στάδιο (και ό,τι παράγεται από αυτό) έχει ΕΝΑΝ γραφέα — `POST /api/opportunities/[id]/stage`.
  // Εδώ αρνείται ρητά αντί να το αγνοήσει σιωπηλά: ένας καλών που το στέλνει έχει σφάλμα που πρέπει να φανεί.
  const owned = STAGE_OWNED_FIELDS.filter((field) => field in updates);
  if (owned.length > 0) throw new Error(`Stage-owned fields go through the stage door: ${owned.join(', ')}`);
  // ADR-930 §3.8: ο κάτοχος αλλάζει ΜΟΝΟ από την πόρτα `…/owner`· ο δημιουργός δεν αλλάζει ποτέ (οι κανόνες αρνούνται).
  const ownership = OWNER_OWNED_FIELDS.filter((field) => field in updates);
  if (ownership.length > 0) throw new Error(`Ownership fields go through the owner door: ${ownership.join(', ')}`);
  // ADR-930 §3.10: μόνο τα επεξεργάσιμα πεδία ταξιδεύουν — οτιδήποτε άλλο είναι σφάλμα του καλούντος, όχι σιωπηλή αγνόηση.
  const foreign = Object.keys(updates).filter((field) => !isEditableField(field));
  if (foreign.length > 0) throw new Error(`Not editable through the fields door: ${foreign.join(', ')}`);

  const changes = pickEditableFields(updates);
  const seen = pickEditableFields(original);
  const expected = Object.fromEntries(Object.keys(changes).filter((field) => field in seen).map((field) => [field, seen[field as OpportunityEditableField]]));
  return unwrap(await patchOpportunity(opportunityId, opportunityUpdateBody.parse({ changes, expected })));
}

export async function deleteOpportunityWithPolicy({
  opportunityId,
}: GuardedOpportunityDeleteInput): Promise<void> {
  unwrap(await deleteOpportunityRequest(opportunityId));
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
