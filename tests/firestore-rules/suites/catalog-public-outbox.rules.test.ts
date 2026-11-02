/**
 * Firestore Rules — `catalog_public_outbox` (ADR-923 §5.13 Δ3 · outbox δημόσιας προβολής)
 *
 * Σχήμα κανόνα: read = `if false` · write = `if false`. Το γράφει η μηχανή του καταλόγου μέσα στη συναλλαγή της αλλαγής
 * και το αδειάζει ο διακομιστής. Κανένας πελάτης δεν έχει λόγο να το δει.
 * @since 2026-11-02 (ADR-923 Φ6β Σ3)
 */

import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import {
  defineServerOnlyTenantAnchors,
  defineServerWrittenTenantCell,
  useServerWrittenTenantEmulator,
  type TenantPayload,
} from '../_harness/server-written-tenant-suite';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find((c) => c.collection === 'catalog_public_outbox')!;

const payload: TenantPayload = (companyId) => ({ companyId, scope: 'catalog', revision: 1 });

describe('catalog_public_outbox.rules — διαβάζει ΚΑΙ γράφει ΜΟΝΟ ο ΔΙΑΚΟΜΙΣΤΗΣ', () => {
  const env = useServerWrittenTenantEmulator();
  for (const cell of COVERAGE.matrix) {
    defineServerWrittenTenantCell(env, cell, COVERAGE.collection, payload);
  }
  defineServerOnlyTenantAnchors(env, COVERAGE.collection, payload);
});
