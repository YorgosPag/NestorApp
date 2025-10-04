'use server';
import type { CrmTask } from '@/types/crm';
import type { QueryDocumentSnapshot, Timestamp } from 'firebase/firestore';

export const transformTask = (snap: QueryDocumentSnapshot): CrmTask => {
  const data = snap.data();
  const out: any = { id: snap.id };
  for (const k in data) {
    const v = data[k];
    // Check for a toDate method to identify Timestamps from both client and admin SDKs
    out[k] = (v && typeof v.toDate === 'function') ? v.toDate() : v;
  }
  return out as CrmTask;
};
