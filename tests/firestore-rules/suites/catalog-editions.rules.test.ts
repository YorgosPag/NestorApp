/**
 * Firestore Rules — `catalog_editions` (ADR-923 §5.15 · δημοσιευμένες εκδόσεις καταλόγου)
 *
 * Σχήμα κανόνα: read = `if false` · write = `if false` — **και οι δύο** μόνο στον διακομιστή: ο θεατής (ανώνυμος ή αγοραστής
 * μέσω σχέσης προμήθειας) κρίνεται από το σύνορο ανάγνωσης, που κανένας κανόνας δεν μπορεί να αναπαράγει.
 * @since 2026-11-07 (ADR-923 Θ.1β)
 */

import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import {
  defineServerOnlyTenantAnchors,
  defineServerWrittenTenantCell,
  useServerWrittenTenantEmulator,
  type TenantPayload,
} from '../_harness/server-written-tenant-suite';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find((c) => c.collection === 'catalog_editions')!;

const payload: TenantPayload = (companyId) => ({
  companyId,
  shelfKey: 'cpubr_1', status: 'published', audience: { kind: 'anonymous' },
});

describe('catalog_editions.rules — διαβάζει ΚΑΙ γράφει ΜΟΝΟ ο ΔΙΑΚΟΜΙΣΤΗΣ', () => {
  const env = useServerWrittenTenantEmulator();
  for (const cell of COVERAGE.matrix) {
    defineServerWrittenTenantCell(env, cell, COVERAGE.collection, payload);
  }
  defineServerOnlyTenantAnchors(env, COVERAGE.collection, payload);
});
