/**
 * Integration test — orphan-cleanup race fix (ADR-327 Layer 4).
 *
 * Validates the invariant established by commit 63efd4e2: a server-side
 * upload through `uploadPublicFile()` writes a `FILES/{fileId}` claim
 * BEFORE `bucket.file().save()`, so the `onStorageFinalize` Cloud Function
 * (`functions/src/storage/orphan-cleanup.ts`) finds a claim and skips
 * deletion. Without the pre-claim, the file would be soft-deleted within
 * hundreds of milliseconds.
 *
 * The suite runs against the local Firebase emulator (firestore + storage
 * + functions). Functions code is executed for real — `onStorageFinalize`
 * fires the same way it does in production.
 *
 * Two scenarios:
 *   1. **happy path** — `uploadPublicFile()` keeps the file alive after
 *      onFinalize. Asserts file exists, claim is `active`, no audit row.
 *   2. **regression guard** — a raw `bucket.file().save()` (no claim) IS
 *      deleted by onFinalize. Without this, a passing happy-path test
 *      could mean "onFinalize never fires in the emulator" — a silent
 *      false-positive.
 *
 * @see ADR-327 §Defense-in-Depth Layer 4
 * @see src/services/storage-admin/public-upload.service.ts
 * @see functions/src/storage/orphan-cleanup.ts
 */

import {
  getAdminApp,
  clearFirestore,
  clearStorage,
  teardown,
  waitForCleanupDecision,
  sleep,
} from '../_harness/emulator';

const TEST_COMPANY = 'test-co';
const ONFINALIZE_DEADLINE_MS = 15_000;

describe('orphan-cleanup race (ADR-327 Layer 2 invariant)', () => {
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

  it('uploadPublicFile() writes a file that survives onStorageFinalize', async () => {
    const { uploadPublicFile } = await import('@/services/storage-admin/public-upload.service');

    const fileId = `it-pre-claim-${Date.now()}`;
    const result = await uploadPublicFile({
      storagePath: `companies/${TEST_COMPANY}/files/${fileId}.png`,
      buffer: Buffer.from('integration-test-payload'),
      contentType: 'image/png',
      createdBy: 'integration-test',
    });

    expect(result.fileId).toBe(fileId);

    const decision = await waitForCleanupDecision({
      fileId,
      timeoutMs: ONFINALIZE_DEADLINE_MS,
    });
    expect(decision).toBeNull();

    const [exists] = await getAdminApp().storage().bucket().file(result.storagePath).exists();
    expect(exists).toBe(true);

    const claim = await getAdminApp().firestore().collection('FILES').doc(fileId).get();
    expect(claim.exists).toBe(true);
    expect(claim.data()?.status).toBe('active');
  });

  it('REGRESSION GUARD: file uploaded without a pre-claim is deleted', async () => {
    const fileId = `it-no-claim-${Date.now()}`;
    const path = `companies/${TEST_COMPANY}/files/${fileId}.png`;

    await getAdminApp()
      .storage()
      .bucket()
      .file(path)
      .save(Buffer.from('no-claim-orphan'), { contentType: 'image/png' });

    const decision = await waitForCleanupDecision({
      fileId,
      timeoutMs: ONFINALIZE_DEADLINE_MS,
    });
    expect(decision).not.toBeNull();
    expect(decision?.action).toBe('ORPHAN_FILE_DELETED');

    await sleep(500);
    const [exists] = await getAdminApp().storage().bucket().file(path).exists();
    expect(exists).toBe(false);
  });
});
