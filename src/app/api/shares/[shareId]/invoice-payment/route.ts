import 'server-only';

/**
 * **GET /api/shares/[shareId]/invoice-payment** — η όψη του τιμολογίου για τον κάτοχο του συνδέσμου (ADR-ACC-018 §16).
 *
 * Δημόσια (ο πελάτης δεν έχει λογαριασμό): `withAuth` με `allowUnauthenticated`. Απαιτεί το **κουπόνι επίσκεψης**
 * του συνδέσμου (`HttpOnly` cookie, γράφεται από το `POST /api/shares/resolve`), ώστε η όψη να τη λαμβάνει
 * μόνο browser που **άνοιξε** τον σύνδεσμο με το token. Το token δεν εμφανίζεται ποτέ σε αυτή τη διεύθυνση.
 * Η επίσκεψη ανανεώνεται σε κάθε θετική κρίση (αδράνεια 15′, απόλυτη 8 ώρες — `_shared/invoice-visit-route.ts`).
 *
 * GET χωρίς εγγραφή ⇒ εκτός ορίου ιδεμποτίας (CHECK 3.92 κρίνει μόνο μεταλλάξεις). Όριο ρυθμού STANDARD.
 * Κεφαλίδες `no-store` + `noindex`: κανένα cache ενδιάμεσου, κανένα ευρετήριο.
 *
 * @module api/shares/[shareId]/invoice-payment
 * @see src/server/accounting/public-invoice/invoice-public-session.ts
 */

import type { NextRequest, NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth/middleware';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { openInvoicePublicView } from '@/server/accounting/public-invoice/invoice-public-session';
import type { InvoicePublicViewResponse } from '@/subapps/accounting/types/invoice-public-view';

import {
  grantedInvoiceShareId,
  respondInVisit,
  visitExpiredResponse,
  type InvoiceShareRouteContext,
} from './_shared/invoice-visit-route';

export const dynamic = 'force-dynamic';

async function handler(
  request: NextRequest,
  _ctx: unknown,
  _cache: unknown,
  routeContext?: InvoiceShareRouteContext,
): Promise<NextResponse<InvoicePublicViewResponse>> {
  const shareId = await grantedInvoiceShareId(request, routeContext);
  // 200 για κάθε απάντηση της ροής, όπως το `resolve`: η σελίδα διακλαδώνεται στο `reason`.
  if (shareId === null) {
    return visitExpiredResponse<InvoicePublicViewResponse>({ status: 'refused', reason: 'visit-expired' });
  }
  // Κάθε ανάγνωση της όψης ξαναελέγχει τον σύνδεσμο ⇒ ανανεώνει την επίσκεψη (ADR-315 Α6).
  return respondInVisit(request, shareId, await openInvoicePublicView(getAdminFirestore(), { shareId, nowMs: Date.now() }));
}

export const GET = withStandardRateLimit(
  withAuth<InvoicePublicViewResponse, InvoiceShareRouteContext>(handler, { allowUnauthenticated: true }),
);
