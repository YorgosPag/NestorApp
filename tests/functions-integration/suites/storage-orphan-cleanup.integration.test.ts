/**
 * Integration test — storage custody marking (ADR-694 Α1, ex-ADR-327 Layer 4).
 *
 * Runs against the local Firebase emulator (firestore + storage + functions).
 * Functions code executes for real — `onStorageFinalize` fires the same way
 * it does in production.
 *
 * ## What this suite pins
 *
 * `onStorageFinalize` is a **mark-only** observer: it records orphan
 * candidates and **never deletes anything**. Reclamation lives exclusively in
 * `orphanSweeper` (daily, days-long window, re-checks custody).
 *
 *   1. **claimed** — `uploadPublicFile()` writes a `files/{fileId}` claim
 *      *before* `bucket.file().save()`, so custody resolves to `claimed`:
 *      no candidate is recorded and the file lives.
 *   2. **orphaned** — a raw `bucket.file().save()` with no claim resolves to
 *      `orphaned` (the `files` custody rule matches the path, the owner does
 *      not exist): a candidate IS recorded — **and the file still lives.**
 *
 * Scenario 2 doubles as the liveness proof for scenario 1: it fails if
 * `onStorageFinalize` never fires in the emulator, which would otherwise make
 * scenario 1's negative assertion a silent false-positive.
 *
 * ## Why this file was rewritten (2026-07-27)
 *
 * It previously asserted `action === 'ORPHAN_FILE_DELETED'` on the audit log.
 * ADR-694 removed real-time deletion outright — after 61 legitimate files were
 * destroyed across 4 subsystems in 13 days — so that action is never written
 * again and both tests could only ever fail. The suite was red on `main` from
 * 2026-07-26 onward while asserting behaviour the codebase had deliberately
 * deleted. A second bug hid underneath: the claim lookup used a hard-coded
 * `'FILES'`, but `COLLECTIONS.FILES === 'files'` and Firestore collection ids
 * are case-sensitive, so it queried a collection that never existed.
 *
 * @see ADR-694 §4 Α1 — mark-only; zero deletion on the real-time path
 * @see functions/src/storage/orphan-cleanup.ts
 * @see functions/src/storage/storage-path-custody.ts — the custody SSoT
 * @see src/services/storage-admin/public-upload.service.ts
 */

import { COLLECTIONS } from '@/config/firestore-collections';
import {
  getAdminApp,
  clearFirestore,
  clearStorage,
  teardown,
  waitForOrphanCandidate,
  sleep,
} from '../_harness/emulator';

const TEST_COMPANY = 'test-co';
const ONFINALIZE_DEADLINE_MS = 15_000;

/**
 * Grace period before asserting a file survived. The candidate marker already
 * proves `onStorageFinalize` ran to completion, so this only needs to cover a
 * hypothetical *regressed* delete issued right after the mark.
 */
const POST_MARK_SETTLE_MS = 500;

describe('storage custody marking (ADR-694 Α1 invariant)', () => {
  beforeAll(() => {
    getAdminApp();
  });

  afterAll(async () => {
    await teardown();
  });

  beforeEach(async () => {
    await clearStorage();
    await clearFirestore();
  });

  it('claimed: uploadPublicFile() is never marked as a candidate', async () => {
    const { uploadPublicFile } = await import('@/services/storage-admin/public-upload.service');

    const fileId = `it-pre-claim-${Date.now()}`;
    const result = await uploadPublicFile({
      storagePath: `companies/${TEST_COMPANY}/files/${fileId}.png`,
      buffer: Buffer.from('integration-test-payload'),
      contentType: 'image/png',
      createdBy: 'integration-test',
    });

    expect(result.fileId).toBe(fileId);

    // The pre-claim makes custody `claimed` → nothing is recorded.
    const candidate = await waitForOrphanCandidate({
      storagePath: result.storagePath,
      timeoutMs: ONFINALIZE_DEADLINE_MS,
    });
    expect(candidate).toBeNull();

    const [exists] = await getAdminApp().storage().bucket().file(result.storagePath).exists();
    expect(exists).toBe(true);

    // COLLECTIONS.FILES, not a literal — the id is lower-case `files` and
    // Firestore collection ids are case-sensitive.
    const claim = await getAdminApp()
      .firestore()
      .collection(COLLECTIONS.FILES)
      .doc(fileId)
      .get();
    expect(claim.exists).toBe(true);
    expect(claim.data()?.status).toBe('active');
  });

  it('orphaned: a file with no claim is MARKED but NOT deleted', async () => {
    const fileId = `it-no-claim-${Date.now()}`;
    const path = `companies/${TEST_COMPANY}/files/${fileId}.png`;

    await getAdminApp()
      .storage()
      .bucket()
      .file(path)
      .save(Buffer.from('no-claim-orphan'), { contentType: 'image/png' });

    // The `files` custody rule matches the path and the owner is absent →
    // positive proof of orphanhood, so a candidate is recorded.
    const candidate = await waitForOrphanCandidate({
      storagePath: path,
      timeoutMs: ONFINALIZE_DEADLINE_MS,
    });
    expect(candidate).not.toBeNull();
    expect(candidate?.custodyKind).toBe('orphaned');
    expect(candidate?.custodyRule).toBe('files');
    expect(candidate?.firstSeenAt).toBeDefined();

    // 🔴 THE ADR-694 INVARIANT: marking is not deleting. This assertion is the
    // regression guard for the 61-file incident — if real-time deletion ever
    // returns to this path, this is what goes red.
    await sleep(POST_MARK_SETTLE_MS);
    const [exists] = await getAdminApp().storage().bucket().file(path).exists();
    expect(exists).toBe(true);
  });
});
