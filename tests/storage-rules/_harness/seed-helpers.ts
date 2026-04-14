/**
 * Storage Rules Test Harness — Seed Helpers
 *
 * Utilities for seeding Storage files before read/delete assertion tests.
 * All seeds bypass security rules via `withSecurityRulesDisabled` — they
 * are arrange-phase only, never used for assertions.
 *
 * WHY we seed before read/delete tests:
 *   If the target file does not exist, `getMetadata()` and `delete()` both
 *   return `storage/object-not-found` (not `storage/unauthorized`).
 *   `assertFails` would then pass for the wrong reason — the deny test would
 *   succeed because the file is missing, not because the rule denied access.
 *   Pre-seeding eliminates this false-positive class.
 *
 * See ADR-301 §3.1.
 *
 * @module tests/storage-rules/_harness/seed-helpers
 * @since 2026-04-14 (ADR-301 Phase A)
 */

import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { withSeedContext } from './auth-contexts';

/**
 * Minimal 3-byte binary payload used for all seed uploads.
 * Small enough to pass `isValidFileSize()` in every rule variant.
 */
const SEED_BYTES = new Uint8Array([0x01, 0x02, 0x03]);

/**
 * Seed a file at the given Storage path, bypassing all security rules.
 *
 * @param env   - The active `RulesTestEnvironment` for this suite.
 * @param storagePath - Absolute Storage path (no leading slash).
 *
 * @example
 * await seedStorageFile(env, 'companies/company-a/entities/property/ent-001/domains/docs/categories/contracts/files/test.pdf');
 */
export async function seedStorageFile(
  env: RulesTestEnvironment,
  storagePath: string,
): Promise<void> {
  await withSeedContext(env, async (ctx) => {
    const storage = ctx.storage();
    const ref = storage.ref(storagePath);
    await ref.put(SEED_BYTES, { contentType: 'application/octet-stream' });
  });
}
