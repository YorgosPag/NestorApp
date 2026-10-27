/**
 * Firestore Rules — `catalog_customer_assignments` (ADR-923 §5.11 «3β» · αναθέσεις ομάδας πελάτη)
 *
 * Σχήμα κανόνα: read = `isInternalUserOfCompany(companyId)` · write = `if false` (μόνο `src/server/catalog/**`).
 * 🔑 Από αυτές ο διακομιστής χτίζει τον θεατή της τιμής — ποτέ ο πελάτης (§12).
 * @since 2026-10-27 (ADR-923 Φ3β)
 */

import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import {
  defineServerWrittenTenantAnchors,
  defineServerWrittenTenantCell,
  useServerWrittenTenantEmulator,
  type TenantPayload,
} from '../_harness/server-written-tenant-suite';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find((c) => c.collection === 'catalog_customer_assignments')!;

const payload: TenantPayload = (companyId) => ({
  companyId,
  party: { kind: 'contact', contactId: 'cont_1' }, customerGroupId: 'ccgrp_wholesale',
  revision: 1,
  isDeleted: false,
});

describe('catalog_customer_assignments.rules — διαβάζει ο χώρος, γράφει ο ΔΙΑΚΟΜΙΣΤΗΣ', () => {
  const env = useServerWrittenTenantEmulator();
  for (const cell of COVERAGE.matrix) {
    defineServerWrittenTenantCell(env, cell, COVERAGE.collection, payload);
  }
  defineServerWrittenTenantAnchors(env, COVERAGE.collection, payload);
});
