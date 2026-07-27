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
 * Wait for the orphan-cleanup `onStorageFinalize` Cloud Function to record a
 * **candidate marker** for a given storage path. The emulator dispatches
 * finalize events asynchronously — typical latency is 1-3s but can spike to
 * 8s+ on cold start — so we poll instead of sleeping a fixed duration.
 *
 * Returns the candidate row, or `null` if the deadline passed without one
 * (the claimed path: a live owner exists → nothing is marked).
 *
 * ## Why `storage_orphan_candidates` and not the audit log (ADR-694 Α1)
 *
 * Until ADR-694 this polled `audit_log` for `action == 'ORPHAN_FILE_DELETED'`.
 * That action **no longer exists**: `onStorageFinalize` is now mark-only and
 * deletes nothing, so the query could only ever return `null` — a helper that
 * always answers "no" is not a probe, it is a permanently-red assertion.
 * Deletion moved to `orphanSweeper` (daily, days-long window), which is a
 * different surface and belongs in a different test.
 *
 * Queried by `storagePath` rather than by the internal `candidateDocId()`
 * hash, so the probe is coupled to the **written contract**, not to the
 * doc-id derivation — the helper stays correct if that derivation changes.
 */
export async function waitForOrphanCandidate(args: {
  storagePath: string;
  timeoutMs: number;
}): Promise<admin.firestore.DocumentData | null> {
  const deadline = Date.now() + args.timeoutMs;
  const db = getAdminApp().firestore();
  while (Date.now() < deadline) {
    const snap = await db
      .collection(COLLECTIONS.STORAGE_ORPHAN_CANDIDATES)
      .where('storagePath', '==', args.storagePath)
      .limit(1)
      .get();
    if (!snap.empty) return snap.docs[0].data();
    await sleep(500);
  }
  return null;
}
