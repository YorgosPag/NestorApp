/**
 * Firestore Rules — `catalog_assets` (ADR-923 §5.10 · μέσα καταλόγου)
 *
 * Σχήμα κανόνα: read = `isInternalUserOfCompany(companyId)` · write = `if false` (μόνο `src/server/catalog/**`).
 * 🔑 Το `fileId` το γράφει μόνο η ροή ανεβάσματος (ADR-709) — γραφή από πελάτη θα έδειχνε το μέσο σε ξένο αρχείο.
 * @since 2026-10-25 (ADR-923 Φ2β)
 */

import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import {
  defineServerWrittenTenantAnchors,
  defineServerWrittenTenantCell,
  useServerWrittenTenantEmulator,
  type TenantPayload,
} from '../_harness/server-written-tenant-suite';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find((c) => c.collection === 'catalog_assets')!;

const payload: TenantPayload = (companyId) => ({
  companyId,
  code: 'mfp_hero',
  role: 'photo',
  kind: 'image',
  labels: { el: 'MFP' },
  fileId: null,
  revision: 1,
  isDeleted: false,
});

describe('catalog_assets.rules — διαβάζει ο χώρος, γράφει ο ΔΙΑΚΟΜΙΣΤΗΣ', () => {
  const env = useServerWrittenTenantEmulator();
  for (const cell of COVERAGE.matrix) {
    defineServerWrittenTenantCell(env, cell, COVERAGE.collection, payload);
  }
  defineServerWrittenTenantAnchors(env, COVERAGE.collection, payload);
});
