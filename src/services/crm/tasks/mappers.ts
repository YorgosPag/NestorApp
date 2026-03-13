/**
 * =============================================================================
 * TASK MAPPERS - FIRESTORE DOCUMENT TRANSFORMATION
 * =============================================================================
 *
 * Enterprise Pattern: Pure utility functions for data transformation
 * Used by TasksRepository to convert Firestore documents to CrmTask objects
 *
 * @module services/crm/tasks/mappers
 * @enterprise ADR-026 - CRM Tasks Backend Fix (2026-01-13)
 */

import type { CrmTask } from '@/types/crm';
import type { QueryDocumentSnapshot, DocumentSnapshot, DocumentData } from 'firebase/firestore';
import { normalizeToDate } from '@/lib/date-local';

/** Intermediate type for task transformation */
type TaskTransformOutput = Partial<CrmTask> & { id: string; [key: string]: unknown };

/** Convert a Firestore Timestamp-like value to a Date; pass non-timestamp values through */
const toDateIfTimestamp = (v: unknown): unknown => {
  if (v && typeof v === 'object' && 'toDate' in v) return normalizeToDate(v);
  return v;
};

/** Transform a Firestore DocumentSnapshot to CrmTask (legacy — used by write-adjacent reads) */
export const transformTask = (snap: QueryDocumentSnapshot | DocumentSnapshot): CrmTask => {
  const data = snap.data();
  if (!data) {
    throw new Error('Task document missing');
  }
  const out: TaskTransformOutput = { id: snap.id };
  for (const k in data) {
    out[k] = toDateIfTimestamp(data[k]);
  }
  return out as CrmTask;
};

/** Transform raw DocumentData (from firestoreQueryService) to CrmTask */
export const toTask = (raw: DocumentData & { id: string }): CrmTask => {
  const out: TaskTransformOutput = { id: raw.id };
  for (const k in raw) {
    if (k === 'id') continue;
    out[k] = toDateIfTimestamp(raw[k]);
  }
  return out as CrmTask;
};
