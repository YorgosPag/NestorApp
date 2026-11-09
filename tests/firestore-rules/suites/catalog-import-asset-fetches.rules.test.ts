/**
 * Firestore Rules — `catalog_import_asset_fetches` (ADR-934 §5.2.2 Μ-β3/Μ-β4 · μία λήψη μέσου ανά παρτίδα και διεύθυνση)
 *
 * Σχήμα κανόνα: read = `if false` · write = `if false`. Η κατάσταση, το lease και η αποτυχία με κωδικό γράφονται μόνο από
 * τον διακομιστή, μέσα σε συναλλαγή· ένας πελάτης που θα έγραφε `ready` θα έδενε στο μέσο αρχείο που δεν κρίθηκε ποτέ.
 * @since 2026-11-09 (ADR-934 Μ-β3)
 */

import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import {
  defineServerOnlyTenantAnchors,
  defineServerWrittenTenantCell,
  useServerWrittenTenantEmulator,
  type TenantPayload,
} from '../_harness/server-written-tenant-suite';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find((c) => c.collection === 'catalog_import_asset_fetches')!;

const payload: TenantPayload = (companyId) => ({
  companyId,
  batchId: 'cibat_1', uri: 'https://cdn.example.com/datasheet.pdf', roles: ['datasheet'], status: 'queued', attempts: 0,
});

describe('catalog_import_asset_fetches.rules — διαβάζει ΚΑΙ γράφει ΜΟΝΟ ο ΔΙΑΚΟΜΙΣΤΗΣ', () => {
  const env = useServerWrittenTenantEmulator();
  for (const cell of COVERAGE.matrix) {
    defineServerWrittenTenantCell(env, cell, COVERAGE.collection, payload);
  }
  defineServerOnlyTenantAnchors(env, COVERAGE.collection, payload);
});
