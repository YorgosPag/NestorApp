/**
 * Firestore Rules — `catalog_price_lists` (ADR-923 §5.11 «3β» · τιμοκατάλογοι)
 *
 * Σχήμα κανόνα: read = `if false` · write = `if false` — **και οι δύο** μόνο στον διακομιστή (ADR-923 §5.11 «3δ» Ζ:
 * η προβολή τιμών κρίνεται από τον κριτή του διακομιστή, `pricing-views.server.ts`).
 * 🔑 Κοινό ανά λίστα: δύο λίστες πώλησης για το ίδιο κοινό αρνείται ο γραφέας (υποδοχή).
 * @since 2026-10-27 (ADR-923 Φ3β)
 */

import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import {
  defineServerOnlyTenantAnchors,
  defineServerWrittenTenantCell,
  useServerWrittenTenantEmulator,
  type TenantPayload,
} from '../_harness/server-written-tenant-suite';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find((c) => c.collection === 'catalog_price_lists')!;

const payload: TenantPayload = (companyId) => ({
  companyId,
  code: 'gen', labels: { el: 'Γενικός' }, kind: 'sales', priceType: 'net_list', audience: { kind: 'anonymous' }, changeFenceBp: null,
  revision: 1,
  isDeleted: false,
});

describe('catalog_price_lists.rules — διαβάζει ΚΑΙ γράφει ΜΟΝΟ ο ΔΙΑΚΟΜΙΣΤΗΣ', () => {
  const env = useServerWrittenTenantEmulator();
  for (const cell of COVERAGE.matrix) {
    defineServerWrittenTenantCell(env, cell, COVERAGE.collection, payload);
  }
  defineServerOnlyTenantAnchors(env, COVERAGE.collection, payload);
});
