/**
 * =============================================================================
 * Μητρώο λήξεων — Η ΑΝΑΘΕΣΗ ΕΚΔΟΣΗΣ σε επαγγελματία (ADR-915 §27 · §42)
 * =============================================================================
 *
 * **«Ποιος βγάζει το νέο ΠΕΑ, με ποια τιμή, ποιος το αποφάσισε, και σε ποιον είναι η μπάλα;»** Ένα αντικείμενο ανά
 * (ακίνητο, είδος): το γραφείο **ΠΡΟΤΕΙΝΕΙ** και ζητά προσφορά, ο επαγγελματίας **ΠΡΟΣΦΕΡΕΙ**, ο ιδιοκτήτης
 * **ΑΠΟΦΑΣΙΖΕΙ** για πρόσωπο **και** τιμή μαζί, η εφαρμογή **ΚΑΤΑΓΡΑΦΕΙ** — γιατί ο νόμος απευθύνεται στον ιδιοκτήτη
 * (ν.4122/2013 άρθρο 12 §2 · ΗΤΚ: «ο μηχανικός ορίζεται από τους κυρίους») και η εντολή μεσιτείας είναι μεσολάβηση,
 * όχι αντιπροσώπευση (ν.4072/2012 άρθρα 200-201).
 *
 * Τα στάδια και η μπάλα: `./issuance-stage.ts`. Η προσφορά και το παραστατικό: `./issuance-quote.ts`. Ποιος πράττει
 * και με ποια βάση (actor · σύνδεσμος · §29): `./issuance-actor.ts`.
 *
 * 🔑 **Το στάδιο ΠΑΡΑΓΕΤΑΙ από τα γεγονότα** (`decision` · `notice` · `response` · `quote` · `cancellation`), δεν
 *    αποθηκεύεται δίπλα τους: δύο πεδία που λένε το ίδιο θα μπορούσαν να διαφωνήσουν.
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

import {
  PLATFORM_NOTICE_CHANNEL, actorMayAct, decisionBasisOf, platformNoticeOf, quoteSubmissionOf, responseBasisOf,
  type InstructionChannel, type IssuanceActor, type IssuanceDecisionBasis, type IssuanceResponseBasis, type LinkVerification,
} from './issuance-actor';
import { advanceCollectedMinor, advanceStateOf, isAdvanceTermsValid, type AdvanceEvent } from './issuance-advance';
import { isIssuanceAdvanceAction, reduceIssuanceAdvance, type IssuanceAdvanceAction } from './issuance-advance-reducer';
import { hasLiveAdvanceMoney } from './issuance-advance-settlement';
import type { IssuanceDelivery } from './issuance-delivery';
import {
  declinedDeliveryChange, requestedDeliveryChange, withDeliveryChangeAccepted,
  type DeliveryChangeRequest, type IssuanceDeclineDeliveryChangeAction, type IssuanceRequestDeliveryChangeAction,
} from './issuance-delivery-change';
import {
  scheduledDelivery,
  type IssuanceDeliveryScheduleEntry,
  type IssuanceScheduleDeliveryAction,
} from './issuance-delivery-due';
import {
  areQuoteTermsValid, canReviseQuote, nextQuoteOf, quoteTotalsOf, receiptMatchesQuote,
  type IssuanceQuote, type IssuanceReceipt, type QuoteTerms,
} from './issuance-quote';
import type { IssuanceDeliveryReminders } from './issuance-delivery-reminder';
import type { IssuanceOwnerAttestation } from './issuance-owner-attestation';
import { INSPECTION_CONTACT_STAGES, inspectionContactSet, type IssuanceInspectionContactEntry, type IssuanceSetInspectionContactAction } from './issuance-inspection-contact';
import { sameProfessional, type IssuanceProfessional } from './issuance-professional';
import type { IssuanceReminders } from './issuance-reminder';
import { ballInCourtOf, isLegacyIssuance, issuanceStageOf, type BallInCourtParty, type IssuanceCancellationReason, type IssuanceStage } from './issuance-stage';

export {
  BALL_IN_COURT_PARTIES, ISSUANCE_CANCELLATION_REASONS, ISSUANCE_STAGES, ballInCourtOf, issuanceStageOf,
  type BallInCourtParty, type IssuanceCancellationReason, type IssuanceStage,
} from './issuance-stage';
export {
  INSTRUCTION_CHANNELS, LINK_VERIFICATIONS, PLATFORM_NOTICE_CHANNEL, decisionOwnerContactIdOf, linkVerificationSatisfies,
  type InstructionChannel, type IssuanceActor, type IssuanceDecisionBasis, type IssuanceResponseBasis, type LinkVerification,
} from './issuance-actor';

/** Πώς ενημερώθηκε ο επαγγελματίας — ό,τι **καταγράφει** άνθρωπος του γραφείου (το μενού του). */
export const NOTICE_CHANNELS = ['phone', 'email', 'in-person'] as const;
export type RecordableNoticeChannel = (typeof NOTICE_CHANNELS)[number];
/** ADR-945 Φ3α — ό,τι **αποθηκεύεται**: και το κανάλι της πλατφόρμας, που το γράφει μόνο ο μειωτής (ποτέ στο μενού). */
export const STORED_NOTICE_CHANNELS = [...NOTICE_CHANNELS, PLATFORM_NOTICE_CHANNEL] as const;
export type NoticeChannel = (typeof STORED_NOTICE_CHANNELS)[number];

/** Το μέγιστο μήκος σημείωσης απόφασης / αριθμού μητρώου — αμυντικά, όχι πολιτική. */
export const ISSUANCE_NOTE_MAX = 500;
export const REGISTRY_NUMBER_MAX = 40;

/** Το δηλωμένο προσόν του επαγγελματία για **αυτό** το έγγραφο — δηλωμένο, όχι επαληθευμένο (το λέει η οθόνη). */
export interface IssuanceCredential {
  readonly qualification: IssuerQualification;
  readonly registryNumber: string | null;
}

/** Η απόφαση — η βάση της (§28 Η-Β2) παράγεται από τον actor (`./issuance-actor.ts`). */
export type IssuanceDecision = IssuanceDecisionBasis & {
  readonly outcome: 'approved' | 'rejected';
  /**
   * §42 — **ποια** αναθεώρηση της προσφοράς κρίθηκε. Νέα αναθεώρηση ⇒ η απόφαση δεν την καλύπτει ⇒ ξανά `quoted`.
   * `null` = παλιά ανάθεση (§27), όπου κρινόταν το πρόσωπο πριν από κάθε τιμή.
   */
  readonly quoteRevision: number | null;
  /** §45.15 — τι βεβαίωσε ο ιδιοκτήτης για τους ιδιοκτήτες (στιγμιότυπο, κριμένο στον διακομιστή)· μόνο σύνδεσμος που εγκρίνει. */
  readonly ownerAttestation: IssuanceOwnerAttestation | null;
  readonly note: string | null;
  readonly at: string;
};

/** Η απάντηση του επαγγελματία — η βάση της παράγεται από τον actor (`./issuance-actor.ts`). */
export type IssuanceResponse = IssuanceResponseBasis & {
  readonly outcome: 'accepted' | 'declined';
  readonly note: string | null;
  readonly at: string;
};

/** Το αίτημα έγκρισης με σύνδεσμο προς τον υπεύθυνο (§28 Η-Β1) — **μόνο αυτό** το `invitationId` αποφασίζει. */
export interface IssuanceApprovalRequest {
  readonly invitationId: string;
  readonly ownerContactId: string;
  readonly note: string | null;
  readonly at: string;
  readonly byUid: string;
  /** Τι ζητά ο σύνδεσμος για να αποφασίσει (§29) — ο μειωτής αρνείται απόφαση που δεν το απέδειξε. */
  readonly verification: LinkVerification;
  /** `null` = το email δεν έχει ακόμη κριθεί (ή η αναφορά του χάθηκε). */
  readonly delivery: IssuanceDelivery | null;
  /** §31 — οι υπενθυμίσεις του μηνύματος· `null` = καμία (δεν ζητήθηκαν, ή το μήνυμα δεν έφυγε). */
  readonly reminders: IssuanceReminders | null;
}

export interface IssuanceNotice {
  readonly channel: NoticeChannel;
  readonly at: string;
  readonly byUid: string;
  /** Το μήνυμα με σύνδεσμο (§28) — `null` = ενημέρωση εκτός εφαρμογής, που απλώς καταγράφηκε. */
  readonly invitationId: string | null;
  /** Τι ζητά ο σύνδεσμος (§29) — `null` ⇔ δεν υπάρχει σύνδεσμος. */
  readonly verification: LinkVerification | null;
  readonly note: string | null;
  readonly delivery: IssuanceDelivery | null;
  /** §31 — οι υπενθυμίσεις· `null` = καμία (ενημέρωση εκτός εφαρμογής · δεν ζητήθηκαν · το μήνυμα δεν έφυγε). */
  readonly reminders: IssuanceReminders | null;
}

/** Τα γεγονότα μιας ανάθεσης — ό,τι αποθηκεύεται πέρα από την ταυτότητα. */
export interface IssuanceAssignmentRecord {
  /** ADR-945 Δ4 — επαφή του βιβλίου ή βιτρίνα του `/pro` (`./issuance-professional.ts`). */
  readonly professional: IssuanceProfessional;
  readonly credential: IssuanceCredential;
  readonly proposedAt: string;
  readonly proposedByUid: string;
  readonly approvalRequest: IssuanceApprovalRequest | null;
  readonly decision: IssuanceDecision | null;
  readonly notice: IssuanceNotice | null;
  readonly response: IssuanceResponse | null;
  /** §42 — η προσφορά του επαγγελματία (με την αρχική της, αν αναθεωρήθηκε). */
  readonly quote: IssuanceQuote | null;
  /** §42 — το παραστατικό της εγκεκριμένης τιμής (ΜΑΡΚ), προαιρετικό. */
  readonly receipt: IssuanceReceipt | null;
  /**
   * §45 Φ2 — οι καταχωρίσεις προθεσμίας του γραφείου (πρώτη ή αλλαγή), με τη σειρά τους. Η **τρέχουσα** προθεσμία
   * παράγεται (`issuanceDeliveryOf`): η νεότερη δέσμευση, προσφορά ή καταχώριση. Κενό = καμία καταχώριση.
   */
  readonly deliverySchedule: readonly IssuanceDeliveryScheduleEntry[];
  /**
   * §45 Φ3 — οι υπενθυμίσεις παράδοσης (αυτόματο πρόγραμμα της τρέχουσας προθεσμίας + χειροκίνητες του γραφείου).
   * Τηλεμετρία, όπως οι `reminders` των μηνυμάτων: ο μειωτής **δεν** την κρίνει. `null` = καμία.
   */
  readonly deliveryReminders: IssuanceDeliveryReminders | null;
  /** §45.15 — οι ορισμοί υπευθύνου αυτοψίας από το γραφείο, με τη σειρά τους· ο τρέχων = ο νεότερος. Κενό = κανείς. */
  readonly inspectionContacts: readonly IssuanceInspectionContactEntry[];
  /** §45.20 Φ6γ — τα αιτήματα αλλαγής προθεσμίας του μηχανικού, με τη σειρά τους· εκκρεμές = το τελευταίο χωρίς απάντηση. */
  readonly deliveryChangeRequests: readonly DeliveryChangeRequest[];
  /** ADR-943 — τα γεγονότα της προκαταβολής, με τη σειρά τους· η κατάσταση παράγεται (`advanceStateOf`). Κενό = καμία κίνηση. */
  readonly advanceEvents: readonly AdvanceEvent[];
  /** ADR-943 Κ-7 — ο ΜΑΡΚ του παραστατικού προκαταβολής, ίσος με ό,τι εισπράχθηκε. */
  readonly advanceReceipt: IssuanceReceipt | null;
  /** ADR-945 §7.2 — `reason`: ακύρωση ή «δεν επιλέχθηκε» (άλλη προσφορά του ίδιου αιτήματος κέρδισε). */
  readonly cancellation: { readonly at: string; readonly byUid: string; readonly reason: IssuanceCancellationReason } | null;
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

/**
 * Η ανάθεση είναι ακόμη **ελεύθερη** για νέα πρόταση: τίποτα δεν δεσμεύτηκε προς τον επαγγελματία. ADR-943 Φ5γ — και
 * **κανένα χρήμα δεν ζει** στην προηγούμενη (ακυρωμένη) ανάθεση: η πρόταση γράφει πάνω στο ίδιο έγγραφο και θα έσβηνε το
 * ίχνος τους (`hasLiveAdvanceMoney`).
 */
export function canProposeIssuance(state: IssuanceState): boolean {
  if (state.kind === 'none') return state.last === null || !hasLiveAdvanceMoney(state.last);
  return state.stage === 'proposed' || state.stage === 'declined';
}

// ---------------------------------------------------------------------------
// Ο μειωτής
// ---------------------------------------------------------------------------

export type IssuanceAction =
  | { readonly kind: 'propose'; readonly professional: IssuanceProfessional; readonly credential: IssuanceCredential }
  /** §28 — στάλθηκε σύνδεσμος έγκρισης στον υπεύθυνο. Ίδιο στάδιο· νέο αίτημα ⇒ ο προηγούμενος σύνδεσμος πεθαίνει. */
  | { readonly kind: 'request-approval'; readonly invitationId: string; readonly ownerContactId: string; readonly note: string | null; readonly verification: LinkVerification }
  | {
      readonly kind: 'decide';
      readonly outcome: 'approved' | 'rejected';
      /** Το κανάλι της **καταγραφής** του γραφείου· `null` ⇔ αποφασίζει ο ίδιος με σύνδεσμο. */
      readonly channel: InstructionChannel | null;
      readonly note: string | null;
      /** Ο υπεύθυνος — από τον κριτή του διακομιστή (ή, αισιόδοξα, ό,τι είδε η οθόνη)· `null` ⇔ αποφασίζει ο ιδιώτης (ADR-945 Δ3). */
      readonly ownerContactId: string | null;
      /** §42 — η αναθεώρηση που **είδε** όποιος αποφασίζει· άλλη τρέχουσα ⇒ `terms-refused` (ποτέ «ναι» σε τιμή που δεν είδε). */
      readonly quoteRevision: number;
      readonly ownerAttestation: IssuanceOwnerAttestation | null;
    }
  /** `invitationId` ≠ `null` ⇔ στάλθηκε μήνυμα με σύνδεσμο (επιτρέπεται και ξανά, από `sent`). */
  | { readonly kind: 'notify'; readonly channel: RecordableNoticeChannel; readonly invitationId: string | null; readonly note: string | null; readonly verification: LinkVerification | null }
  /** `accepted` μόνο σε παλιά ανάθεση (§27)· στη ροή §42 «δεν δίνω προσφορά» ή «αποσύρομαι» = `declined`. */
  | { readonly kind: 'respond'; readonly outcome: 'accepted' | 'declined'; readonly note: string | null }
  /**
   * §42 — προσφορά (από `sent`) ή η μία αναθεώρηση μετά την αυτοψία (από `accepted`). ADR-945 Φ3α — `signerUid`: το μέλος
   * που υπογράφει· **μόνο** όταν προσφέρει μέλος γραφείου βιτρίνας (αλλιώς απόν).
   */
  | { readonly kind: 'quote'; readonly terms: QuoteTerms; readonly signerUid?: string }
  /** §42 — το παραστατικό της εγκεκριμένης τιμής· μόνο το γραφείο, μόνο ίδιο σύνολο. */
  | { readonly kind: 'record-receipt'; readonly mark: string; readonly issuedOn: string; readonly totalMinor: number }
  /** §45 Φ2 — ορισμός ή αλλαγή (με αιτιολογία) της προθεσμίας παράδοσης· μόνο το γραφείο, μόνο μετά την ανάθεση. */
  | IssuanceScheduleDeliveryAction
  /** §45.15 — ορισμός ή αλλαγή του υπευθύνου αυτοψίας· μόνο το γραφείο, σε κάθε στάδιο πριν την παράδοση. */
  | IssuanceSetInspectionContactAction
  /** §45.20 Φ6γ — ο μηχανικός ζητά νέα ημερομηνία (μόνο actor `engagement`) · το γραφείο απορρίπτει με αιτιολογία. */
  | IssuanceRequestDeliveryChangeAction
  | IssuanceDeclineDeliveryChangeAction
  /** ADR-943 — οι πράξεις της προκαταβολής· κρίνονται από τον δικό τους μειωτή (`./issuance-advance-reducer.ts`). */
  | IssuanceAdvanceAction
  /** ADR-945 §7.2 — `not-awarded` μόνο από την ανάθεση στη νικήτρια του αιτήματος (το κρίνει ο διακομιστής). */
  | { readonly kind: 'cancel'; readonly reason: IssuanceCancellationReason };

export type IssuanceActionKind = IssuanceAction['kind'];

/** Από ποια στάδια επιτρέπεται κάθε πράξη (η πρόταση και η προκαταβολή κρίνονται χωριστά). */
const ALLOWED_FROM: Readonly<Record<Exclude<IssuanceActionKind, 'propose' | IssuanceAdvanceAction['kind']>, readonly IssuanceStage[]>> = {
  'request-approval': ['quoted'],
  decide: ['quoted'],
  // `ownerApproved` = παλιά ανάθεση που περιμένει ενημέρωση· `proposed` = αίτημα προσφοράς (§42).
  notify: ['proposed', 'ownerApproved', 'sent'],
  respond: ['sent', 'quoted', 'accepted'],
  quote: ['sent', 'accepted'],
  'record-receipt': ['accepted'],
  'schedule-delivery': ['accepted'],
  'request-delivery-change': ['accepted'],
  'decline-delivery-change': ['accepted'],
  'set-inspection-contact': INSPECTION_CONTACT_STAGES,
  cancel: ['proposed', 'ownerApproved', 'sent', 'quoted', 'accepted', 'declined'],
};

/**
 * - `transition-refused` — η πράξη δεν επιτρέπεται από αυτό το στάδιο·
 * - `unqualified` — το προσόν δεν υπογράφει αυτό το είδος·
 * - `actor-refused` — **αυτός** ο actor δεν κάνει αυτή την πράξη: γραφείο χωρίς κανάλι καταγραφής, σύνδεσμος για πράξη
 *   του γραφείου, ή σύνδεσμος που **δεν** είναι του τρέχοντος αιτήματος (παλιός, αντικατεστημένος, άλλου ακροατηρίου)·
 * - `terms-refused` — §42: άκυροι όροι προσφοράς, αναθεώρηση που δεν επιτρέπεται, ή απόφαση για αναθεώρηση που
 *   **δεν** είναι πια η τρέχουσα·
 * - `receipt-mismatch` — §42: το παραστατικό δεν ταιριάζει με την εγκεκριμένη τιμή (ή άκυρος ΜΑΡΚ).
 */
export type IssuanceRefusalReason = 'transition-refused' | 'unqualified' | 'actor-refused' | 'terms-refused' | 'receipt-mismatch';

export type IssuanceReduction =
  | { readonly ok: true; readonly record: IssuanceAssignmentRecord; readonly changed: boolean }
  | { readonly ok: false; readonly refusal: IssuanceRefusalReason };

/** Νέα πρόταση· ο υπεύθυνος αυτοψίας του ίδιου ανοιχτού κύκλου μένει (γεγονός του ακινήτου, όχι του επαγγελματία). */
function proposed(action: Extract<IssuanceAction, { kind: 'propose' }>, actor: Extract<IssuanceActor, { kind: 'owner' | 'office' }>, inspectionContacts: readonly IssuanceInspectionContactEntry[]): IssuanceAssignmentRecord {
  const { uid, nowIso } = actor;
  return {
    professional: action.professional,
    credential: action.credential,
    proposedAt: nowIso,
    proposedByUid: uid,
    approvalRequest: null,
    decision: null,
    notice: platformNoticeOf(actor),
    response: null,
    quote: null,
    receipt: null,
    deliverySchedule: [],
    deliveryReminders: null,
    inspectionContacts,
    deliveryChangeRequests: [],
    advanceEvents: [],
    advanceReceipt: null,
    cancellation: null,
  };
}

function sameProposal(state: IssuanceState, action: Extract<IssuanceAction, { kind: 'propose' }>): boolean {
  // ADR-945 Φ3α — η πρόταση του ιδιώτη φτάνει ήδη στο `sent` (μήνυμα της πλατφόρμας)· η ίδια πρόσκληση ξανά = ιδεμποτής.
  const unsent = state.kind === 'open'
    && (state.stage === 'proposed' || (state.stage === 'sent' && state.record.notice?.channel === PLATFORM_NOTICE_CHANNEL));
  if (!unsent) return false;
  const { professional, credential } = state.record;
  return sameProfessional(professional, action.professional)
    && credential.qualification === action.credential.qualification
    && credential.registryNumber === action.credential.registryNumber;
}

type AdvancingAction = Exclude<IssuanceAction, { kind: 'propose' } | IssuanceAdvanceAction>;

/** Οι πράξεις που κάνει **μόνο** το γραφείο — ο έλεγχος actor έγινε ήδη. */
type OfficeOnlyAction = Exclude<AdvancingAction, {
  kind: 'decide' | 'respond' | 'quote' | 'record-receipt' | 'schedule-delivery' | 'set-inspection-contact' | 'request-delivery-change' | 'decline-delivery-change';
}>;

function officeAdvanced(record: IssuanceAssignmentRecord, action: OfficeOnlyAction, uid: string, at: string): IssuanceAssignmentRecord {
  switch (action.kind) {
    case 'request-approval': return {
      ...record,
      approvalRequest: {
        invitationId: action.invitationId, ownerContactId: action.ownerContactId, note: action.note, at, byUid: uid,
        verification: action.verification, delivery: null, reminders: null,
      },
    };
    case 'notify': return {
      ...record,
      notice: {
        channel: action.channel, at, byUid: uid, invitationId: action.invitationId, note: action.note,
        // Χωρίς σύνδεσμο δεν υπάρχει τι να επαληθευτεί — ποτέ «ζητήθηκε κωδικός» για ενημέρωση τηλεφώνου.
        verification: action.invitationId === null ? null : action.verification ?? 'link', delivery: null, reminders: null,
      },
    };
    case 'cancel': return { ...record, cancellation: { at, byUid: uid, reason: action.reason } };
  }
}

/** Αποδεκτοί όροι — §42 και (ADR-943) προκαταβολή όχι πάνω από το σύνολο της **ίδιας** προσφοράς. */
function termsAccepted(terms: QuoteTerms, nowIso: string): boolean {
  return areQuoteTermsValid(terms, conveyanceToday(new Date(nowIso)))
    && (terms.advance === null || isAdvanceTermsValid(terms.advance, quoteTotalsOf(terms).totalMinor));
}

/** §42 — η προσφορά ή η μία αναθεώρηση. Ποτέ σε παλιά ανάθεση, ποτέ μετά το παραστατικό ή την πρώτη κίνηση προκαταβολής. */
function quoted(record: IssuanceAssignmentRecord, stage: IssuanceStage, action: Extract<AdvancingAction, { kind: 'quote' }>, actor: IssuanceActor): IssuanceReduction {
  if (isLegacyIssuance(record) || record.receipt !== null || record.advanceEvents.length > 0) return { ok: false, refusal: 'transition-refused' };
  const revising = stage === 'accepted';
  if (revising && (record.quote === null || !canReviseQuote(record.quote))) return { ok: false, refusal: 'terms-refused' };
  if (!termsAccepted(action.terms, actor.nowIso)) return { ok: false, refusal: 'terms-refused' };
  const submission = quoteSubmissionOf(record, actor, action.signerUid ?? null);
  if (submission === null) return { ok: false, refusal: 'actor-refused' };
  return { ok: true, record: { ...record, quote: nextQuoteOf(record.quote, action.terms, submission, actor.nowIso) }, changed: true };
}

/** Η απάντηση: στη ροή §42 μόνο «όχι» (άρνηση ή απόσυρση)· το «αναλαμβάνω» ζει μόνο σε παλιά ανάθεση, από `sent`. */
function responded(record: IssuanceAssignmentRecord, stage: IssuanceStage, action: Extract<AdvancingAction, { kind: 'respond' }>, actor: IssuanceActor): IssuanceReduction {
  const legacy = isLegacyIssuance(record);
  if (legacy ? stage !== 'sent' : action.outcome === 'accepted') return { ok: false, refusal: 'transition-refused' };
  const basis = responseBasisOf(record, actor);
  if (basis === null) return { ok: false, refusal: 'actor-refused' };
  return { ok: true, record: { ...record, response: { ...basis, outcome: action.outcome, note: action.note, at: actor.nowIso } }, changed: true };
}

/** Η απόφαση για **την αναθεώρηση που είδε** όποιος αποφασίζει (§42). */
function decided(record: IssuanceAssignmentRecord, action: Extract<AdvancingAction, { kind: 'decide' }>, actor: IssuanceActor): IssuanceReduction {
  if (record.quote === null || record.quote.revision !== action.quoteRevision) return { ok: false, refusal: 'terms-refused' };
  const basis = decisionBasisOf(record.approvalRequest, action, actor);
  if (basis === null) return { ok: false, refusal: 'actor-refused' };
  const ownerAttestation = basis.basis === 'owner-link-approval' && action.outcome === 'approved' ? action.ownerAttestation : null;
  const decision: IssuanceDecision = { ...basis, outcome: action.outcome, quoteRevision: action.quoteRevision, ownerAttestation, note: action.note, at: actor.nowIso };
  return { ok: true, record: { ...record, decision }, changed: true };
}

/** §42 — το παραστατικό δένεται **μόνο** με το σύνολο της εγκεκριμένης αναθεώρησης. */
function receipted(record: IssuanceAssignmentRecord, action: Extract<AdvancingAction, { kind: 'record-receipt' }>, uid: string, at: string): IssuanceReduction {
  if (record.quote === null) return { ok: false, refusal: 'transition-refused' };
  if (!receiptMatchesQuote(action, record.quote, advanceCollectedMinor(advanceStateOf(record)))) return { ok: false, refusal: 'receipt-mismatch' };
  const receipt: IssuanceReceipt = { mark: action.mark, issuedOn: action.issuedOn, totalMinor: action.totalMinor, at, recordedByUid: uid };
  return { ok: true, record: { ...record, receipt }, changed: true };
}

/** §45.20 — νέα προθεσμία από το γραφείο **απαντά** στο εκκρεμές αίτημα του μηχανικού (αποδοχή), στην ΙΔΙΑ μείωση. */
function rescheduled(record: IssuanceAssignmentRecord, action: IssuanceScheduleDeliveryAction, uid: string, nowIso: string): IssuanceReduction {
  const reduced = scheduledDelivery(record, action, uid, nowIso);
  return reduced.ok && reduced.changed ? { ...reduced, record: withDeliveryChangeAccepted(reduced.record, uid, nowIso) } : reduced;
}

function advanced(record: IssuanceAssignmentRecord, stage: IssuanceStage, action: AdvancingAction, actor: IssuanceActor): IssuanceReduction {
  if (action.kind === 'decide') return decided(record, action, actor);
  if (action.kind === 'respond') return responded(record, stage, action, actor);
  if (action.kind === 'quote') return quoted(record, stage, action, actor);
  // Ξανά ενημέρωση από `sent` έχει νόημα μόνο ως **νέο μήνυμα** (χαμένο email)· μια δεύτερη «σημείωση τηλεφώνου» όχι.
  if (action.kind === 'notify' && stage === 'sent' && action.invitationId === null) return { ok: false, refusal: 'transition-refused' };
  if (action.kind === 'request-delivery-change') {
    return actor.kind === 'engagement'
      ? requestedDeliveryChange(record, action, actor)
      : { ok: false, refusal: 'actor-refused' };
  }
  // Ο ιδιώτης φτάνει εδώ μόνο για ακύρωση (`OWNER_ACTIONS`).
  if (actor.kind !== 'office' && actor.kind !== 'owner') return { ok: false, refusal: 'actor-refused' };
  if (action.kind === 'record-receipt') return receipted(record, action, actor.uid, actor.nowIso);
  if (action.kind === 'schedule-delivery') return rescheduled(record, action, actor.uid, actor.nowIso);
  if (action.kind === 'decline-delivery-change') return declinedDeliveryChange(record, action, actor.uid, actor.nowIso);
  if (action.kind === 'set-inspection-contact') return inspectionContactSet(record, action, actor.uid, actor.nowIso);
  return { ok: true, record: officeAdvanced(record, action, actor.uid, actor.nowIso), changed: true };
}

/** Το μήνυμα με αυτό το `invitationId` — αίτημα έγκρισης ή μήνυμα στον επαγγελματία· `null` = κανένα τρέχον. */
export function messageOf(record: IssuanceAssignmentRecord, invitationId: string): IssuanceApprovalRequest | IssuanceNotice | null {
  if (record.approvalRequest?.invitationId === invitationId) return record.approvalRequest;
  if (record.notice?.invitationId === invitationId) return record.notice;
  return null;
}

/**
 * **Άλλαξε το μήνυμα με αυτό το `invitationId`** — αίτημα έγκρισης ή μήνυμα στον επαγγελματία. Η τηλεμετρία του μηνύματος
 * (παράδοση §30 · υπενθυμίσεις §31) γράφεται **μόνο** στο μήνυμα που τη γέννησε: αν στο μεταξύ στάλθηκε νέο, ή το `update`
 * αρνηθεί (`null`), δεν γράφεται τίποτα ⇒ `null`.
 */
export function withMessage(
  record: IssuanceAssignmentRecord,
  invitationId: string,
  update: <M extends IssuanceApprovalRequest | IssuanceNotice>(message: M) => M | null,
): IssuanceAssignmentRecord | null {
  if (record.approvalRequest?.invitationId === invitationId) {
    const approvalRequest = update(record.approvalRequest);
    return approvalRequest === null ? null : { ...record, approvalRequest };
  }
  if (record.notice?.invitationId === invitationId) {
    const notice = update(record.notice);
    return notice === null ? null : { ...record, notice };
  }
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
    if (actor.kind !== 'office' && actor.kind !== 'owner') return { ok: false, refusal: 'actor-refused' };
    // ADR-945 Δ4: ο ιδιώτης δεν έχει βιβλίο επαφών — προσκαλεί **μόνο** γραφείο βιτρίνας (το κανάλι του είναι η πλατφόρμα).
    if (actor.kind === 'owner' && action.professional.kind !== 'workspace') return { ok: false, refusal: 'actor-refused' };
    if (!qualifiesFor(kind, action.credential.qualification)) return { ok: false, refusal: 'unqualified' };
    if (sameProposal(state, action) && current !== null) return { ok: true, record: current, changed: false };
    if (!canProposeIssuance(state)) return { ok: false, refusal: 'transition-refused' };
    const carried = state.kind === 'open' ? state.record.inspectionContacts : [];
    return { ok: true, record: proposed(action, actor, carried), changed: true };
  }
  if (isIssuanceAdvanceAction(action)) return reduceIssuanceAdvance(current, action, actor); // ADR-943
  // «Ποιος» πριν από «από πού»: ο σύνδεσμος δεν κάνει πράξη του γραφείου, η συμμετοχή μόνο αίτημα — σε **κανένα** στάδιο.
  if (!actorMayAct(actor, action.kind)) return { ok: false, refusal: 'actor-refused' };
  if (state.kind !== 'open' || !ALLOWED_FROM[action.kind].includes(state.stage)) {
    return { ok: false, refusal: 'transition-refused' };
  }
  return advanced(state.record, state.stage, action, actor);
}

/** Η ΜΙΑ ταυτότητα γραμμής ανάθεσης (ακίνητο, είδος) — κλειδί της απόκρισης και της αισιόδοξης εμφάνισης. */
export function issuanceKeyOf(propertyId: string, kind: DocumentKind): string {
  return `${propertyId}:${kind}`;
}
