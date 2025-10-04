// /home/user/studio/src/app/api/communications/webhooks/telegram/firebase/safe-op.ts

import { safeDbOperation as safeOperation } from '@/lib/firebase-admin';
import type { Firestore } from 'firebase-admin/firestore';


export async function safeDbOperation<T>(
    operation: (db: Firestore) => Promise<T>,
    fallback: T
  ): Promise<T> {
    return safeOperation(operation, fallback);
}
