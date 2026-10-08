/**
 * @fileoverview **«ΣΥΜΦΩΝΕΙ Η ΔΗΜΟΣΙΑ ΑΓΓΕΛΙΑ ΜΕ ΤΟ ΤΡΕΧΟΝ ΥΛΙΚΟ;»** — η πόρτα της ένδειξης (ADR-845 §7.17 Α5β).
 * @related services/listings/listing-media-reconciliation.service (ο ΕΝΑΣ κριτής) ·
 *   services/listings/listing-media-refresh (ο ΕΝΑΣ βοηθός επαναπροβολής) ·
 *   components/listings/PublishedMediaAgreement (η οθόνη)
 * @module app/api/properties/[id]/listing-media/route
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΓΙΑΤΙ ΡΩΤΑ ΤΟΝ ΔΙΑΚΟΜΙΣΤΗ ΚΑΙ ΔΕΝ ΤΟ ΥΠΟΛΟΓΙΖΕΙ Ο BROWSER
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το αποτύπωμα είναι hash **ολόκληρης** της εξόδου του επιλογέα. Ο browser διαβάζει τα αρχεία από
 * άλλο δρόμο *(με μετατροπές πεδίων)*· ένα πεδίο `undefined` αντί για απόν θα έδινε «διαφέρει» που
 * δεν ισχύει. ⇒ **Ένας κριτής** — ο ίδιος με της βραδινής συμφιλίωσης — και δύο καλούντες.
 *
 * - `GET`  — η ετυμηγορία, και αν ο αιτών **μπορεί** να ζητήσει ενημέρωση.
 * - `POST` — *«ενημέρωσε την αγγελία τώρα»*: ο ΕΝΑΣ βοηθός επαναπροβολής, και μετά η **νέα** ετυμηγορία.
 *
 * ⚠️ **`intent: 'read'` και στα δύο**: καμία γραφή δεν γίνεται **πάνω στο ακίνητο**. Η επαναπροβολή
 * αποσυρμένου ακινήτου είναι **απόσυρση** της αγγελίας του — ακριβώς ό,τι πρέπει να μπορεί να γίνει.
 */

import 'server-only';

// retired-write-exempt: δεν γράφει στο ακίνητο — ξαναπαράγει τη ΔΗΜΟΣΙΑ ΠΡΟΒΟΛΗ του· σε αποσυρμένο ακίνητο αυτό είναι απόσυρση της αγγελίας, που ΠΡΕΠΕΙ να μπορεί να γίνει (CHECK 3.100)

import { NextRequest, NextResponse } from 'next/server';

import { propertyIdOfRequest } from '@/app/api/properties/_shared/property-id-of-request';
import { ApiError, apiSuccess, type ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { requirePropertyInTenantScope } from '@/lib/auth/tenant-isolation';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import type { ListingMediaAgreementResponse } from '@/lib/listings/listing-media-fingerprint';
import { withSensitiveRateLimit, withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import { mayChangePublication } from '@/services/file-record/file-classification.service';
import { judgeListingMedia } from '@/services/listings/listing-media-reconciliation.service';
import { refreshListingAfterMediaChange } from '@/services/listings/listing-media-refresh';

const logger = createModuleLogger('PropertyListingMediaRoute');

export const dynamic = 'force-dynamic';

type Reply = NextResponse<ApiSuccessResponse<ListingMediaAgreementResponse>>;

/** Το ακίνητο του αιτήματος, **κριμένο ως δικό του** — κοινό βήμα των δύο μεθόδων. */
async function ownedPropertyId(request: NextRequest, ctx: AuthContext): Promise<string> {
  const propertyId = propertyIdOfRequest(request, ctx);
  await requirePropertyInTenantScope({ ctx, propertyId, path: request.nextUrl.pathname, intent: 'read' });
  return propertyId;
}

/** *«Μπορεί αυτός ο άνθρωπος να αλλάξει τι βλέπει ο κόσμος;»* — ρωτιέται ο ΕΝΑΣ τόπος, δεν ξαναγράφεται. */
function mayRefreshListing(ctx: AuthContext): boolean {
  return mayChangePublication({
    globalRole: ctx.globalRole,
    permissions: ctx.permissions,
    companyId: ctx.companyId,
  });
}

async function handleGet(request: NextRequest, ctx: AuthContext): Promise<Reply> {
  const propertyId = await ownedPropertyId(request, ctx);
  const agreement = await judgeListingMedia(getAdminFirestore(), propertyId, ctx.companyId);

  return apiSuccess<ListingMediaAgreementResponse>({ agreement, mayRefresh: mayRefreshListing(ctx) });
}

async function handlePost(request: NextRequest, ctx: AuthContext): Promise<Reply> {
  const propertyId = await ownedPropertyId(request, ctx);
  if (!mayRefreshListing(ctx)) throw new ApiError(403, 'LISTING_REFRESH_NOT_CAPABLE');

  const adminDb = getAdminFirestore();
  // 🔑 **Ιδεμποτές από τη φύση του**: δεύτερη κλήση ξαναγράφει την ίδια αγγελία. Awaited — είναι
  //    **τι βλέπει ο κόσμος**, και ο άνθρωπος που πάτησε δικαιούται η απάντηση να το έχει ήδη αλλάξει.
  const outcome = await refreshListingAfterMediaChange(adminDb, propertyId, ctx.companyId);
  // ⚠️ Η ετυμηγορία **ξαναρωτιέται**, δεν συμπεραίνεται από το `outcome`: αν το ράφι απέτυχε, η
  //    αγγελία γράφτηκε **χωρίς** αποτύπωμα και η τίμια απάντηση είναι «δεν ξέρω», όχι «συμφωνεί».
  const agreement = await judgeListingMedia(adminDb, propertyId, ctx.companyId);

  logger.info('Η αγγελία ενημερώθηκε από την καρτέλα του ακινήτου', {
    propertyId, companyId: ctx.companyId, outcome, agreement,
  });

  return apiSuccess<ListingMediaAgreementResponse>({ agreement, mayRefresh: true });
}

export const GET = withStandardRateLimit(
  withAuth<ApiSuccessResponse<ListingMediaAgreementResponse>>(
    async (request: NextRequest, ctx: AuthContext, _cache: PermissionCache) => handleGet(request, ctx),
    { permissions: 'properties:properties:view' },
  ),
);

export const POST = withSensitiveRateLimit(
  withAuth<ApiSuccessResponse<ListingMediaAgreementResponse>>(
    async (request: NextRequest, ctx: AuthContext, _cache: PermissionCache) => handlePost(request, ctx),
    { permissions: 'properties:properties:view' },
  ),
);
