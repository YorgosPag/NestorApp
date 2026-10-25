/**
 * Firestore Rules — `catalog_attributes` (ADR-923 §5.2 · βιβλιοθήκη ιδιοτήτων καταλόγου)
 *
 * Σχήμα κανόνα: read = `isInternalUserOfCompany(companyId)` · write = `if false` (μόνο `src/server/catalog/**`).
 * @since 2026-10-25 (ADR-923 Φ1β)
 */

import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import {
  defineServerWrittenTenantAnchors,
  defineServerWrittenTenantCell,
  useServerWrittenTenantEmulator,
  type TenantPayload,
} from '../_harness/server-written-tenant-suite';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find((c) => c.collection === 'catalog_attributes')!;

const payload: TenantPayload = (companyId) => ({
  companyId,
  code: 'cooling_h',
  type: 'measurement',
  groupId: 'cagrp_seed',
  labels: { el: 'Ψυκτική ισχύς H' },
  config: { measurementFamilyCode: 'power', defaultUnitCode: 'kW', min: 0, max: null, decimals: 2, negativeAllowed: false },
  revision: 1,
  isDeleted: false,
});

describe('catalog_attributes.rules — διαβάζει ο χώρος, γράφει ο ΔΙΑΚΟΜΙΣΤΗΣ', () => {
  const env = useServerWrittenTenantEmulator();
  for (const cell of COVERAGE.matrix) {
    defineServerWrittenTenantCell(env, cell, COVERAGE.collection, payload);
  }
  defineServerWrittenTenantAnchors(env, COVERAGE.collection, payload);
});
