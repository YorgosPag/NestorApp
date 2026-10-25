/**
 * Firestore Rules — `catalog_products` (ADR-923 §5.10 · SKU)
 *
 * Σχήμα κανόνα: read = `isInternalUserOfCompany(companyId)` · write = `if false` (μόνο `src/server/catalog/**`).
 * 🔑 Το SKU κρατά τον κωδικό του με κράτηση στην ΙΔΙΑ συναλλαγή — γραφή από πελάτη θα έφτιαχνε διπλό 016-15-001.
 * @since 2026-10-25 (ADR-923 Φ2β)
 */

import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import {
  defineServerWrittenTenantAnchors,
  defineServerWrittenTenantCell,
  useServerWrittenTenantEmulator,
  type TenantPayload,
} from '../_harness/server-written-tenant-suite';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find((c) => c.collection === 'catalog_products')!;

const payload: TenantPayload = (companyId) => ({
  companyId,
  modelId: 'cpmod_seed',
  familyId: 'cfam_seed',
  values: {},
  noValueReasons: {},
  categoryIds: [],
  derived: { rootModelId: 'cpmod_seed', completeChannels: [], facetKeys: [], assetIds: [] },
  revision: 1,
  isDeleted: false,
});

describe('catalog_products.rules — διαβάζει ο χώρος, γράφει ο ΔΙΑΚΟΜΙΣΤΗΣ', () => {
  const env = useServerWrittenTenantEmulator();
  for (const cell of COVERAGE.matrix) {
    defineServerWrittenTenantCell(env, cell, COVERAGE.collection, payload);
  }
  defineServerWrittenTenantAnchors(env, COVERAGE.collection, payload);
});
