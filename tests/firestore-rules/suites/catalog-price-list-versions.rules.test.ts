/**
 * Firestore Rules — `catalog_price_list_versions` (ADR-923 §5.11 «3β» · εκδόσεις τιμοκαταλόγου)
 *
 * Σχήμα κανόνα: read = `if false` · write = `if false` — **και οι δύο** μόνο στον διακομιστή (ADR-923 §5.11 «3δ» Ζ:
 * η προβολή τιμών κρίνεται από τον κριτή του διακομιστή, `pricing-views.server.ts`).
 * 🔑 Η δημοσιευμένη έκδοση είναι ΑΜΕΤΑΒΛΗΤΗ — γραφή από πελάτη θα άλλαζε τιμή που έχει ήδη δοθεί.
 * @since 2026-10-27 (ADR-923 Φ3β)
 */

import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import {
  defineServerOnlyTenantAnchors,
  defineServerWrittenTenantCell,
  useServerWrittenTenantEmulator,
  type TenantPayload,
} from '../_harness/server-written-tenant-suite';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find((c) => c.collection === 'catalog_price_list_versions')!;

const payload: TenantPayload = (companyId) => ({
  companyId,
  priceListId: 'cprl_gen', number: 1, status: 'published', validFrom: '2026-01-01T00:00:00.000Z', basedOnVersionId: null, seal: null, derived: { linesRevision: 3, seed: null },
  revision: 1,
  isDeleted: false,
});

describe('catalog_price_list_versions.rules — διαβάζει ΚΑΙ γράφει ΜΟΝΟ ο ΔΙΑΚΟΜΙΣΤΗΣ', () => {
  const env = useServerWrittenTenantEmulator();
  for (const cell of COVERAGE.matrix) {
    defineServerWrittenTenantCell(env, cell, COVERAGE.collection, payload);
  }
  defineServerOnlyTenantAnchors(env, COVERAGE.collection, payload);
});
