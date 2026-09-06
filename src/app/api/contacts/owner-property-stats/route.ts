/**
 * 👥 **ΤΙ ΚΑΤΕΧΕΙ ΚΑΘΕ ΕΠΑΦΗ** — συνάθροιση στον διακομιστή
 *
 * @module api/contacts/owner-property-stats
 * @see ADR-842 §7.6.13 — τα τρία φίλτρα που η οθόνη πρόσφερε χωρίς να τα κάνει
 *
 * 🔒 SECURITY:
 * - Permission: `contacts:contacts:view` (ίδιο με τη διαδρομή «ιδιοκτησίες επαφής»)
 * - Tenant isolation: `tenantScopedCollection` — η **ίδια** πόρτα εμβέλειας με το
 *   `/api/properties` (ADR-702 · ADR-214), ποτέ χειρόγραφο `where('companyId')`
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΞΕΧΩΡΙΣΤΗ ΔΙΑΔΡΟΜΗ ΚΑΙ ΟΧΙ ΚΛΗΣΗ ΤΟΥ `/api/properties`
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το `/api/properties` επιστρέφει **ολόκληρα** τα ακίνητα. Για να απαντηθεί το
 * *«ποιες επαφές κατέχουν 3-5 ακίνητα;»* ο πελάτης θα κατέβαζε **κάθε** ακίνητο του
 * μισθωτή και θα μετρούσε σε JavaScript — ακριβώς ό,τι έκανε ο **νεκρός**
 * `useContactsState` μέσω του `getProperties()`.
 *
 * 🏆 Εδώ φεύγουν **δύο αριθμοί ανά ιδιοκτήτη** και τίποτε άλλο: κανένα έγγραφο
 * `properties` δεν διασχίζει το δίκτυο για να απαντηθεί ερώτηση **πλήθους**. Το
 * ωφέλιμο φορτίο είναι ανάλογο του αριθμού **ιδιοκτητών**, όχι των ακινήτων.
 *
 * ⚠️ **ΤΟ ΣΥΝΟΡΟ ΤΗΡΕΙΤΑΙ**: τα έγγραφα περνούν από τον {@link mapPropertyDoc} —
 * τον **ΕΝΑΝ** αναγνώστη της συλλογής (ADR-842 §8 #11 · CHECK 3.74). Η συνάθροιση
 * δέχεται `Property[]`, όχι `snap.data()`, ώστε να μη γεννηθεί εδώ τρίτη απάντηση
 * στο «τι είναι ένα έγγραφο properties;».
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { COLLECTIONS } from '@/config/firestore-collections';
import { resolveTenantListScopeFromUrl, tenantScopeLabel } from '@/lib/auth/tenant-scope';
import { tenantScopedCollection } from '@/lib/firestore/tenant-scoped-query';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import { mapPropertyDoc } from '@/lib/firestore-mappers';
import {
  summarizeByOwner,
  type OwnerPropertyStatsByContact,
} from '@/lib/contacts/owner-property-stats';

const logger = createModuleLogger('OwnerPropertyStatsRoute');

export type OwnerPropertyStatsResponse =
  | { success: true; stats: OwnerPropertyStatsByContact; ownerCount: number }
  | { success: false; error: string };

async function loadOwnerStats(
  request: NextRequest,
  ctx: AuthContext,
): Promise<NextResponse<OwnerPropertyStatsResponse>> {
  const scope = resolveTenantListScopeFromUrl(request.url, ctx);

  // ADR-281: τα διαγραμμένα δεν μετρούν ως ιδιοκτησία — μια επαφή δεν «κατέχει»
  // ακίνητο που βρίσκεται στον κάδο.
  const snapshot = await tenantScopedCollection(COLLECTIONS.PROPERTIES, scope)
    .where('status', '!=', 'deleted')
    .get();

  const properties = snapshot.docs.map((doc) =>
    mapPropertyDoc(doc.id, doc.data() as Record<string, unknown>),
  );

  const stats = summarizeByOwner(properties);
  const ownerCount = Object.keys(stats).length;

  logger.info('[OwnerPropertyStats] Aggregated', {
    companyId: tenantScopeLabel(scope),
    properties: properties.length,
    owners: ownerCount,
  });

  return NextResponse.json({ success: true, stats, ownerCount });
}

/**
 * @rateLimit STANDARD (60 req/min) — ίδια σύνθεση με το `/api/properties`:
 *   ο ρυθμιστής **έξω**, ο έλεγχος ταυτότητας **μέσα**.
 */
export const GET = withStandardRateLimit(async (request: NextRequest) => {
  const handler = withAuth<OwnerPropertyStatsResponse>(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
      try {
        return await loadOwnerStats(req, ctx);
      } catch (error) {
        logger.error('[OwnerPropertyStats] Failed', { error });
        return NextResponse.json(
          { success: false, error: getErrorMessage(error) },
          { status: 500 },
        );
      }
    },
    // Η **ίδια** άδεια με τη διαδρομή «ιδιοκτησίες επαφής»: και οι δύο απαντούν
    // «τι κατέχει αυτή η επαφή;», απλώς σε άλλη κλίμακα.
    { permissions: 'crm:contacts:view' },
  );

  return handler(request);
});
