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
import {
  recordMandateDecision,
  type ConsentOutcome,
} from '@/services/mandate/mandate-consent.service';

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
          : 400;

  return NextResponse.json({ ok: false, reason: outcome.reason }, { status });
}

async function handler(
  request: NextRequest,
  context: { params: Promise<{ token: string }> },
): Promise<NextResponse<DecisionResponse>> {
  const { token: raw } = await context.params;
  const token = decodeURIComponent(raw);

  const body: unknown = await request.json().catch(() => null);
  const decision = decisionFrom((body as { decision?: unknown } | null)?.decision);
  if (decision === null) {
    return NextResponse.json({ ok: false, reason: 'link-invalid' }, { status: 400 });
  }

  return respond(await recordMandateDecision(getAdminFirestore(), token, decision));
}

export const POST = withStandardRateLimit(handler);
