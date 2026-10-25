/**
 * Firestore Rules — `catalog_product_models` (ADR-923 §5.10 · μοντέλα προϊόντων)
 *
 * Σχήμα κανόνα: read = `isInternalUserOfCompany(companyId)` · write = `if false` (μόνο `src/server/catalog/**`).
 * 🔑 Κάθε εγγραφή μοντέλου κρίνει ΟΛΟ το σύνολο (κανόνες συνέπειας, συνδυασμός αξόνων) και ξαναγράφει τα παράγωγα
 * της ρίζας — γραφή από πελάτη θα άφηνε το ευρετήριο απογόνων και την πληρότητα ασυνεπή.
 * @since 2026-10-25 (ADR-923 Φ2β)
 */

import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import {
  defineServerWrittenTenantAnchors,
  defineServerWrittenTenantCell,
  useServerWrittenTenantEmulator,
  type TenantPayload,
} from '../_harness/server-written-tenant-suite';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find((c) => c.collection === 'catalog_product_models')!;

const payload: TenantPayload = (companyId) => ({
  companyId,
  code: 'mfp_tm',
  familyId: 'cfam_seed',
  variantSchemeCode: 'by_size',
  parentId: null,
  values: {},
  noValueReasons: {},
  categoryIds: [],
  derived: { valueAttributeIds: [], descendants: {}, facetKeys: [], findings: [] },
  revision: 1,
  isDeleted: false,
});

describe('catalog_product_models.rules — διαβάζει ο χώρος, γράφει ο ΔΙΑΚΟΜΙΣΤΗΣ', () => {
  const env = useServerWrittenTenantEmulator();
  for (const cell of COVERAGE.matrix) {
    defineServerWrittenTenantCell(env, cell, COVERAGE.collection, payload);
  }
  defineServerWrittenTenantAnchors(env, COVERAGE.collection, payload);
});
