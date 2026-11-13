import 'server-only';

/**
 * **GET · POST /api/shares/[shareId]/invoice-payment/messages** — «Γράψτε μας» στη σελίδα παραστατικού (ADR-939).
 *
 * Δημόσια (ο πελάτης δεν έχει λογαριασμό): `withAuth` με `allowUnauthenticated` και το **κουπόνι επίσκεψης** του
 * συνδέσμου, όπως η όψη και το checkout. Ο σύνδεσμος ελέγχεται ξανά στον διακομιστή (`readSharedInvoice`).
 *
 * - **GET**: το νήμα (μηνύματα πελάτη + απαντήσεις εκδότη). Όριο ρυθμού STANDARD.
 * - **POST**: νέο μήνυμα. Το σώμα φέρει **μόνο** κείμενο. Ιδεμποτία στο σύνορο (`Idempotency-Key` ανά πάτημα,
 *   CHECK 3.92): η επανάληψη δικτύου αναπαράγει την ίδια απάντηση, δεν γράφει δεύτερο μήνυμα. Όριο ρυθμού SENSITIVE,
 *   επειδή κάθε μήνυμα ειδοποιεί άνθρωπο· από πάνω το ημερήσιο όριο ανά σύνδεσμο.
 *
 * Κεφαλίδες `no-store` + `noindex`, όπως όλες οι απαντήσεις του συνδέσμου.
 *
 * @module api/shares/[shareId]/invoice-payment/messages
 * @see src/server/accounting/public-invoice/invoice-portal-messages.ts
 */

import type { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { withAuth } from '@/lib/auth/middleware';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withSensitiveRateLimit, withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { safeJsonBody } from '@/lib/validation/shared-schemas';
import {
  postInvoicePortalMessage, readInvoicePortalThread,
} from '@/server/accounting/public-invoice/invoice-portal-messages';
import {
  INVOICE_PORTAL_MESSAGE_MAX_LENGTH,
  type InvoicePortalPostResponse,
  type InvoicePortalThreadResponse,
} from '@/subapps/accounting/types/invoice-portal-messages';

import {
  grantedInvoiceShareId,
  respondInVisit,
  visitExpiredResponse,
  type InvoiceShareRouteContext,
} from '../_shared/invoice-visit-route';

export const dynamic = 'force-dynamic';

type RouteContext = InvoiceShareRouteContext;

// Όριο στο ωμό σώμα: τα περιθώρια κόβονται στον διακομιστή, που κρίνει και το τελικό μήκος.
const PostBodySchema = z.object({
  text: z.string().max(INVOICE_PORTAL_MESSAGE_MAX_LENGTH * 2),
}).strict();

// 200 για κάθε απάντηση της ροής, όπως το `resolve`: η σελίδα διακλαδώνεται στο `status`/`reason`. Επιτυχία ⇒ η
// υπηρεσία ξαναέκρινε τον σύνδεσμο (`readSharedInvoice`) ⇒ ανανεώνει την επίσκεψη (`respondInVisit`, ADR-315 Α6).

async function getHandler(
  request: NextRequest, _ctx: unknown, _cache: unknown, routeContext?: RouteContext,
): Promise<NextResponse<InvoicePortalThreadResponse>> {
  const shareId = await grantedInvoiceShareId(request, routeContext);
  if (shareId === null) {
    return visitExpiredResponse<InvoicePortalThreadResponse>({ status: 'refused', reason: 'visit-expired' });
  }
  return respondInVisit(request, shareId, await readInvoicePortalThread(getAdminFirestore(), { shareId, nowMs: Date.now() }));
}

async function postHandler(
  request: NextRequest, _ctx: unknown, _cache: unknown, routeContext?: RouteContext,
): Promise<NextResponse> {
  const shareId = await grantedInvoiceShareId(request, routeContext);
  if (shareId === null) {
    return visitExpiredResponse<InvoicePortalPostResponse>({ status: 'refused', reason: 'visit-expired' });
  }
  const parsed = await safeJsonBody(PostBodySchema, request);
  if (parsed.error) return parsed.error;
  return respondInVisit(request, shareId, await postInvoicePortalMessage(getAdminFirestore(), {
    shareId, nowMs: Date.now(), text: parsed.data.text,
  }));
}

export const GET = withStandardRateLimit(
  withAuth<InvoicePortalThreadResponse, RouteContext>(getHandler, { allowUnauthenticated: true }),
);

export const POST = withSensitiveRateLimit(
  withAuth<unknown, RouteContext>(postHandler, { allowUnauthenticated: true }),
);
