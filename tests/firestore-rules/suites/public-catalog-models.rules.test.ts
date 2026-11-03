/**
 * Firestore Rules — `public_catalog_models` (ADR-923 §5.13 Ε4 · Δ1, δημόσιο έγγραφο μοντέλου)
 *
 * Σχήμα κανόνα: read = `if true` · write = `if false`. Ίδιος πίνακας με το `public_listings`. Το γράφει μόνο ο αδειαστής, και
 * η άμυνα δεν είναι ο κανόνας αλλά το κλειστό σχήμα (`public-catalog-schema.ts`).
 * @since 2026-11-02 (ADR-923 Φ6β Σ3)
 */

import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import {
  defineServerWrittenTenantCell,
  useServerWrittenTenantEmulator,
  type TenantPayload,
} from '../_harness/server-written-tenant-suite';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find((c) => c.collection === 'public_catalog_models')!;

const payload: TenantPayload = (companyId) => ({ schemaVersion: 1, companyId, modelId: 'cpmod_1', code: 'M-1' });

describe('public_catalog_models.rules — διαβάζει ο καθένας, γράφει ΜΟΝΟ ο ΔΙΑΚΟΜΙΣΤΗΣ', () => {
  const env = useServerWrittenTenantEmulator();
  for (const cell of COVERAGE.matrix) {
    defineServerWrittenTenantCell(env, cell, COVERAGE.collection, payload);
  }
});
