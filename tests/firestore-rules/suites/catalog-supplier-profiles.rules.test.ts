/**
 * Firestore Rules — `catalog_supplier_profiles` (ADR-923 §22 Υ8 · προφίλ παρόχου)
 *
 * Σχήμα κανόνα: read = `isInternalUserOfCompany(companyId)` · write = `if false` (μόνο `src/server/catalog/**`).
 * 🔑 Γραφή από πελάτη θα παρέκαμπτε τον έλεγχο των μέσων και τη σημείωση της δημόσιας προβολής.
 * @since 2026-11-02 (ADR-923 Φ6β)
 */

import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import {
  defineServerWrittenTenantAnchors,
  defineServerWrittenTenantCell,
  useServerWrittenTenantEmulator,
  type TenantPayload,
} from '../_harness/server-written-tenant-suite';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find((c) => c.collection === 'catalog_supplier_profiles')!;

const payload: TenantPayload = (companyId) => ({
  companyId,
  description: { el: 'Περιγραφή' },
  projects: [],
  revision: 1,
  isDeleted: false,
});

describe('catalog_supplier_profiles.rules — διαβάζει ο χώρος, γράφει ο ΔΙΑΚΟΜΙΣΤΗΣ', () => {
  const env = useServerWrittenTenantEmulator();
  for (const cell of COVERAGE.matrix) {
    defineServerWrittenTenantCell(env, cell, COVERAGE.collection, payload);
  }
  defineServerWrittenTenantAnchors(env, COVERAGE.collection, payload);
});
