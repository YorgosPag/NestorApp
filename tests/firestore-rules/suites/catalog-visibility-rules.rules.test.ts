/**
 * Firestore Rules — `catalog_visibility_rules` (ADR-923 §12 · §5.12 Δ1 · κανόνες ορατότητας)
 *
 * Σχήμα κανόνα: read = `if false` · write = `if false`: **και οι δύο** μόνο στον διακομιστή. Η οθόνη τους παίρνει από την
 * όψη `discounts`, με κριτή `pricingView`.
 * 🔑 Ποιος βλέπει τι δεν είναι δημόσια πληροφορία: ο πελάτης δεν ρωτά ποτέ τη βάση.
 * @since 2026-10-31 (ADR-923 Φ6α)
 */

import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import {
  defineServerOnlyTenantAnchors,
  defineServerWrittenTenantCell,
  useServerWrittenTenantEmulator,
  type TenantPayload,
} from '../_harness/server-written-tenant-suite';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find((c) => c.collection === 'catalog_visibility_rules')!;

const payload: TenantPayload = (companyId) => ({
  companyId,
  subject: { kind: 'catalog' },
  audience: { kind: 'signedIn' },
  visibility: 'visible',
  revision: 1,
  isDeleted: false,
});

describe('catalog_visibility_rules.rules — διαβάζει ΚΑΙ γράφει ΜΟΝΟ ο ΔΙΑΚΟΜΙΣΤΗΣ', () => {
  const env = useServerWrittenTenantEmulator();
  for (const cell of COVERAGE.matrix) {
    defineServerWrittenTenantCell(env, cell, COVERAGE.collection, payload);
  }
  defineServerOnlyTenantAnchors(env, COVERAGE.collection, payload);
});
