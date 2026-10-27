/**
 * Firestore Rules — `catalog_discount_conditions` (ADR-923 §5.11 «3β» · συνθήκες έκπτωσης)
 *
 * Σχήμα κανόνα: read = `isInternalUserOfCompany(companyId)` · write = `if false` (μόνο `src/server/catalog/**`).
 * 🔑 Η έκπτωση του συνεργάτη ΔΕΝ φεύγει ποτέ προς άλλο κοινό (§12 🔒).
 * @since 2026-10-27 (ADR-923 Φ3β)
 */

import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import {
  defineServerWrittenTenantAnchors,
  defineServerWrittenTenantCell,
  useServerWrittenTenantEmulator,
  type TenantPayload,
} from '../_harness/server-written-tenant-suite';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find((c) => c.collection === 'catalog_discount_conditions')!;

const payload: TenantPayload = (companyId) => ({
  companyId,
  discountGroupId: 'cdgrp_tosh_carr', audience: { kind: 'customerGroup', customerGroupId: 'ccgrp_wholesale' }, validFrom: null, validUntil: null, rule: { kind: 'chain', steps: [5000] },
  revision: 1,
  isDeleted: false,
});

describe('catalog_discount_conditions.rules — διαβάζει ο χώρος, γράφει ο ΔΙΑΚΟΜΙΣΤΗΣ', () => {
  const env = useServerWrittenTenantEmulator();
  for (const cell of COVERAGE.matrix) {
    defineServerWrittenTenantCell(env, cell, COVERAGE.collection, payload);
  }
  defineServerWrittenTenantAnchors(env, COVERAGE.collection, payload);
});
