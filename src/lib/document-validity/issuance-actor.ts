/**
 * =============================================================================
 * Μητρώο λήξεων — ΠΟΙΟΣ ΠΡΑΤΤΕΙ σε μια ανάθεση έκδοσης, και ΤΙ ΑΠΟΔΕΙΚΝΥΕΙ (ADR-915 §28 Η-Β2 · §29 · §42)
 * =============================================================================
 *
 * **«Με ποια βάση γράφεται αυτή η απόφαση/απάντηση/προσφορά;»** Η βάση **παράγεται** από τον actor, ποτέ από το αίτημα:
 * ένα αίτημα δεν μπορεί να δηλώσει «με σύνδεσμο» χωρίς σύνδεσμο, ούτε «καταγραφή του γραφείου» χωρίς άνθρωπο του γραφείου.
 *
 * 🔑 Ο σύνδεσμος πράττει μόνο αν είναι του **τρέχοντος** μηνύματος (αίτημα έγκρισης ή μήνυμα στον επαγγελματία) **και**
 *    απέδειξε ό,τι ζήτησε εκείνο (§29): νέο μήνυμα ή νέα πρόταση ⇒ ο παλιός πεθαίνει από κατασκευή.
 * 🔑 Η αυθεντία είναι ο μειωτής (`./issuance-assignment.ts`), όχι η πόρτα: εδώ ζουν οι καθαρές κρίσεις που χρησιμοποιεί.
 *
 * **Layering**: leaf — καθαρές συναρτήσεις, μηδέν I/O. Από τον μειωτή εισάγονται **μόνο τύποι** (όπως `./issuance-stage.ts`).
 *
 * @module lib/document-validity/issuance-actor
 */

import type { IssuanceAction, IssuanceActionKind, IssuanceApprovalRequest, IssuanceNotice } from './issuance-assignment';
import type { QuoteSubmission } from './issuance-quote';

/** Πώς έδωσε ο ιδιοκτήτης την εντολή του — η **βάση** της καταγραφής. Κλειστό σύνολο. */
export const INSTRUCTION_CHANNELS = ['in-person', 'phone', 'email', 'written'] as const;
export type InstructionChannel = (typeof INSTRUCTION_CHANNELS)[number];

/**
 * **Τι ζητά ένας σύνδεσμος για να πράξει** (§29): `link` = ο σύνδεσμος αρκεί (§28) · `access-code` = και ο κωδικός που
 * είπε το γραφείο σε **δεύτερο** κανάλι. Το αίτημα γράφει τι **ζητήθηκε**· η βάση της απόφασης τι **αποδείχθηκε**.
 */
export const LINK_VERIFICATIONS = ['link', 'access-code'] as const;
export type LinkVerification = (typeof LINK_VERIFICATIONS)[number];

/** Αρκεί αυτό που αποδείχθηκε για αυτό που ζητήθηκε; — ο κωδικός καλύπτει και το «μόνο σύνδεσμος», όχι το αντίστροφο. */
export function linkVerificationSatisfies(required: LinkVerification, proven: LinkVerification): boolean {
  return required === 'link' || proven === 'access-code';
}

/**
 * **Ποιος πράττει** (§28 Η-Β2): άνθρωπος του γραφείου (`uid`) ή ο κάτοχος ενός συνδέσμου (`invitationId`). Η βάση της
 * απόφασης/απάντησης **παράγεται** από εδώ — ένα αίτημα δεν μπορεί να δηλώσει «με σύνδεσμο» χωρίς σύνδεσμο.
 */
export type IssuanceActor =
  | { readonly kind: 'office'; readonly uid: string; readonly nowIso: string }
  /** `verifiedBy` = τι **απέδειξε** ο κάτοχος (§29): μόνο τον σύνδεσμο, ή και τον κωδικό του δεύτερου καναλιού. */
  | { readonly kind: 'link'; readonly invitationId: string; readonly verifiedBy: LinkVerification; readonly nowIso: string }
  /**
   * §45.20 Φ6γ — ο επαγγελματίας **συνδεδεμένος**, από τον χώρο της συμμετοχής του (ADR-089). Το ότι η συμμετοχή είναι
   * ενεργή και **αυτής** της ανάθεσης το αποδεικνύει ο διακομιστής πριν από τον μειωτή· ο μειωτής του επιτρέπει **μόνο**
   * το αίτημα αλλαγής προθεσμίας — ποτέ απόφαση, απάντηση ή προσφορά (αυτές έχουν τη δική τους βάση).
   */
  | { readonly kind: 'engagement'; readonly engagementId: string; readonly uid: string; readonly nowIso: string }
  /**
   * ADR-945 Δ3 — **ο ίδιος ο ιδιοκτήτης**, στο **δικό του** βιβλίο (ιδιώτης). Ότι το βιβλίο είναι δικό του το αποδεικνύει ο
   * διακομιστής πριν από τον μειωτή (`mayAdminister`)· ο μειωτής του επιτρέπει μόνο πρόταση, απόφαση και ακύρωση — και
   * η απόφασή του είναι η ίδια η έγκριση (`owner-self`), χωρίς υπεύθυνο-επαφή και χωρίς σύνδεσμο.
   */
  | { readonly kind: 'owner'; readonly uid: string; readonly nowIso: string }
  /**
   * ADR-943 Κ-8 — ο διακομιστής, **αφού** διάβασε την αλήθεια στο API του παρόχου πληρωμών. Γράφει **μόνο** γεγονότα
   * χρημάτων της προκαταβολής (`advance-funded` · `advance-released` · `advance-refunded`)· καμία απόφαση, καμία απάντηση.
   */
  | { readonly kind: 'system'; readonly source: 'payments'; readonly nowIso: string };

/** Ποιες πράξεις μπορεί να κάνει **ο σύνδεσμος** — όλες οι άλλες ανήκουν στο γραφείο (§28 Η-Β2). */
const LINK_ACTIONS: ReadonlySet<IssuanceActionKind> = new Set(['decide', 'respond', 'quote']);

/** §45.20 Φ6γ — τι κάνει **η συμμετοχή** του μηχανικού: μόνο αίτημα· και αυτό **μόνο** εκείνη (ποτέ γραφείο ή σύνδεσμος). */
const ENGAGEMENT_ACTIONS: ReadonlySet<IssuanceActionKind> = new Set(['request-delivery-change']);

/** ADR-945 Δ3 — τι κάνει **ο ιδιώτης** στο δικό του βιβλίο: πρόταση (κρίνεται χωριστά), απόφαση, ακύρωση. */
const OWNER_ACTIONS: ReadonlySet<IssuanceActionKind> = new Set(['decide', 'cancel']);

/** «Ποιος» πριν από «από πού»: κάθε actor κάνει μόνο τις δικές του πράξεις, σε **κανένα** στάδιο τις ξένες. */
export function actorMayAct(actor: IssuanceActor, kind: IssuanceActionKind): boolean {
  if (actor.kind === 'system') return false; // ADR-943: μόνο πράξεις προκαταβολής, που κρίνονται πριν από εδώ.
  if (actor.kind === 'owner') return OWNER_ACTIONS.has(kind);
  if (actor.kind === 'engagement') return ENGAGEMENT_ACTIONS.has(kind);
  if (ENGAGEMENT_ACTIONS.has(kind)) return false;
  return actor.kind === 'office' || LINK_ACTIONS.has(kind);
}

/**
 * **Η βάση της απόφασης** (§28 Η-Β2) — παράγεται από **ποιος** έπραξε, ποτέ από το αίτημα:
 * - `recorded-instruction` — το γραφείο κατέγραψε εντολή που πήρε (κανάλι + ποιος κατέγραψε)·
 * - `owner-link-approval` — ο ίδιος ο υπεύθυνος πάτησε τον σύνδεσμο του **τρέχοντος** αιτήματος (το token αποδεικνύει το mailbox)·
 * - `owner-self` — ADR-945 Δ3: ο ιδιώτης αποφάσισε ο ίδιος, συνδεδεμένος, στο δικό του βιβλίο.
 * 🔑 Ο υπεύθυνος-επαφή (`ownerContactId`, §26) ζει **μόνο** στις βάσεις του γραφείου: ο ιδιώτης δεν είναι επαφή κανενός
 *    βιβλίου. Ρώτα {@link decisionOwnerContactIdOf} — ποτέ μη διαβάζεις το πεδίο χωρίς τη βάση.
 */
export type IssuanceDecisionBasis =
  | { readonly basis: 'recorded-instruction'; readonly channel: InstructionChannel; readonly recordedByUid: string; readonly ownerContactId: string }
  | { readonly basis: 'owner-link-approval'; readonly invitationId: string; readonly verifiedBy: LinkVerification; readonly ownerContactId: string }
  | { readonly basis: 'owner-self'; readonly uid: string };

/** Ο υπεύθυνος-επαφή της απόφασης — `null` όταν αποφάσισε ο ίδιος ο ιδιώτης (`owner-self`). */
export function decisionOwnerContactIdOf(basis: IssuanceDecisionBasis): string | null {
  return basis.basis === 'owner-self' ? null : basis.ownerContactId;
}

/** Η βάση της απάντησης του επαγγελματία — καταγραφή του γραφείου ή ο σύνδεσμος του **τρέχοντος** μηνύματος. */
export type IssuanceResponseBasis =
  | { readonly basis: 'recorded'; readonly recordedByUid: string }
  | { readonly basis: 'professional-link'; readonly invitationId: string; readonly verifiedBy: LinkVerification };

type DecideAction = Extract<IssuanceAction, { kind: 'decide' }>;

/**
 * Η βάση της απόφασης — **από τον actor**. Ο σύνδεσμος αποφασίζει μόνο αν είναι ο σύνδεσμος του **τρέχοντος** αιτήματος
 * και για τον υπεύθυνο **στον οποίο στάλθηκε** (§28 Η-Β1): νέο αίτημα ή νέα πρόταση ⇒ ο παλιός πεθαίνει από κατασκευή.
 * `null` ⇒ `actor-refused`.
 */
export function decisionBasisOf(request: IssuanceApprovalRequest | null, action: DecideAction, actor: IssuanceActor): IssuanceDecisionBasis | null {
  const { channel, ownerContactId } = action;
  // ADR-945 Δ3: ο ιδιώτης αποφασίζει ο ίδιος — κανένα κανάλι καταγραφής, κανένας υπεύθυνος-επαφή.
  if (actor.kind === 'owner') return channel === null && ownerContactId === null ? { basis: 'owner-self', uid: actor.uid } : null;
  if (ownerContactId === null) return null;
  if (actor.kind === 'office') {
    return channel === null ? null : { basis: 'recorded-instruction', channel, recordedByUid: actor.uid, ownerContactId };
  }
  if (actor.kind !== 'link') return null;
  // §29: ο σύνδεσμος του τρέχοντος αιτήματος **και** ό,τι ζήτησε το αίτημα — ο μειωτής, όχι η πόρτα, είναι η αυθεντία.
  const current = channel === null && request !== null
    && request.invitationId === actor.invitationId && request.ownerContactId === ownerContactId
    && linkVerificationSatisfies(request.verification, actor.verifiedBy);
  return current ? { basis: 'owner-link-approval', invitationId: actor.invitationId, verifiedBy: actor.verifiedBy, ownerContactId } : null;
}

/** Η βάση της απάντησης — ο σύνδεσμος απαντά μόνο αν είναι του **τρέχοντος** μηνύματος προς τον επαγγελματία. */
export function responseBasisOf(notice: IssuanceNotice | null, actor: IssuanceActor): IssuanceResponseBasis | null {
  if (actor.kind === 'office') return { basis: 'recorded', recordedByUid: actor.uid };
  if (actor.kind !== 'link') return null;
  const current = notice !== null && notice.invitationId === actor.invitationId
    && linkVerificationSatisfies(notice.verification ?? 'link', actor.verifiedBy);
  return current ? { basis: 'professional-link', invitationId: actor.invitationId, verifiedBy: actor.verifiedBy } : null;
}

/** Η υποβολή της προσφοράς — από τον actor, όπως η βάση της απάντησης (μόνο ο σύνδεσμος του **τρέχοντος** αιτήματος). */
export function quoteSubmissionOf(notice: IssuanceNotice | null, actor: IssuanceActor): QuoteSubmission | null {
  const basis = responseBasisOf(notice, actor);
  if (basis === null) return null;
  return basis.basis === 'recorded'
    ? { by: 'recorded', recordedByUid: basis.recordedByUid }
    : { by: 'professional-link', invitationId: basis.invitationId };
}
