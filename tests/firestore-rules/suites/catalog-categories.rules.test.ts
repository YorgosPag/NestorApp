/**
 * Firestore Rules — `catalog_categories` (ADR-923 §5.2 · δέντρο κατηγοριών)
 *
 * Σχήμα κανόνα: read = `isInternalUserOfCompany(companyId)` · write = `if false` (μόνο `src/server/catalog/**`).
 * 🔑 Ο `ancestorIds` είναι παράγωγο που γράφει μόνο ο γραφέας μαζί με ολόκληρο το υποδέντρο· γραφή από πελάτη θα
 * μπορούσε να φτιάξει κύκλο ή να «κρύψει» κλάδο από κάθε ερώτημα `array-contains`.
 * @since 2026-10-25 (ADR-923 Φ1β)
 */

import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import {
  defineServerWrittenTenantAnchors,
  defineServerWrittenTenantCell,
  useServerWrittenTenantEmulator,
  type TenantPayload,
} from '../_harness/server-written-tenant-suite';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find((c) => c.collection === 'catalog_categories')!;

const payload: TenantPayload = (companyId) => ({
  companyId,
  code: 'fan_coils',
  labels: { el: 'Fan coils' },
  parentId: null,
  ancestorIds: [],
  orderKey: 'a0',
  mappings: { atoeCode: null },
  revision: 1,
  isDeleted: false,
});

describe('catalog_categories.rules — διαβάζει ο χώρος, γράφει ο ΔΙΑΚΟΜΙΣΤΗΣ', () => {
  const env = useServerWrittenTenantEmulator();
  for (const cell of COVERAGE.matrix) {
    defineServerWrittenTenantCell(env, cell, COVERAGE.collection, payload);
  }
  defineServerWrittenTenantAnchors(env, COVERAGE.collection, payload);
});
