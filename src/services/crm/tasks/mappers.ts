'use server';
import type { CrmTask } from '@/types/crm';
import type { QueryDocumentSnapshot, Timestamp } from 'firebase/firestore';

/** Intermediate type for task transformation */
type TaskTransformOutput = Partial<CrmTask> & { id: string; [key: string]: unknown };

export const transformTask = (snap: QueryDocumentSnapshot): CrmTask => {
  const data = snap.data();
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
