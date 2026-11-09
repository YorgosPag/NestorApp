/**
 * Firestore Rules — `catalog_media_sources` (ADR-934 §5.2.2 Μ-β3 · η ταυτότητα μιας διεύθυνσης μέσου στον χώρο)
 *
 * Σχήμα κανόνα: read = `if false` · write = `if false`. Τα validators (`etag` · `lastModified`) και το sha256 είναι η μνήμη
 * του διακομιστή για το conditional GET και την «νέα έκδοση»· ο πελάτης τα βλέπει μόνο μέσα από την πόρτα της παρτίδας.
 * @since 2026-11-09 (ADR-934 Μ-β3)
 */

import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import {
  defineServerOnlyTenantAnchors,
  defineServerWrittenTenantCell,
  useServerWrittenTenantEmulator,
  type TenantPayload,
} from '../_harness/server-written-tenant-suite';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find((c) => c.collection === 'catalog_media_sources')!;

const payload: TenantPayload = (companyId) => ({
  companyId,
  uri: 'https://cdn.example.com/datasheet.pdf', etag: '"abc"', lastModified: null,
  contentSha256: 'a'.repeat(64), contentFileId: 'file_1', transport: 'secure', previousSha256: [],
});

describe('catalog_media_sources.rules — διαβάζει ΚΑΙ γράφει ΜΟΝΟ ο ΔΙΑΚΟΜΙΣΤΗΣ', () => {
  const env = useServerWrittenTenantEmulator();
  for (const cell of COVERAGE.matrix) {
    defineServerWrittenTenantCell(env, cell, COVERAGE.collection, payload);
  }
  defineServerOnlyTenantAnchors(env, COVERAGE.collection, payload);
});
