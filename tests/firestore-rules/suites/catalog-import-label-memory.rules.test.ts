/**
 * Firestore Rules — `catalog_import_label_memory` (ADR-923 §5.5.2 Β5 · μνήμη ετικετών γραμμής ανά προμηθευτή)
 *
 * Σχήμα κανόνα: read = `if false` · write = `if false`: τη μνήμη τη γράφει μόνο η έγκριση πρότασης στον διακομιστή, και την
 * εφαρμόζει μόνο η ανάγνωση σελίδας στον διακομιστή.
 * @since 2026-11-09 (ADR-923 §5.5.2 Β5)
 */

import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import {
  defineServerOnlyTenantAnchors,
  defineServerWrittenTenantCell,
  useServerWrittenTenantEmulator,
  type TenantPayload,
} from '../_harness/server-written-tenant-suite';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find((c) => c.collection === 'catalog_import_label_memory')!;

const payload: TenantPayload = (companyId) => ({
  companyId,
  code: '["label-memory","cont_aries","cfam_fancoil","παρ.αερα · m","m3_h"]',
  supplierContactId: 'cont_aries',
  familyId: 'cfam_fancoil',
  label: 'παρ.αερα · m',
  unitCode: 'm3_h',
  printedLabel: 'ΠΑΡ.ΑΕΡΑ · M',
  decisions: [{ decision: { kind: 'attribute', attributeId: 'cattr_air_flow' }, count: 1, lastBatchId: 'cibat_1', lastBy: 'uid_1', lastAt: '2026-11-09T10:00:00.000Z' }],
  revision: 1,
  isDeleted: false,
});

describe('catalog_import_label_memory.rules — διαβάζει ΚΑΙ γράφει ΜΟΝΟ ο ΔΙΑΚΟΜΙΣΤΗΣ', () => {
  const env = useServerWrittenTenantEmulator();
  for (const cell of COVERAGE.matrix) {
    defineServerWrittenTenantCell(env, cell, COVERAGE.collection, payload);
  }
  defineServerOnlyTenantAnchors(env, COVERAGE.collection, payload);
});
