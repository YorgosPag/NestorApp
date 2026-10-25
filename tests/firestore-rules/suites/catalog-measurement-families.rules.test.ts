/**
 * Firestore Rules — `catalog_measurement_families` (ADR-923 §5.2 · οικογένειες μέτρησης του χώρου)
 *
 * Σχήμα κανόνα: read = `isInternalUserOfCompany(companyId)` · write = `if false` (μόνο `src/server/catalog/**`).
 * 🔑 Ειδικά εδώ η άρνηση γραφής φυλά και τη **συγκρισιμότητα**: ένα έγγραφο γραμμένο από πελάτη θα μπορούσε να
 * δηλώσει μονάδα με ψεύτικο συντελεστή και να αλλοιώσει κάθε τιμή αποθηκευμένη στη μονάδα-πρότυπο.
 * @since 2026-10-25 (ADR-923 Φ1β)
 */

import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import {
  defineServerWrittenTenantAnchors,
  defineServerWrittenTenantCell,
  useServerWrittenTenantEmulator,
  type TenantPayload,
} from '../_harness/server-written-tenant-suite';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find((c) => c.collection === 'catalog_measurement_families')!;

const payload: TenantPayload = (companyId) => ({
  companyId,
  code: 'luminous_efficacy',
  labels: { el: 'Φωτεινή απόδοση' },
  standardUnitCode: 'lm_W',
  units: [{ code: 'lm_W', symbol: 'lm/W', factor: 1 }],
  singleUnit: false,
  revision: 1,
  isDeleted: false,
});

describe('catalog_measurement_families.rules — διαβάζει ο χώρος, γράφει ο ΔΙΑΚΟΜΙΣΤΗΣ', () => {
  const env = useServerWrittenTenantEmulator();
  for (const cell of COVERAGE.matrix) {
    defineServerWrittenTenantCell(env, cell, COVERAGE.collection, payload);
  }
  defineServerWrittenTenantAnchors(env, COVERAGE.collection, payload);
});
