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
import type { QueryDocumentSnapshot, DocumentSnapshot } from 'firebase/firestore';

/** Intermediate type for task transformation */
type TaskTransformOutput = Partial<CrmTask> & { id: string; [key: string]: unknown };

export const transformTask = (snap: QueryDocumentSnapshot | DocumentSnapshot): CrmTask => {
  const data = snap.data();
  if (!data) {
    throw new Error('Task document missing');
  }
  const out: TaskTransformOutput = { id: snap.id };
  for (const k in data) {
    const v = data[k];
    // Check for a toDate method to identify Timestamps from both client and admin SDKs
    out[k] = (v && typeof v === 'object' && 'toDate' in v && typeof v.toDate === 'function')
      ? (v as { toDate: () => Date }).toDate()
      : v;
  }
  return out as CrmTask;
};
