/**
 * Functions integration test harness — Admin SDK pointed at local emulators.
 *
 * `firebase-admin` honors `FIRESTORE_EMULATOR_HOST` / `STORAGE_EMULATOR_HOST`
 * automatically once they are present at SDK init time (set in `setup-env.ts`).
 * This file only hands callers the initialized handles and a between-test
 * data-reset helper — nothing more, no mocking.
 *
 * Why not `@firebase/rules-unit-testing`:
 *   - That helper is built for security-rules tests on the client SDK.
 *   - Our tests run server-side code (`uploadPublicFile`) which uses the
 *     Admin SDK — bypasses rules entirely. Different surface, different SDK.
 *
 * @module tests/functions-integration/_harness/emulator
 * @see ADR-327 §Defense-in-Depth Layer 4
 */

import * as admin from 'firebase-admin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { sleep } from '@/lib/async-utils';

export { sleep };

let app: admin.app.App | null = null;

export function getAdminApp(): admin.app.App {
  if (app) return app;
  app = admin.initializeApp({
    projectId: process.env.FIREBASE_PROJECT_ID,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  });
  return app;
}

export async function clearFirestore(): Promise<void> {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const host = process.env.FIRESTORE_EMULATOR_HOST;
  await fetch(`http://${host}/emulator/v1/projects/${projectId}/databases/(default)/documents`, {
    method: 'DELETE',
  });
}

export async function clearStorage(): Promise<void> {
  const bucket = getAdminApp().storage().bucket();
  const [files] = await bucket.getFiles();
  await Promise.all(files.map((f) => f.delete({ ignoreNotFound: true })));
}

export async function teardown(): Promise<void> {
  if (!app) return;
  await app.delete();
  app = null;
}

/**
 * Wait for the orphan-cleanup `onStorageFinalize` Cloud Function to fire
 * for a given path. The emulator dispatches finalize events asynchronously
 * — typical latency is 1-3s but can spike to 8s+ on cold start. We poll
 * the audit log instead of sleeping a fixed duration so the suite stays
 * fast on warm runs.
 *
 * Returns the audit row if a deletion was logged for `fileId`, or `null`
 * if the deadline passed without a deletion (the happy path: pre-claim
 * present → no deletion).
 */
export async function waitForCleanupDecision(args: {
  fileId: string;
  timeoutMs: number;
}): Promise<admin.firestore.DocumentData | null> {
  const deadline = Date.now() + args.timeoutMs;
  const db = getAdminApp().firestore();
  while (Date.now() < deadline) {
    const snap = await db
      .collection(COLLECTIONS.CLOUD_FUNCTION_AUDIT_LOG)
      .where('action', '==', 'ORPHAN_FILE_DELETED')
      .where('entityId', '==', args.fileId)
      .limit(1)
      .get();
    if (!snap.empty) return snap.docs[0].data();
    await sleep(500);
  }
  return null;
}
