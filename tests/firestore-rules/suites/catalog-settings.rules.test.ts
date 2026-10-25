/**
 * Firestore Rules — `catalog_settings` (ADR-923 §5.10 · ρυθμίσεις καταλόγου)
 *
 * Σχήμα κανόνα: read = `isInternalUserOfCompany(companyId)` · write = `if false` (μόνο `src/server/catalog/**`).
 * 🔑 Αφαίρεση γλώσσας σε χρήση κλειδώνει στον γραφέα — γραφή από πελάτη θα έκανε προϊόντα μη αποθηκεύσιμα.
 * @since 2026-10-25 (ADR-923 Φ2β)
 */

import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import {
  defineServerWrittenTenantAnchors,
  defineServerWrittenTenantCell,
  useServerWrittenTenantEmulator,
  type TenantPayload,
} from '../_harness/server-written-tenant-suite';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find((c) => c.collection === 'catalog_settings')!;

const payload: TenantPayload = (companyId) => ({
  companyId,
  channelLocales: { print: ['el'], storefront: ['el', 'en'], portal: ['el'], quote: ['el'] },
  revision: 1,
  isDeleted: false,
});

describe('catalog_settings.rules — διαβάζει ο χώρος, γράφει ο ΔΙΑΚΟΜΙΣΤΗΣ', () => {
  const env = useServerWrittenTenantEmulator();
  for (const cell of COVERAGE.matrix) {
    defineServerWrittenTenantCell(env, cell, COVERAGE.collection, payload);
  }
  defineServerWrittenTenantAnchors(env, COVERAGE.collection, payload);
});
