/**
 * @fileoverview **Η ΑΠΑΝΤΗΣΗ ΤΟΥ ΙΔΙΟΚΤΗΤΗ** — η μόνη διαδρομή που γράφει έγκριση εντολής.
 * @related ADR-777 §8.33 · services/mandate/mandate-consent.service.ts
 * @module app/api/mandate/[token]/route
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΔΕΝ ΕΧΕΙ `withAuth` — ΚΑΙ ΕΙΝΑΙ ΤΟ ΟΛΟ ΝΟΗΜΑ, ΟΧΙ ΠΑΡΑΛΕΙΨΗ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο άνθρωπος που απαντά εδώ **δεν έχει λογαριασμό**: είναι ο ιδιοκτήτης του
 * ακινήτου, καταχωρημένος ως **επαφή** του γραφείου. Ένα `withAuth` θα ήταν φρουρός
 * που **κανείς από το ακροατήριο δεν μπορεί να ικανοποιήσει** — η πόρτα κλειστή για
 * όλους ακριβώς όσους υπάρχει για να μπουν, και θα φαινόταν «ασφαλής». Ίδιο σχήμα με
 * την πύλη προμηθευτή (ADR-327 §7) και με το `/api/owner-properties`.
 *
 * 🔑 **Η εξουσιοδότηση ΕΙΝΑΙ ο σύνδεσμος**: υπογεγραμμένος με μυστικό που ζει **μόνο**
 * στον διακομιστή, ονομάζει **ένα** ακίνητο και **μία** επαφή, λήγει, και ακυρώνεται
 * μόλις το γραφείο στείλει νεότερο. Τίποτα από αυτά δεν είναι δηλωμένο από τον
 * αιτούντα — τα κρίνει η υπηρεσία, με **έξι ονομασμένες** αρνήσεις.
 *
 * ⚠️ **Ο ρυθμιστής ρυθμού μένει**, και εδώ μετράει περισσότερο από αλλού: μια πόρτα
 * χωρίς ταυτότητα είναι η **μόνη** που ένας άγνωστος μπορεί να χτυπήσει επ' άπειρον.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { decodeRouteParam } from '@/lib/routes/route-param';
import {
  readMandateConsentRequest,
  recordMandateDecision,
  type ConsentOutcome,
} from '@/services/mandate/mandate-consent.service';
import { nowISO } from '@/lib/date-local';
import { linkPrivateMarketingFrom, type LinkPrivateMarketingBody } from '@/lib/mandate/private-marketing-request-body';
import {
  grantPrivateMarketing,
  revokePrivateMarketing,
  type PrivateMarketingOutcome,
} from '@/services/mandate/private-marketing-consent.service';

interface DecisionResponse {
  readonly ok: boolean;
  readonly decision?: 'confirmed' | 'declined';
  /** Κωδικός — γίνεται **κλειδί i18n** στην οθόνη (N.11), ποτέ ωμό κείμενο. */
  readonly reason?: string;
}

/**
 * ⚠️ **Δύο τιμές, κλειστό σύνολο, ελεγμένο ΠΡΙΝ αγγίξουμε τη βάση.** Ένα
 * `decision: string` περασμένο κατευθείαν θα έγραφε στο έγγραφο ό,τι έστειλε ο
 * αιτών — και ο τύπος `MandateConfirmation` δεν φυλάει τίποτα σε χρόνο εκτέλεσης.
 */
function decisionFrom(value: unknown): 'confirmed' | 'declined' | null {
  return value === 'confirmed' || value === 'declined' ? value : null;
}

function respond(outcome: ConsentOutcome): NextResponse<DecisionResponse> {
  if (outcome.ok) return NextResponse.json({ ok: true, decision: outcome.decision });

  // 🔑 **404 για «δεν υπάρχει», 410 για «έληξε/αντικαταστάθηκε», 400 για «άκυρος».**
  // Τρεις κωδικοί γιατί ο άνθρωπος πρέπει να κάνει **τρία διαφορετικά πράγματα**: να
  // μην κάνει τίποτα · να ζητήσει νέο σύνδεσμο · να υποψιαστεί. Ένα κοινό 400 θα του
  // έλεγε και τα τρία, δηλαδή κανένα.
  const status =
    outcome.reason === 'listing-absent' || outcome.reason === 'not-brokered'
      ? 404
      : outcome.reason === 'link-expired' || outcome.reason === 'superseded'
        ? 410
        : outcome.reason === 'write-failed'
          ? 500
          : // ⚠️ **503 και ΟΧΙ 400**: λείπει ρύθμιση **δική μας**, ο σύνδεσμος του
            //    ανθρώπου μπορεί να είναι έγκυρος. Ένα 4xx εδώ λέει «φταις εσύ» σε
            //    κάθε αναγνώστη — άνθρωπο, log και παρακολούθηση — για κάτι που
            //    **μόνο εμείς** μπορούμε να διορθώσουμε (δες `ConsentRejection`).
            outcome.reason === 'service-unavailable'
            ? 503
            : 400;

  return NextResponse.json({ ok: false, reason: outcome.reason }, { status });
}

async function handler(
  request: NextRequest,
  context: { params: Promise<{ token: string }> },
): Promise<NextResponse<DecisionResponse>> {
  const { token: raw } = await context.params;
  // ADR-848 — ωμό `decodeURIComponent` ⇒ 500 σε κομμένο σύνδεσμο· πλέον «άκυρος».
  const token = decodeRouteParam(raw);

  const body: unknown = await request.json().catch(() => null);

  // ADR-864 Φ3 — ο ιδιοκτήτης **εκτελεί** αίτημα κλειστής διάθεσης ή **ανακαλεί** από τον ίδιο σύνδεσμο.
  const privateMarketing = (body as { privateMarketing?: unknown } | null)?.privateMarketing;
  if (privateMarketing !== undefined) return handlePrivateMarketing(token, privateMarketing);

  const decision = decisionFrom((body as { decision?: unknown } | null)?.decision);
  if (decision === null) {
    return NextResponse.json({ ok: false, reason: 'link-invalid' }, { status: 400 });
  }

  return respond(await recordMandateDecision(getAdminFirestore(), token, decision));
}

// =============================================================================
// ADR-864 Φ3 — η συναίνεση κλειστής διάθεσης από τον σύνδεσμο
// =============================================================================

/**
 * **Υπηρεσία → HTTP**, στο **ίδιο** σχήμα απάντησης με την απόφαση εντολής (`{ ok, reason }`), ώστε η
 * οθόνη να μεταφράζει **έναν** κωδικό σε κλειδί (Α21).
 */
function respondToPrivateMarketingLink(outcome: PrivateMarketingOutcome): NextResponse<DecisionResponse> {
  switch (outcome.kind) {
    case 'saved':
      return NextResponse.json({ ok: true });
    case 'refused':
      return NextResponse.json({ ok: false, reason: outcome.reason }, { status: 422 });
    case 'invalid-mandate':
      return NextResponse.json({ ok: false, reason: outcome.violations[0] ?? 'write-failed' }, { status: 422 });
    case 'absent':
      return NextResponse.json({ ok: false, reason: 'listing-absent' }, { status: 404 });
    default:
      return NextResponse.json({ ok: false, reason: 'write-failed' }, { status: 500 });
  }
}

async function runLinkAction(
  request: { readonly ownerPropertyId: string; readonly nonce: string; readonly clientContactId: string },
  body: LinkPrivateMarketingBody,
): Promise<PrivateMarketingOutcome> {
  const adminDb = getAdminFirestore();
  const who = { kind: 'owner-link', nonce: request.nonce, clientContactId: request.clientContactId } as const;
  if (body.action === 'revoke') {
    return revokePrivateMarketing(adminDb, { ownerPropertyId: request.ownerPropertyId, who, outcome: body.outcome, nowISO: nowISO() });
  }
  return grantPrivateMarketing(adminDb, {
    ownerPropertyId: request.ownerPropertyId,
    who,
    submission: body.submission,
    requestId: body.requestId,
    audience: null,
    documentPath: null,
    nowISO: nowISO(),
  });
}

async function handlePrivateMarketing(token: string, raw: unknown): Promise<NextResponse<DecisionResponse>> {
  const parsed = linkPrivateMarketingFrom(raw);
  if (!parsed.ok) return NextResponse.json({ ok: false, reason: 'link-invalid' }, { status: 400 });

  // 🔑 Ο σύνδεσμος κρίνεται **ακριβώς** όπως στην απόφαση εντολής — ίδιες ονομασμένες αρνήσεις.
  const lookup = await readMandateConsentRequest(getAdminFirestore(), token);
  if (!lookup.ok) return respond({ ok: false, reason: lookup.reason });

  return respondToPrivateMarketingLink(await runLinkAction(lookup.request, parsed.body));
}

export const POST = withStandardRateLimit(handler);
