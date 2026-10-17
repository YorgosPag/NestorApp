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

export interface IssuanceDecision {
  readonly outcome: 'approved' | 'rejected';
  /** Ο υπεύθυνος ιδιοκτήτης (§26) **τη στιγμή της απόφασης** — παράγεται στον διακομιστή, ποτέ από τον πελάτη. */
  readonly ownerContactId: string;
  readonly basis: 'recorded-instruction';
  readonly channel: InstructionChannel;
  readonly note: string | null;
  readonly recordedByUid: string;
  readonly at: string;
}

/** Τα γεγονότα μιας ανάθεσης — ό,τι αποθηκεύεται πέρα από την ταυτότητα. */
export interface IssuanceAssignmentRecord {
  readonly professionalContactId: string;
  readonly credential: IssuanceCredential;
  readonly proposedAt: string;
  readonly proposedByUid: string;
  readonly decision: IssuanceDecision | null;
  readonly notice: { readonly channel: NoticeChannel; readonly at: string; readonly byUid: string } | null;
  readonly response: { readonly outcome: 'accepted' | 'declined'; readonly at: string; readonly recordedByUid: string } | null;
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
  | {
      readonly kind: 'decide';
      readonly outcome: 'approved' | 'rejected';
      readonly channel: InstructionChannel;
      readonly note: string | null;
      /** Ο υπεύθυνος — από τον κριτή του διακομιστή (ή, αισιόδοξα, ό,τι είδε η οθόνη). */
      readonly ownerContactId: string;
    }
  | { readonly kind: 'notify'; readonly channel: NoticeChannel }
  | { readonly kind: 'respond'; readonly outcome: 'accepted' | 'declined' }
  | { readonly kind: 'cancel' };

export type IssuanceActionKind = IssuanceAction['kind'];

/** Από ποια στάδια επιτρέπεται κάθε πράξη (η πρόταση κρίνεται χωριστά, {@link canProposeIssuance}). */
const ALLOWED_FROM: Readonly<Record<Exclude<IssuanceActionKind, 'propose'>, readonly IssuanceStage[]>> = {
  decide: ['proposed'],
  notify: ['ownerApproved'],
  respond: ['sent'],
  cancel: ['proposed', 'ownerApproved', 'sent', 'accepted', 'declined'],
};

export interface IssuanceActor {
  readonly uid: string;
  readonly nowIso: string;
}

export type IssuanceReduction =
  | { readonly ok: true; readonly record: IssuanceAssignmentRecord; readonly changed: boolean }
  | { readonly ok: false; readonly refusal: 'transition-refused' | 'unqualified' };

function proposed(action: Extract<IssuanceAction, { kind: 'propose' }>, actor: IssuanceActor): IssuanceAssignmentRecord {
  return {
    professionalContactId: action.professionalContactId,
    credential: action.credential,
    proposedAt: actor.nowIso,
    proposedByUid: actor.uid,
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

function advanced(record: IssuanceAssignmentRecord, action: Exclude<IssuanceAction, { kind: 'propose' }>, actor: IssuanceActor): IssuanceAssignmentRecord {
  switch (action.kind) {
    case 'decide': return {
      ...record,
      decision: {
        outcome: action.outcome, ownerContactId: action.ownerContactId, basis: 'recorded-instruction',
        channel: action.channel, note: action.note, recordedByUid: actor.uid, at: actor.nowIso,
      },
    };
    case 'notify': return { ...record, notice: { channel: action.channel, at: actor.nowIso, byUid: actor.uid } };
    case 'respond': return { ...record, response: { outcome: action.outcome, at: actor.nowIso, recordedByUid: actor.uid } };
    case 'cancel': return { ...record, cancellation: { at: actor.nowIso, byUid: actor.uid } };
  }
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
    if (!qualifiesFor(kind, action.credential.qualification)) return { ok: false, refusal: 'unqualified' };
    if (sameProposal(state, action) && current !== null) return { ok: true, record: current, changed: false };
    if (!canProposeIssuance(state)) return { ok: false, refusal: 'transition-refused' };
    return { ok: true, record: proposed(action, actor), changed: true };
  }
  if (state.kind !== 'open' || !ALLOWED_FROM[action.kind].includes(state.stage)) {
    return { ok: false, refusal: 'transition-refused' };
  }
  return { ok: true, record: advanced(state.record, action, actor), changed: true };
}

// ---------------------------------------------------------------------------
// Οι υποψήφιοι — «Ανάθεση σε γνωστό»
// ---------------------------------------------------------------------------

/** Μία ανάθεση του γραφείου στο παρελθόν ή τώρα — ό,τι χρειάζεται η κατάταξη. */
export interface IssuanceRosterEntry {
  readonly propertyId: string;
  readonly documentKind: DocumentKind;
  readonly record: IssuanceAssignmentRecord;
}

export type CandidateReason =
  | { readonly kind: 'same-property'; readonly documentKind: DocumentKind }
  | { readonly kind: 'previously-assigned'; readonly count: number; readonly lastAt: string };

export interface IssuanceCandidate {
  readonly contactId: string;
  readonly reasons: readonly CandidateReason[];
  /** Το προσόν που **ήδη** δήλωσε το γραφείο και επαρκεί για αυτό το είδος — `null` ⇒ θέλει δήλωση. */
  readonly credential: IssuanceCredential | null;
}

/** Πόσοι υποψήφιοι φτάνουν στην οθόνη — οι υπόλοιποι βρίσκονται με την αναζήτηση επαφής. */
export const ISSUANCE_CANDIDATES_SHOWN = 5;

/** Μόνο όσα ο ιδιοκτήτης **ενέκρινε** μετρούν ως «ξανά» — μια απορριφθείσα πρόταση δεν είναι εμπειρία. */
function wasApproved(record: IssuanceAssignmentRecord): boolean {
  return record.decision?.outcome === 'approved';
}

interface CandidateTally {
  sameProperty: DocumentKind | null;
  count: number;
  lastAt: string;
  credential: IssuanceCredential | null;
}

function tallyOf(entries: readonly IssuanceRosterEntry[], kind: DocumentKind, propertyId: string): Map<string, CandidateTally> {
  const tally = new Map<string, CandidateTally>();
  for (const { record, documentKind, propertyId: entryProperty } of entries) {
    const id = record.professionalContactId;
    const fits = qualifiesFor(kind, record.credential.qualification) ? record.credential : null;
    const entry = tally.get(id) ?? { sameProperty: null, count: 0, lastAt: '', credential: null };
    if (entryProperty === propertyId && documentKind !== kind) entry.sameProperty = documentKind;
    if (documentKind === kind) {
      entry.count += 1;
      if (record.proposedAt > entry.lastAt) entry.lastAt = record.proposedAt;
    }
    entry.credential = entry.credential ?? fits;
    tally.set(id, entry);
  }
  return tally;
}

function reasonsOf(entry: CandidateTally): CandidateReason[] {
  const reasons: CandidateReason[] = [];
  if (entry.sameProperty !== null) reasons.push({ kind: 'same-property', documentKind: entry.sameProperty });
  if (entry.count > 0) reasons.push({ kind: 'previously-assigned', count: entry.count, lastAt: entry.lastAt });
  return reasons;
}

/**
 * **Ποιους ξέρει ήδη το γραφείο** για αυτό το έγγραφο, με τη σειρά που θα τους πρότεινε ένας έμπειρος συνεργάτης:
 * 1. όποιος βγάζει το **άλλο** έγγραφο του **ίδιου** ακινήτου (ένας μηχανικός για ΠΕΑ + ταυτότητα — §18.5)·
 * 2. όσοι έχουν ξαναπάρει **αυτό** το είδος με έγκριση ιδιοκτήτη (περισσότερες φορές, πιο πρόσφατα)·
 * και λέει **γιατί** τον καθένα. Εξαιρείται όποιος μόλις αρνήθηκε **αυτή** την ανάθεση.
 */
export function rankIssuanceCandidates(
  roster: readonly IssuanceRosterEntry[],
  target: { readonly kind: DocumentKind; readonly propertyId: string; readonly excludeContactId: string | null },
): readonly IssuanceCandidate[] {
  const approved = roster.filter((entry) => wasApproved(entry.record));
  const tally = tallyOf(approved, target.kind, target.propertyId);
  return [...tally]
    .filter(([id, entry]) => id !== target.excludeContactId && (entry.sameProperty !== null || entry.count > 0))
    .sort(([, a], [, b]) => Number(b.sameProperty !== null) - Number(a.sameProperty !== null)
      || b.count - a.count
      || b.lastAt.localeCompare(a.lastAt))
    .slice(0, ISSUANCE_CANDIDATES_SHOWN)
    .map(([contactId, entry]) => ({ contactId, reasons: reasonsOf(entry), credential: entry.credential }));
}

/** Η ΜΙΑ ταυτότητα γραμμής ανάθεσης (ακίνητο, είδος) — κλειδί της απόκρισης και της αισιόδοξης εμφάνισης. */
export function issuanceKeyOf(propertyId: string, kind: DocumentKind): string {
  return `${propertyId}:${kind}`;
}
