/**
 * =============================================================================
 * Μητρώο λήξεων — Η ΟΨΗ ΤΟΥ ΑΙΤΗΜΑΤΟΣ ΠΡΟΣΦΟΡΩΝ από την πλευρά του ιδιώτη (ADR-945 §7.6)
 * =============================================================================
 *
 * **«Πού βρίσκεται το αίτημά μου, σε ποιον είναι η μπάλα, και τι μπορώ να κάνω τώρα;»** Καθαρές συναρτήσεις πάνω στην
 * απόκριση του `GET …/issuance-requests` (`IssuanceBiddingView`) — καμία κλήση δικτύου, κανένα React.
 *
 * 🔑 **Καμία δεύτερη κρίση**: «μπορώ να καλέσω κι άλλον;» το απαντά ο **ΙΔΙΟΣ** μειωτής που κρίνει στον διακομιστή
 *    (`reduceIssuanceRequest`) — ποτέ δεύτερο όριο 3 εδώ. Το στάδιο κάθε προσφοράς έρχεται **κριμένο** από τον διακομιστή.
 * 🔑 **CAS εισόδων**: ο κύκλος και τα στάδια που **είδε** ο άνθρωπος (`expectedCycleOf` · `expectedStagesOf`) — ό,τι
 *    άλλαξε στο μεταξύ ⇒ `STALE`, ποτέ ανάθεση πάνω σε κάτι που δεν είδε.
 * 🔑 **Δ3 — ο ιδιώτης είναι ταυτόχρονα «γραφείο» και «ιδιοκτήτης»**: η μπάλα του ιδιώτη είναι **δικός του πίνακας**
 *    (`OWNER_BALL`), όχι μηχανική μετάφραση της μπάλας του γραφείου — βλ. εκεί γιατί.
 *
 * **Layering**: leaf — καθαροί τύποι και συναρτήσεις, μηδέν I/O.
 *
 * @module lib/document-validity/issuance-request-view-model
 */

import { DOCUMENT_KINDS, documentKindSpec, type DocumentKind } from '@/config/document-validity/document-validity';

import type { IssuanceAssignmentRecord } from './issuance-assignment';
import { reduceIssuanceRequest, type IssuanceRequestRefusal } from './issuance-bidding';
import type { IssuanceBiddingView, IssuanceBidView } from './issuance-bidding-request';
import { sameProfessional, type IssuanceProfessional } from './issuance-professional';
import type { IssuanceStage } from './issuance-stage';

/**
 * Η φάση του αιτήματος όπως τη ζει ο ιδιώτης:
 * - `none`     — κανένα αίτημα (ή κανένας ζωντανός κύκλος) ⇒ «Βρες επαγγελματία»·
 * - `inviting` — ο κύκλος δέχεται προσκλήσεις και επιλογή·
 * - `awarded`  — υπάρχει νικήτρια με **ανοιχτή** ανάθεση·
 * - `closed`   — ο κύκλος τελείωσε (ακυρώθηκε, ή η νικήτρια έκλεισε/εκδόθηκε) ⇒ η επόμενη πρόσκληση ανοίγει νέο.
 */
export type IssuanceRequestPhase = 'none' | 'inviting' | 'awarded' | 'closed';

/**
 * Τα είδη για τα οποία ο ιδιώτης μπορεί να ζητήσει προσφορές — **παράγονται** από τον κατάλογο ειδών: όποιο το εκδίδει
 * **επαγγελματίας** (όχι αρχή όπως ΑΑΔΕ/ΕΦΚΑ). Νέο είδος στον κατάλογο ⇒ εμφανίζεται μόνο του, χωρίς δεύτερη λίστα.
 */
export const ISSUANCE_REQUEST_KINDS: readonly DocumentKind[] = DOCUMENT_KINDS.filter(
  (kind) => documentKindSpec(kind).issuer.kind === 'professional',
);

/** Σε ποιον είναι η μπάλα **για τον ιδιώτη** — `null` = κανείς (κλειστή προσφορά). */
export type OwnerBallParty = 'owner' | 'professional';

/**
 * **«Σειρά σου» μόνο όπου ο ιδιώτης έχει πράξη να κάνει** (Thumbtack · Angi: ο πελάτης βλέπει «περιμένουμε τον
 * επαγγελματία» μέχρι να έρθει τιμή — ποτέ κάλεσμα χωρίς κουμπί).
 *
 * ⚠️ **Γιατί όχι `office ⇒ owner`**: στη ροή του γραφείου το `proposed` ζητά από το γραφείο να **στείλει** το αίτημα.
 *    Στον ιδιώτη η πρόταση **είναι** η έγκριση (Δ3) και την ειδοποίηση τη στέλνει η **πλατφόρμα** (Φ3) — ο ιδιώτης δεν
 *    έχει πράξη αποστολής, άρα «Σειρά σου» εκεί θα ήταν αδιέξοδο. Το ίδιο το `ownerApproved` (μόνο παλιές αναθέσεις
 *    γραφείου, §27). Στο `declined` η σειρά **είναι** του ιδιώτη: «ζήτησε από άλλον».
 * 🔑 **Ολικός πίνακας**: νέο στάδιο δεν μεταγλωττίζεται χωρίς απόφαση για τον ιδιώτη (CHECK 3.73).
 */
const OWNER_BALL: Readonly<Record<IssuanceStage, OwnerBallParty | null>> = {
  proposed: 'professional',
  ownerApproved: 'professional',
  ownerRejected: null,
  sent: 'professional',
  quoted: 'owner',
  accepted: 'professional',
  declined: 'owner',
  cancelled: null,
};

export function ownerBallOf(stage: IssuanceStage | null): OwnerBallParty | null {
  return stage === null ? null : OWNER_BALL[stage];
}

/** Η προσφορά της νικήτριας, αν υπάρχει στον κύκλο. */
export function awardedBidOf(view: IssuanceBiddingView): IssuanceBidView | null {
  const award = view.request?.award ?? null;
  return award === null ? null : view.bids.find((bid) => bid.bidId === award.bidId) ?? null;
}

/**
 * Η νικήτρια είναι ακόμη ανοιχτή — η ίδια κρίση με το `awardedBidOpen` του διακομιστή: το στάδιο που έστειλε είναι
 * `visibleIssuanceStage(issuanceStateOf(…))`, άρα `≠ null` ⇔ `kind === 'open'`.
 */
function awardedBidOpen(view: IssuanceBiddingView): boolean {
  return (awardedBidOf(view)?.stage ?? null) !== null;
}

export function requestPhaseOf(view: IssuanceBiddingView): IssuanceRequestPhase {
  const request = view.request;
  if (request === null) return 'none';
  if (request.closure !== null) return 'closed';
  if (request.award === null) return 'inviting';
  return awardedBidOpen(view) ? 'awarded' : 'closed';
}

/** CAS — ο κύκλος που είδε ο άνθρωπος (`null` = κανένα αίτημα). Ίδιο για invite · award · cancel. */
export function expectedCycleOf(view: IssuanceBiddingView): number | null {
  return view.request?.cycle ?? null;
}

/** CAS — το στάδιο **κάθε** προσφοράς του κύκλου όπως φαίνεται τώρα (ο διακομιστής απαιτεί όλες, όχι μόνο μία). */
export function expectedStagesOf(view: IssuanceBiddingView): Readonly<Record<string, IssuanceStage | null>> {
  return Object.fromEntries(view.bids.map((bid) => [bid.bidId, bid.stage]));
}

/** Ο ιδιώτης μπορεί να επιλέξει **αυτή** την προσφορά: ζωντανός κύκλος χωρίς νικήτρια, και η προσφορά έχει τιμή προς απόφαση. */
export function canAwardBid(view: IssuanceBiddingView, bid: IssuanceBidView): boolean {
  return requestPhaseOf(view) === 'inviting' && bid.stage === 'quoted' && bid.record !== null && bid.record.quote !== null;
}

/** Ακύρωση **αιτήματος** — μόνο χωρίς νικήτρια (μετά την ανάθεση ακυρώνεται η ίδια η ανάθεση, §7.4). */
export function canCancelRequest(view: IssuanceBiddingView): boolean {
  return requestPhaseOf(view) === 'inviting';
}

/** Πώς θα κριθεί μια πρόσκληση προς **αυτή** τη βιτρίνα, τώρα. */
export type InviteVerdict =
  | { readonly kind: 'can-invite' }
  | { readonly kind: 'invited' }
  | { readonly kind: 'refused'; readonly refusal: IssuanceRequestRefusal };

/** Ο ιδιώτης δεν δηλώνει ποτέ `bidId` — εδώ αρκεί ένα σημάδι που δεν συμπίπτει με κανένα πραγματικό. */
const PROBE_BID_ID = 'probe';
const PROBE_CTX = { uid: 'probe', nowIso: '1970-01-01T00:00:00.000Z' } as const;

/** Ο **ΙΔΙΟΣ** μειωτής με τον διακομιστή — η απάντηση για τη βιτρίνα `companyId` (κενό = «κάποιος νέος»). */
export function inviteVerdictOf(view: IssuanceBiddingView, companyId: string): InviteVerdict {
  const phase = requestPhaseOf(view);
  const live = phase === 'inviting' || phase === 'awarded';
  const professional: IssuanceProfessional = { kind: 'workspace', companyId };
  if (live && view.request?.bids.some((bid) => sameProfessional(bid.professional, professional))) return { kind: 'invited' };
  const reduced = reduceIssuanceRequest(view.request, { kind: 'invite', professional, bidId: PROBE_BID_ID }, {
    ...PROBE_CTX,
    awardedBidOpen: awardedBidOpen(view),
  });
  return reduced.ok ? { kind: 'can-invite' } : { kind: 'refused', refusal: reduced.refusal };
}

/** «Πρόσκληση κι άλλου»: ο μειωτής δέχεται **έναν ακόμη** επαγγελματία στον κύκλο που φαίνεται. */
export function canInviteMore(view: IssuanceBiddingView): boolean {
  return inviteVerdictOf(view, '').kind === 'can-invite';
}

/** Ένα γεγονός στο χρονολόγιο μιας προσφοράς — **από τα γεγονότα της ανάθεσης**, ποτέ από αποθηκευμένη σημαία. */
export const BID_TIMELINE_KINDS = [
  'requested', 'sent', 'quoted', 'revised', 'approved', 'rejected', 'accepted', 'declined', 'cancelled', 'not-awarded',
] as const;
export type BidTimelineKind = (typeof BID_TIMELINE_KINDS)[number];

export interface BidTimelineEntry {
  readonly kind: BidTimelineKind;
  readonly at: string;
}

function decisionEntry(record: IssuanceAssignmentRecord): BidTimelineEntry | null {
  const decision = record.decision;
  return decision === null ? null : { kind: decision.outcome === 'approved' ? 'approved' : 'rejected', at: decision.at };
}

function quoteEntry(record: IssuanceAssignmentRecord): BidTimelineEntry | null {
  const quote = record.quote;
  return quote === null ? null : { kind: quote.previous === null ? 'quoted' : 'revised', at: quote.at };
}

/** Το χρονολόγιο της προσφοράς, με τη σειρά του χρόνου (ίδια στιγμή ⇒ σειρά της ροής). */
export function bidTimelineOf(record: IssuanceAssignmentRecord): readonly BidTimelineEntry[] {
  const entries: (BidTimelineEntry | null)[] = [
    { kind: 'requested', at: record.proposedAt },
    record.notice === null ? null : { kind: 'sent', at: record.notice.at },
    quoteEntry(record),
    decisionEntry(record),
    record.response === null ? null : { kind: record.response.outcome, at: record.response.at },
    record.cancellation === null ? null : { kind: record.cancellation.reason, at: record.cancellation.at },
  ];
  return entries
    .filter((entry): entry is BidTimelineEntry => entry !== null)
    .map((entry, order) => ({ entry, order }))
    .sort((a, b) => (a.entry.at === b.entry.at ? a.order - b.order : a.entry.at < b.entry.at ? -1 : 1))
    .map(({ entry }) => entry);
}
