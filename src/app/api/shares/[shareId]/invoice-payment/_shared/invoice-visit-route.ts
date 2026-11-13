import 'server-only';

/**
 * @fileoverview **Η ΕΠΙΣΚΕΨΗ ΣΤΟ ΣΥΡΜΑ** — ένας σκελετός για όλες τις πόρτες της σελίδας τιμολογίου (ADR-315 Α6 ·
 *   ADR-ACC-018 §16 · ADR-ACC-030 §5.6). Πρότυπο `app/api/spatial-tours/_shared/tour-view-route.ts`.
 * @module app/api/shares/[shareId]/invoice-payment/_shared/invoice-visit-route
 *
 * 1. **Είσοδος**: το `shareId` της διαδρομής μετρά **μόνο** αν ο browser φέρει το κουπόνι επίσκεψης αυτού του
 *    συνδέσμου (`grantedInvoiceShareId`) — ο ΕΝΑΣ έλεγχος, όχι τέσσερα αντίγραφα.
 * 2. **Έξοδος**: η απάντηση **κρίνει** την επίσκεψη (`settleInvoiceVisit`):
 *    - επιτυχία ⇒ η υπηρεσία μόλις ξαναέκρινε στη βάση ότι ο σύνδεσμος είναι ενεργός (`readSharedInvoice` →
 *      `findActiveShareOf`) ⇒ **ανανέωση** αδράνειας (πρότυπο OWASP: idle timeout που ανανεώνεται, absolute που όχι)·
 *    - `link-inactive` ⇒ **σβήσιμο** του κουπονιού (ο browser δεν κρατά επίσκεψη σε ανακλημένο σύνδεσμο)·
 *    - κάθε άλλη άρνηση ⇒ τίποτα: δεν ξέρουμε αν έγινε κρίση συνδέσμου, άρα **δεν** ανανεώνουμε (το όριο ανάκλησης
 *      μένει ≤ 15′ από την τελευταία κρίση).
 *
 * ⚠️ Η **έκβαση απόπειρας** (`GET …/checkout?checkout=`) **δεν** περνά από εδώ: δεν κρίνει τον σύνδεσμο, άρα δεν
 *    ανανεώνει. Την επίσκεψη της αναμονής την κρατά ζωντανή η σιωπηλή ανανέωση της όψης σε κάθε γύρο.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { PRIVATE_CHANNEL_HEADERS } from '@/lib/http/private-response-headers';
import { decodeRouteParam } from '@/lib/routes/route-param';
import {
  clearShareAccessGrant,
  renewShareAccessGrant,
  requestHasShareAccessGrant,
} from '@/server/sharing/share-access-grant';

export type InvoiceShareRouteContext = { params: Promise<{ shareId: string }> };

/** Τι κάνει η απάντηση στην επίσκεψη. */
export type InvoiceVisitVerdict = 'renew' | 'clear' | 'keep';

/** Το σχήμα κάθε απάντησης ροής της σελίδας: `status`, και `reason` στην άρνηση. */
interface InvoiceFlowOutcome {
  readonly status: string;
  readonly reason?: string;
}

/** Το `shareId` της διαδρομής — μόνο αν ο browser κρατά ζωντανό κουπόνι επίσκεψης γι' αυτό. */
export async function grantedInvoiceShareId(
  request: NextRequest, routeContext?: InvoiceShareRouteContext,
): Promise<string | null> {
  const shareId = decodeRouteParam((await routeContext?.params)?.shareId ?? '');
  return shareId !== '' && requestHasShareAccessGrant(request, shareId) ? shareId : null;
}

/** Η κρίση της επίσκεψης από την απάντηση της υπηρεσίας (βλ. κεφαλίδα). */
export function invoiceVisitVerdictOf(outcome: InvoiceFlowOutcome): InvoiceVisitVerdict {
  if (outcome.status !== 'refused') return 'renew';
  return outcome.reason === 'link-inactive' ? 'clear' : 'keep';
}

/** Εφαρμόζει την κρίση στο cookie της απάντησης. */
export function settleInvoiceVisit(
  request: NextRequest, response: NextResponse, shareId: string, verdict: InvoiceVisitVerdict,
): void {
  if (verdict === 'renew') renewShareAccessGrant(request, response, shareId);
  else if (verdict === 'clear') clearShareAccessGrant(response, shareId);
}

/**
 * Απάντηση ροής (200 για κάθε έκβαση — η σελίδα διακλαδώνεται στο `status`/`reason`) με κρίση της επίσκεψης.
 * Κεφαλίδες `no-store` + `noindex` (`PRIVATE_CHANNEL_HEADERS`).
 */
export function respondInVisit<T extends InvoiceFlowOutcome>(
  request: NextRequest, shareId: string, outcome: T,
): NextResponse<T> {
  const response = NextResponse.json(outcome, { status: 200, headers: PRIVATE_CHANNEL_HEADERS });
  settleInvoiceVisit(request, response, shareId, invoiceVisitVerdictOf(outcome));
  return response;
}

/** Η απάντηση «η επίσκεψη έληξε» — κανένα κουπόνι για κρίση· η σελίδα ανοίγει νέα επίσκεψη. */
export function visitExpiredResponse<T extends InvoiceFlowOutcome>(outcome: T): NextResponse<T> {
  return NextResponse.json(outcome, { status: 200, headers: PRIVATE_CHANNEL_HEADERS });
}
