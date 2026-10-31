/**
 * Firestore Rules — `supply_request_links` (ADR-923 §5.12)
 *
 * Σχήμα κανόνα: read = `if false` · write = `if false`. Ο σύνδεσμος ξαναπαράγεται μόνο από τον διακομιστή, που κρατά το μυστικό.
 * @since 2026-10-31 (ADR-923 Φ6α)
 */

import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import {
  defineServerOnlyTenantAnchors,
  defineServerWrittenTenantCell,
  useServerWrittenTenantEmulator,
  type TenantPayload,
} from '../_harness/server-written-tenant-suite';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find((c) => c.collection === 'supply_request_links')!;

const payload: TenantPayload = (companyId) => ({
  companyId,
  generation: 1,
  state: 'live',
  revision: 1,
});

describe('supply_request_links.rules — διαβάζει ΚΑΙ γράφει ΜΟΝΟ ο ΔΙΑΚΟΜΙΣΤΗΣ', () => {
  const env = useServerWrittenTenantEmulator();
  for (const cell of COVERAGE.matrix) {
    defineServerWrittenTenantCell(env, cell, COVERAGE.collection, payload);
  }
  defineServerOnlyTenantAnchors(env, COVERAGE.collection, payload);
});
