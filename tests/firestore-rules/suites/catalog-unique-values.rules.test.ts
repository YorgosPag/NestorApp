/**
 * Firestore Rules — `catalog_unique_values` (ADR-923 §5.10 · κρατήσεις μοναδικών τιμών)
 *
 * Σχήμα κανόνα: read = `isInternalUserOfCompany(companyId)` · write = `if false` (μόνο `src/server/catalog/**`).
 * 🔑 Ευρετήριο του γραφέα, στην ίδια συναλλαγή με το προϊόν — γραφή από πελάτη θα «έκλεβε» κωδικό άλλου είδους.
 * @since 2026-10-25 (ADR-923 Φ2β)
 */

import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import {
  defineServerWrittenTenantAnchors,
  defineServerWrittenTenantCell,
  useServerWrittenTenantEmulator,
  type TenantPayload,
} from '../_harness/server-written-tenant-suite';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find((c) => c.collection === 'catalog_unique_values')!;

const payload: TenantPayload = (companyId) => ({
  companyId,
  attributeId: 'cattr_seed',
  uniqueKey: '099-01-001',
  skeleton: '099-01-001',
  holderKind: 'product',
  holderId: 'cprod_seed',
  revision: 1,
  isDeleted: false,
});

describe('catalog_unique_values.rules — διαβάζει ο χώρος, γράφει ο ΔΙΑΚΟΜΙΣΤΗΣ', () => {
  const env = useServerWrittenTenantEmulator();
  for (const cell of COVERAGE.matrix) {
    defineServerWrittenTenantCell(env, cell, COVERAGE.collection, payload);
  }
  defineServerWrittenTenantAnchors(env, COVERAGE.collection, payload);
});
