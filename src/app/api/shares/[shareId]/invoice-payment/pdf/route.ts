import 'server-only';

/**
 * **GET /api/shares/[shareId]/invoice-payment/pdf** — το PDF του τιμολογίου για τον κάτοχο του συνδέσμου
 * (ADR-ACC-018 §16).
 *
 * Το **ίδιο** PDF με τη λήψη από την εφαρμογή: ίδιος γραφέας (`renderInvoicePdfDocument`), ίδιοι λογαριασμοί
 * (`withCurrentPaymentAccounts`), ίδιο όνομα αρχείου. Οι πύλες είναι ίδιες με την όψη: κουπόνι επίσκεψης,
 * ενεργός σύνδεσμος, μισθωτής.
 *
 * Άρνηση ⇒ 404 χωρίς σώμα: ο σύνδεσμος λήψης ανοίγει σε νέα καρτέλα, και η σελίδα έχει ήδη πει τον λόγο.
 *
 * @module api/shares/[shareId]/invoice-payment/pdf
 */

import { NextResponse, type NextRequest } from 'next/server';

import { PRIVATE_CHANNEL_HEADERS } from '@/lib/http/private-response-headers';
import { withAuth } from '@/lib/auth/middleware';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { decodeRouteParam } from '@/lib/routes/route-param';
import { renderInvoicePublicPdf } from '@/server/accounting/public-invoice/invoice-public-session';
import { requestHasShareAccessGrant } from '@/server/sharing/share-access-grant';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ shareId: string }> };

/** RFC 6266 · RFC 5987: ASCII εφεδρεία + UTF-8 όνομα (ελληνικά ονόματα πελατών). */
function contentDisposition(filename: string): string {
  const ascii = filename.replace(/[^\x20-\x7E]/g, '_').replace(/"/g, '');
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

async function handler(
  request: NextRequest,
  _ctx: unknown,
  _cache: unknown,
  routeContext?: RouteContext,
): Promise<NextResponse> {
  const shareId = decodeRouteParam((await routeContext?.params)?.shareId ?? '');
  if (shareId === '' || !requestHasShareAccessGrant(request, shareId)) {
    return new NextResponse(null, { status: 404, headers: PRIVATE_CHANNEL_HEADERS });
  }
  const outcome = await renderInvoicePublicPdf(getAdminFirestore(), { shareId, nowMs: Date.now() });
  if (outcome.kind === 'refused') return new NextResponse(null, { status: 404, headers: PRIVATE_CHANNEL_HEADERS });
  return new NextResponse(Buffer.from(outcome.bytes), {
    status: 200,
    headers: {
      ...PRIVATE_CHANNEL_HEADERS,
      'Content-Type': 'application/pdf',
      'Content-Disposition': contentDisposition(outcome.filename),
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

export const GET = withStandardRateLimit(
  withAuth<unknown, RouteContext>(handler, { allowUnauthenticated: true }),
);
