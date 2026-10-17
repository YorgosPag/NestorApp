/**
 * =============================================================================
 * Μητρώο λήξεων — Η ΑΝΑΘΕΣΗ ΕΚΔΟΣΗΣ σε επαγγελματία (ADR-915 §27)
 * =============================================================================
 *
 * **«Ποιος βγάζει το νέο ΠΕΑ, ποιος το αποφάσισε, και σε ποιον είναι η μπάλα;»** Ένα αντικείμενο ανά (ακίνητο, είδος):
 * το γραφείο **ΠΡΟΤΕΙΝΕΙ**, ο ιδιοκτήτης **ΑΠΟΦΑΣΙΖΕΙ**, η εφαρμογή **ΚΑΤΑΓΡΑΦΕΙ** — γιατί ο νόμος απευθύνεται στον
 * ιδιοκτήτη (ν.4122/2013 άρθρο 12 §2 · ΗΤΚ: «ο μηχανικός ορίζεται από τους κυρίους») και η εντολή μεσιτείας είναι
 * μεσολάβηση, όχι αντιπροσώπευση (ν.4072/2012 άρθρα 200-201).
 *
 * | Στάδιο | Μπάλα | Πώς φτάνει εδώ |
 * |---|---|---|
 * | `proposed` | ιδιοκτήτης | το γραφείο πρότεινε επαγγελματία |
 * | `ownerApproved` | γραφείο | καταγράφηκε απόφαση του **υπευθύνου** ιδιοκτήτη (§26) |
 * | `ownerRejected` | — (κλειστό) | ο ιδιοκτήτης είπε όχι |
 * | `sent` | επαγγελματίας | ο επαγγελματίας ενημερώθηκε |
 * | `accepted` | επαγγελματίας | ανέλαβε — περιμένουμε το έγγραφο |
 * | `declined` | γραφείο | αρνήθηκε — νέα πρόταση |
 * | `cancelled` | — (κλειστό) | το γραφείο ακύρωσε |
 *
 * 🔑 **Το στάδιο ΠΑΡΑΓΕΤΑΙ από τα γεγονότα** (`decision` · `notice` · `response` · `cancellation`), δεν αποθηκεύεται
 *    δίπλα τους: δύο πεδία που λένε το ίδιο θα μπορούσαν να διαφωνήσουν.
 * 🔑 **Η ολοκλήρωση ΠΑΡΑΓΕΤΑΙ από το μητρώο** (ιδίωμα `pendingRequestOf`): νέο έγγραφο του είδους με έκδοση **μετά** την
 *    πρόταση ⇒ ολοκληρώθηκε. Την κρίνει ο αποδέκτης (το έγγραφο ήρθε), ποτέ ο επαγγελματίας (Procore · TrustLayer).
 * 🔑 **Ένα ενεργό ανά (ακίνητο, είδος)** ⇒ «ποτέ δύο ΠΕΑ» (§26 Ζ9). Νέα πρόταση επιτρέπεται μόνο όσο τίποτα δεν έχει
 *    δεσμευτεί (`proposed` · `declined`) ή ο κύκλος έκλεισε.
 * 🔑 **Ο μειωτής είναι καθαρός**: ο ίδιος κρίνει στη συναλλαγή του διακομιστή και στην αισιόδοξη εμφάνιση της οθόνης.
 *
 * **Layering**: leaf — καθαρές συναρτήσεις, μηδέν I/O.
 *
 * @module lib/document-validity/issuance-assignment
 */

import type { IssuerQualification } from '@/config/document-validity/document-issuers';
import { documentKindSpec, type DocumentKind } from '@/config/document-validity/document-validity';
import { conveyanceToday } from '@/lib/conveyance/conveyance-calendar';

export const ISSUANCE_STAGES = [
  'proposed', 'ownerApproved', 'ownerRejected', 'sent', 'accepted', 'declined', 'cancelled',
] as const;
export type IssuanceStage = (typeof ISSUANCE_STAGES)[number];

/** Πώς έδωσε ο ιδιοκτήτης την εντολή του — η **βάση** της καταγραφής. Κλειστό σύνολο. */
export const INSTRUCTION_CHANNELS = ['in-person', 'phone', 'email', 'written'] as const;
export type InstructionChannel = (typeof INSTRUCTION_CHANNELS)[number];

/** Πώς ενημερώθηκε ο επαγγελματίας. */
export const NOTICE_CHANNELS = ['phone', 'email', 'in-person'] as const;
export type NoticeChannel = (typeof NOTICE_CHANNELS)[number];

/** Σε ποιον είναι η μπάλα — Procore «Ball in Court», παραγόμενο. */
export const BALL_IN_COURT_PARTIES = ['owner', 'office', 'professional'] as const;
export type BallInCourtParty = (typeof BALL_IN_COURT_PARTIES)[number];

/** Το μέγιστο μήκος σημείωσης απόφασης / αριθμού μητρώου — αμυντικά, όχι πολιτική. */
export const ISSUANCE_NOTE_MAX = 500;
export const REGISTRY_NUMBER_MAX = 40;

/** Το δηλωμένο προσόν του επαγγελματία για **αυτό** το έγγραφο — δηλωμένο, όχι επαληθευμένο (το λέει η οθόνη). */
export interface IssuanceCredential {
  readonly qualification: IssuerQualification;
  readonly registryNumber: string | null;
}

/**
 * **Η βάση της απόφασης** (§28 Η-Β2) — παράγεται από **ποιος** έπραξε, ποτέ από το αίτημα:
 * - `recorded-instruction` — το γραφείο κατέγραψε εντολή που πήρε (κανάλι + ποιος κατέγραψε)·
 * - `owner-link-approval` — ο ίδιος ο υπεύθυνος πάτησε τον σύνδεσμο του **τρέχοντος** αιτήματος (το token αποδεικνύει το mailbox).
 */
export type IssuanceDecisionBasis =
  | { readonly basis: 'recorded-instruction'; readonly channel: InstructionChannel; readonly recordedByUid: string }
  | { readonly basis: 'owner-link-approval'; readonly invitationId: string };

export type IssuanceDecision = IssuanceDecisionBasis & {
  readonly outcome: 'approved' | 'rejected';
  /** Ο υπεύθυνος ιδιοκτήτης (§26) **τη στιγμή της απόφασης** — παράγεται στον διακομιστή, ποτέ από τον πελάτη. */
  readonly ownerContactId: string;
  readonly note: string | null;
  readonly at: string;
};

/** Η βάση της απάντησης του επαγγελματία — καταγραφή του γραφείου ή ο σύνδεσμος του **τρέχοντος** μηνύματος. */
export type IssuanceResponseBasis =
  | { readonly basis: 'recorded'; readonly recordedByUid: string }
  | { readonly basis: 'professional-link'; readonly invitationId: string };

export type IssuanceResponse = IssuanceResponseBasis & {
  readonly outcome: 'accepted' | 'declined';
  readonly note: string | null;
  readonly at: string;
};

/**
 * Τι απέγινε ένα email — **ποτέ** «παραδόθηκε» (το `200` του παρόχου σημαίνει «μπήκε σε ουρά»). Ίδιες λέξεις με το
 * `InvitationNoticeOutcome` του αποστολέα (ο server το ελέγχει με `satisfies`).
 */
export const ISSUANCE_DELIVERY_OUTCOMES = ['accepted', 'failed', 'unaddressable'] as const;
export type IssuanceDeliveryOutcome = (typeof ISSUANCE_DELIVERY_OUTCOMES)[number];

/** Η παράδοση ενός μηνύματος (§28 Η-Β9) — **τηλεμετρία**, όχι στάδιο. Συνιδιοκτήτες: μόνο στο αίτημα έγκρισης. */
export interface IssuanceDelivery {
  readonly recipient: IssuanceDeliveryOutcome;
  readonly coOwners: Readonly<Record<string, IssuanceDeliveryOutcome>>;
}

/** Το αίτημα έγκρισης με σύνδεσμο προς τον υπεύθυνο (§28 Η-Β1) — **μόνο αυτό** το `invitationId` αποφασίζει. */
export interface IssuanceApprovalRequest {
  readonly invitationId: string;
  readonly ownerContactId: string;
  readonly note: string | null;
  readonly at: string;
  readonly byUid: string;
  /** `null` = το email δεν έχει ακόμη κριθεί (ή η αναφορά του χάθηκε). */
  readonly delivery: IssuanceDelivery | null;
}

export interface IssuanceNotice {
  readonly channel: NoticeChannel;
  readonly at: string;
  readonly byUid: string;
  /** Το μήνυμα με σύνδεσμο (§28) — `null` = ενημέρωση εκτός εφαρμογής, που απλώς καταγράφηκε. */
  readonly invitationId: string | null;
  readonly note: string | null;
  readonly delivery: IssuanceDelivery | null;
}

/** Τα γεγονότα μιας ανάθεσης — ό,τι αποθηκεύεται πέρα από την ταυτότητα. */
export interface IssuanceAssignmentRecord {
  readonly professionalContactId: string;
  readonly credential: IssuanceCredential;
  readonly proposedAt: string;
  readonly proposedByUid: string;
  readonly approvalRequest: IssuanceApprovalRequest | null;
  readonly decision: IssuanceDecision | null;
  readonly notice: IssuanceNotice | null;
  readonly response: IssuanceResponse | null;
  readonly cancellation: { readonly at: string; readonly byUid: string } | null;
}

/** Το στάδιο — από τα γεγονότα, με σειρά προτεραιότητας (η ακύρωση νικά τα πάντα). */
export function issuanceStageOf(record: IssuanceAssignmentRecord): IssuanceStage {
  if (record.cancellation !== null) return 'cancelled';
  if (record.decision?.outcome === 'rejected') return 'ownerRejected';
  if (record.response !== null) return record.response.outcome;
  if (record.notice !== null) return 'sent';
  return record.decision === null ? 'proposed' : 'ownerApproved';
}

const BALL_IN_COURT: Readonly<Record<IssuanceStage, BallInCourtParty | null>> = {
  proposed: 'owner',
  ownerApproved: 'office',
  ownerRejected: null,
  sent: 'professional',
  accepted: 'professional',
  declined: 'office',
  cancelled: null,
};

export function ballInCourtOf(stage: IssuanceStage): BallInCourtParty | null {
  return BALL_IN_COURT[stage];
}

/**
 * Πώς φαίνεται η ανάθεση **τώρα**:
 * - `none`      — δεν υπάρχει (ή ο κύκλος έκλεισε / ολοκληρώθηκε) ⇒ νέα πρόταση ελεύθερη
 * - `open`      — ενεργή, με στάδιο και μπάλα
 * Η ολοκλήρωση **λέγεται** (`fulfilled`) για να γράψει η οθόνη «εκδόθηκε», αλλά ανοίγει νέο κύκλο.
 */
export type IssuanceState =
  | { readonly kind: 'none'; readonly last: IssuanceAssignmentRecord | null; readonly fulfilled: boolean }
  | { readonly kind: 'open'; readonly record: IssuanceAssignmentRecord; readonly stage: IssuanceStage; readonly ballInCourt: BallInCourtParty };

/**
 * Ολοκληρώθηκε; — υπάρχει έγγραφο του είδους με έκδοση **την ίδια μέρα ή μετά** την πρόταση. Η ημέρα μετρά στην ώρα
 * Ελλάδας (ένα ρολόι με το μητρώο, `conveyanceToday`).
 */
export function isIssuanceFulfilled(record: IssuanceAssignmentRecord, latestIssuedOn: string | null): boolean {
  return latestIssuedOn !== null && latestIssuedOn >= conveyanceToday(new Date(record.proposedAt));
}

export function issuanceStateOf(record: IssuanceAssignmentRecord | null, latestIssuedOn: string | null): IssuanceState {
  if (record === null) return { kind: 'none', last: null, fulfilled: false };
  if (isIssuanceFulfilled(record, latestIssuedOn)) return { kind: 'none', last: record, fulfilled: true };
  const stage = issuanceStageOf(record);
  const ballInCourt = ballInCourtOf(stage);
  return ballInCourt === null ? { kind: 'none', last: record, fulfilled: false } : { kind: 'open', record, stage, ballInCourt };
}

/** Το στάδιο που **βλέπει** ο άνθρωπος — `null` όταν δεν υπάρχει ενεργή ανάθεση (η CAS του πελάτη στέλνει αυτό). */
export function visibleIssuanceStage(state: IssuanceState): IssuanceStage | null {
  return state.kind === 'open' ? state.stage : null;
}

/** Η ανάθεση είναι ακόμη **ελεύθερη** για νέα πρόταση: τίποτα δεν δεσμεύτηκε προς τον επαγγελματία. */
export function canProposeIssuance(state: IssuanceState): boolean {
  return state.kind === 'none' || state.stage === 'proposed' || state.stage === 'declined';
}

// ---------------------------------------------------------------------------
// Ο μειωτής
// ---------------------------------------------------------------------------

export type IssuanceAction =
  | { readonly kind: 'propose'; readonly professionalContactId: string; readonly credential: IssuanceCredential }
  /** §28 — στάλθηκε σύνδεσμος έγκρισης στον υπεύθυνο. Ίδιο στάδιο· νέο αίτημα ⇒ ο προηγούμενος σύνδεσμος πεθαίνει. */
  | { readonly kind: 'request-approval'; readonly invitationId: string; readonly ownerContactId: string; readonly note: string | null }
  | {
      readonly kind: 'decide';
      readonly outcome: 'approved' | 'rejected';
      /** Το κανάλι της **καταγραφής** του γραφείου· `null` ⇔ αποφασίζει ο ίδιος με σύνδεσμο. */
      readonly channel: InstructionChannel | null;
      readonly note: string | null;
      /** Ο υπεύθυνος — από τον κριτή του διακομιστή (ή, αισιόδοξα, ό,τι είδε η οθόνη). */
      readonly ownerContactId: string;
    }
  /** `invitationId` ≠ `null` ⇔ στάλθηκε μήνυμα με σύνδεσμο (επιτρέπεται και ξανά, από `sent`). */
  | { readonly kind: 'notify'; readonly channel: NoticeChannel; readonly invitationId: string | null; readonly note: string | null }
  | { readonly kind: 'respond'; readonly outcome: 'accepted' | 'declined'; readonly note: string | null }
  | { readonly kind: 'cancel' };

export type IssuanceActionKind = IssuanceAction['kind'];

/** Από ποια στάδια επιτρέπεται κάθε πράξη (η πρόταση κρίνεται χωριστά, {@link canProposeIssuance}). */
const ALLOWED_FROM: Readonly<Record<Exclude<IssuanceActionKind, 'propose'>, readonly IssuanceStage[]>> = {
  'request-approval': ['proposed'],
  decide: ['proposed'],
  notify: ['ownerApproved', 'sent'],
  respond: ['sent'],
  cancel: ['proposed', 'ownerApproved', 'sent', 'accepted', 'declined'],
};

/** Ποιες πράξεις μπορεί να κάνει **ο σύνδεσμος** — όλες οι άλλες ανήκουν στο γραφείο (§28 Η-Β2). */
const LINK_ACTIONS: ReadonlySet<IssuanceActionKind> = new Set(['decide', 'respond']);

/**
 * **Ποιος πράττει** (§28 Η-Β2): άνθρωπος του γραφείου (`uid`) ή ο κάτοχος ενός συνδέσμου (`invitationId`). Η βάση της
 * απόφασης/απάντησης **παράγεται** από εδώ — ένα αίτημα δεν μπορεί να δηλώσει «με σύνδεσμο» χωρίς σύνδεσμο.
 */
export type IssuanceActor =
  | { readonly kind: 'office'; readonly uid: string; readonly nowIso: string }
  | { readonly kind: 'link'; readonly invitationId: string; readonly nowIso: string };

/**
 * - `transition-refused` — η πράξη δεν επιτρέπεται από αυτό το στάδιο·
 * - `unqualified` — το προσόν δεν υπογράφει αυτό το είδος·
 * - `actor-refused` — **αυτός** ο actor δεν κάνει αυτή την πράξη: γραφείο χωρίς κανάλι καταγραφής, σύνδεσμος για πράξη
 *   του γραφείου, ή σύνδεσμος που **δεν** είναι του τρέχοντος αιτήματος (παλιός, αντικατεστημένος, άλλου ακροατηρίου).
 */
export type IssuanceRefusalReason = 'transition-refused' | 'unqualified' | 'actor-refused';

export type IssuanceReduction =
  | { readonly ok: true; readonly record: IssuanceAssignmentRecord; readonly changed: boolean }
  | { readonly ok: false; readonly refusal: IssuanceRefusalReason };

function proposed(action: Extract<IssuanceAction, { kind: 'propose' }>, uid: string, nowIso: string): IssuanceAssignmentRecord {
  return {
    professionalContactId: action.professionalContactId,
    credential: action.credential,
    proposedAt: nowIso,
    proposedByUid: uid,
    approvalRequest: null,
    decision: null,
    notice: null,
    response: null,
    cancellation: null,
  };
}

function sameProposal(state: IssuanceState, action: Extract<IssuanceAction, { kind: 'propose' }>): boolean {
  if (state.kind !== 'open' || state.stage !== 'proposed') return false;
  const { professionalContactId, credential } = state.record;
  return professionalContactId === action.professionalContactId
    && credential.qualification === action.credential.qualification
    && credential.registryNumber === action.credential.registryNumber;
}

type AdvancingAction = Exclude<IssuanceAction, { kind: 'propose' }>;

/**
 * Η βάση της απόφασης — **από τον actor**. Ο σύνδεσμος αποφασίζει μόνο αν είναι ο σύνδεσμος του **τρέχοντος** αιτήματος
 * και για τον υπεύθυνο **στον οποίο στάλθηκε** (§28 Η-Β1): νέο αίτημα ή νέα πρόταση ⇒ ο παλιός πεθαίνει από κατασκευή.
 * `null` ⇒ `actor-refused`.
 */
function decisionBasisOf(record: IssuanceAssignmentRecord, action: Extract<AdvancingAction, { kind: 'decide' }>, actor: IssuanceActor): IssuanceDecisionBasis | null {
  if (actor.kind === 'office') {
    return action.channel === null ? null : { basis: 'recorded-instruction', channel: action.channel, recordedByUid: actor.uid };
  }
  const request = record.approvalRequest;
  const current = action.channel === null && request !== null
    && request.invitationId === actor.invitationId && request.ownerContactId === action.ownerContactId;
  return current ? { basis: 'owner-link-approval', invitationId: actor.invitationId } : null;
}

/** Η βάση της απάντησης — ο σύνδεσμος απαντά μόνο αν είναι του **τρέχοντος** μηνύματος προς τον επαγγελματία. */
function responseBasisOf(record: IssuanceAssignmentRecord, actor: IssuanceActor): IssuanceResponseBasis | null {
  if (actor.kind === 'office') return { basis: 'recorded', recordedByUid: actor.uid };
  return record.notice?.invitationId === actor.invitationId ? { basis: 'professional-link', invitationId: actor.invitationId } : null;
}

/** Οι πράξεις που κάνει **μόνο** το γραφείο — ο έλεγχος actor έγινε ήδη. */
function officeAdvanced(record: IssuanceAssignmentRecord, action: Exclude<AdvancingAction, { kind: 'decide' | 'respond' }>, uid: string, at: string): IssuanceAssignmentRecord {
  switch (action.kind) {
    case 'request-approval': return {
      ...record,
      approvalRequest: { invitationId: action.invitationId, ownerContactId: action.ownerContactId, note: action.note, at, byUid: uid, delivery: null },
    };
    case 'notify': return {
      ...record,
      notice: { channel: action.channel, at, byUid: uid, invitationId: action.invitationId, note: action.note, delivery: null },
    };
    case 'cancel': return { ...record, cancellation: { at, byUid: uid } };
  }
}

function advanced(record: IssuanceAssignmentRecord, stage: IssuanceStage, action: AdvancingAction, actor: IssuanceActor): IssuanceReduction {
  if (action.kind === 'decide') {
    const basis = decisionBasisOf(record, action, actor);
    if (basis === null) return { ok: false, refusal: 'actor-refused' };
    const decision: IssuanceDecision = { ...basis, outcome: action.outcome, ownerContactId: action.ownerContactId, note: action.note, at: actor.nowIso };
    return { ok: true, record: { ...record, decision }, changed: true };
  }
  if (action.kind === 'respond') {
    const basis = responseBasisOf(record, actor);
    if (basis === null) return { ok: false, refusal: 'actor-refused' };
    return { ok: true, record: { ...record, response: { ...basis, outcome: action.outcome, note: action.note, at: actor.nowIso } }, changed: true };
  }
  // Ξανά ενημέρωση από `sent` έχει νόημα μόνο ως **νέο μήνυμα** (χαμένο email)· μια δεύτερη «σημείωση τηλεφώνου» όχι.
  if (action.kind === 'notify' && stage === 'sent' && action.invitationId === null) return { ok: false, refusal: 'transition-refused' };
  if (actor.kind !== 'office') return { ok: false, refusal: 'actor-refused' };
  return { ok: true, record: officeAdvanced(record, action, actor.uid, actor.nowIso), changed: true };
}

/**
 * **Η παράδοση ενός μηνύματος** (§28 Η-Β9) — γράφεται **μόνο** στο μήνυμα που τη γέννησε: αν στο μεταξύ στάλθηκε νέο
 * (άλλο `invitationId`), η παλιά αναφορά **δεν** σκεπάζει τη νέα ⇒ `null`. Τηλεμετρία, όχι στάδιο: δεν περνά από τον μειωτή.
 */
export function withIssuanceDelivery(record: IssuanceAssignmentRecord, invitationId: string, delivery: IssuanceDelivery): IssuanceAssignmentRecord | null {
  if (record.approvalRequest?.invitationId === invitationId) return { ...record, approvalRequest: { ...record.approvalRequest, delivery } };
  if (record.notice?.invitationId === invitationId) return { ...record, notice: { ...record.notice, delivery } };
  return null;
}

/** Ποιο ακροατήριο έχει **σήμερα** τον λόγο με αυτόν τον σύνδεσμο — `null` = κανένα (παλιός, αντικατεστημένος). */
export function currentLinkAudience(record: IssuanceAssignmentRecord, invitationId: string): 'owner' | 'professional' | null {
  if (record.approvalRequest?.invitationId === invitationId) return 'owner';
  if (record.notice?.invitationId === invitationId) return 'professional';
  return null;
}

/** Μπορεί αυτό το προσόν να υπογράψει αυτό το είδος; — any-of του εκδότη (ο μηχανολόγος **δεν** υπογράφει ταυτότητα). */
export function qualifiesFor(kind: DocumentKind, qualification: IssuerQualification): boolean {
  const { issuer } = documentKindSpec(kind);
  return issuer.kind === 'professional' && issuer.qualifications.includes(qualification);
}

/**
 * **Η μία κρίση** κάθε πράξης: νόμιμη μετάβαση ⇒ νέα γεγονότα· ίδια πρόταση ⇒ `changed: false` (ιδεμποτές).
 * `latestIssuedOn` = το νεότερο έγγραφο του είδους στο ακίνητο (ολοκληρωμένη ανάθεση ≡ καμία).
 */
export function reduceIssuance(
  kind: DocumentKind,
  current: IssuanceAssignmentRecord | null,
  latestIssuedOn: string | null,
  action: IssuanceAction,
  actor: IssuanceActor,
): IssuanceReduction {
  const state = issuanceStateOf(current, latestIssuedOn);
  if (action.kind === 'propose') {
    if (actor.kind !== 'office') return { ok: false, refusal: 'actor-refused' };
    if (!qualifiesFor(kind, action.credential.qualification)) return { ok: false, refusal: 'unqualified' };
    if (sameProposal(state, action) && current !== null) return { ok: true, record: current, changed: false };
    if (!canProposeIssuance(state)) return { ok: false, refusal: 'transition-refused' };
    return { ok: true, record: proposed(action, actor.uid, actor.nowIso), changed: true };
  }
  // «Ποιος» πριν από «από πού»: ο σύνδεσμος δεν κάνει πράξη του γραφείου, σε **κανένα** στάδιο.
  if (actor.kind === 'link' && !LINK_ACTIONS.has(action.kind)) return { ok: false, refusal: 'actor-refused' };
  if (state.kind !== 'open' || !ALLOWED_FROM[action.kind].includes(state.stage)) {
    return { ok: false, refusal: 'transition-refused' };
  }
  return advanced(state.record, state.stage, action, actor);
}

/** Η ΜΙΑ ταυτότητα γραμμής ανάθεσης (ακίνητο, είδος) — κλειδί της απόκρισης και της αισιόδοξης εμφάνισης. */
export function issuanceKeyOf(propertyId: string, kind: DocumentKind): string {
  return `${propertyId}:${kind}`;
}
