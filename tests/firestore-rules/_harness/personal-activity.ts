/**
 * 📒 **Η ζευγαρωμένη δέσμη** της δραστηριότητας προσωπικού αρχείου (ADR-866 §2.6.11 Ε-Φ0-4) — όπως
 * τη γράφει ο **πραγματικός** γραφέας (`services/file-record/file-activity-commit.ts`): στην ΙΔΙΑ
 * ατομική δέσμη, η γραμμή στο `file_audit_log_personal` **και** η αλλαγή του αρχείου με
 * `lastActivityId` που δείχνει σε αυτήν.
 *
 * 🔑 Κοινό για τις σουίτες `files-personal` και `file-audit-log-personal`: η ίδια δέσμη κρίνεται από
 * **δύο** κανόνες, και κάθε σουίτα ελέγχει τη δική της πλευρά του ζεύγους.
 *
 * ⚠️ Χρόνος **διακομιστή** (`serverTimestamp`): ο κανόνας της γραμμής ζητά `timestamp == request.time`.
 */

import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FILE_AUDIT_COLLECTION, FILE_COLLECTION } from '@/lib/files/file-custody';
import { FILE_LAST_ACTIVITY_FIELD, type FileAuditAction } from '@/types/file-audit';
import { withSeedContext } from './auth-contexts';

type ClientFirestore = ReturnType<ReturnType<RulesTestEnvironment['authenticatedContext']>['firestore']>;

export const PERSONAL_FILES = COLLECTIONS[FILE_COLLECTION.personal];
export const PERSONAL_ACTIVITY = COLLECTIONS[FILE_AUDIT_COLLECTION.personal];

/** Τα πεδία του αρχείου για κάθε ζευγαρωμένη πράξη — τα ΙΔΙΑ με του `file-record-lifecycle`/`-links`. */
export const TRASH_UPDATES = { lifecycleState: 'trashed', isDeleted: true, trashedAt: new Date() } as const;
export const RESTORE_UPDATES = { lifecycleState: 'active', isDeleted: false, trashedAt: null } as const;

/** Η γραμμή δραστηριότητας όπως τη γράφει ο πελάτης (`FileAuditService.stageActivity`). */
export function personalActivityRow(
  uid: string,
  fileId: string,
  action: FileAuditAction,
): Record<string, unknown> {
  return {
    fileId,
    action,
    performedBy: uid,
    userId: uid,
    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
  };
}

export interface PairedActivity {
  readonly uid: string;
  readonly fileId: string;
  readonly action: FileAuditAction;
  readonly updates: Readonly<Record<string, unknown>>;
  readonly logId?: string;
  /** Παρέκκλιση της γραμμής — για τις μεταλλάξεις «πλαστή γραμμή». */
  readonly row?: Readonly<Record<string, unknown>>;
}

/** **Η δέσμη**: γραμμή + αλλαγή αρχείου με δείκτη, ατομικά. */
export function commitPairedActivity(db: ClientFirestore, activity: PairedActivity): Promise<void> {
  const logId = activity.logId ?? `act-${activity.action}-${activity.fileId}`;
  const batch = db.batch();
  batch.set(db.collection(PERSONAL_ACTIVITY).doc(logId), {
    ...personalActivityRow(activity.uid, activity.fileId, activity.action),
    ...activity.row,
  });
  batch.update(db.collection(PERSONAL_FILES).doc(activity.fileId), {
    ...activity.updates,
    [FILE_LAST_ACTIVITY_FIELD]: logId,
  });
  return batch.commit();
}

/** Μια γραμμή ήδη γραμμένη (παρακάμπτοντας κανόνες) — για ανάγνωση/αμεταβλητότητα. */
export async function seedPersonalActivity(
  env: RulesTestEnvironment,
  logId: string,
  uid: string,
  fileId = 'file-personal-1',
): Promise<void> {
  await withSeedContext(env, async (ctx) => {
    await ctx.firestore().collection(PERSONAL_ACTIVITY).doc(logId).set({
      fileId,
      action: 'rename',
      performedBy: uid,
      userId: uid,
      timestamp: new Date(),
    });
  });
}
