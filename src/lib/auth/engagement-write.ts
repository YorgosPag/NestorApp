/**
 * =============================================================================
 * Ο ΕΝΑΣ ΓΡΑΦΕΑΣ ΤΗΣ ΣΥΜΜΕΤΟΧΗΣ (ADR-862 Φ1 · άγκυρα Α2)
 * =============================================================================
 *
 * **Το ερώτημα**: *«άλλαξε την κατάσταση πρόσβασης αυτού του ανθρώπου σε αυτή την υπόθεση — μία φορά»*.
 * **Ο απαντητής**: αυτό το αρχείο. Η πρόταση από τον οικοδεσπότη, η αποδοχή από τον καλεσμένο και (Φ3)
 * η εξαργύρωση πρόσκλησης περνούν **όλες** από εδώ — δεύτερος γραφέας = το σχήμα ADR-853 Μ2.
 *
 * 🔑 **Ιδεμποτησία μέσα στη συναλλαγή** (σχήμα `project-member-write.ts`): η μοναδικότητα της
 *    **ζωντανής** συμμετοχής ανά `(uid, υπόθεση)` και της **θέσης** ανά `(υπόθεση, ρόλος)` κρίνεται
 *    πάνω στις αναγνώσεις της ίδιας συναλλαγής — δύο ταυτόχρονα πατήματα ⇒ **ένα** έγγραφο.
 *
 * ⛔ **Καμία διαγραφή** (ADR-787 Ε-2 §4 · Α5): ανάκληση = κατάσταση + ίχνος. ⛔ **Κανένα claim** (Α6):
 *    τίποτα εδώ δεν αγγίζει το token του καλεσμένου — η πρόσβαση κρίνεται ανά αίτημα.
 *
 * @module lib/auth/engagement-write
 * @see lib/auth/engagement-judge — ο κριτής · config/engagement-policy — η λήξη
 */

import 'server-only';

import type { Firestore, Transaction } from 'firebase-admin/firestore';

import { activeExpiresAt, dossierShareExpiresAt, offerExpiresAt, type DossierShareDays } from '@/config/engagement-policy';
import { activeDossierByInvitation, planDossierChange, type DossierInvitationAcceptance } from './engagement-dossier-plan';
import { normalizeToMillisOrNull } from '@/lib/date-local';
import { generateEngagementId } from '@/services/enterprise-id.service';
import type { WorkspaceRef } from '@/types/workspace-membership';
import { isOwnActingWorkspace } from './acting-workspace';
import { parseEngagement } from './engagement-schema';
import {
  dossierEngagementsCollection,
  engagementDocOf,
  engagementRef,
  engagementsCollectionOf,
  engagementsForSubjectQuery,
  homeOfEngagement,
  type EngagementHome,
} from './engagement-ref';
import {
  LIVE_ENGAGEMENT_STATES,
  SCOPE_OF_SUBJECT,
  TEMPLATE_OF_SUBJECT,
  isDossierEngagement,
  type ConveyanceEngagement,
  type DeclaredCredential,
  type DossierEngagementKey,
  type DossierShareReach,
  type Engagement,
  type EngagementConsent,
  type EngagementKey,
  type EngagementOrigin,
  type EngagementRole,
  type EngagementSubject,
  type IssuanceEngagement,
  type ProjectEngagement,
} from '@/types/engagement';

// =============================================================================
// ΣΗΜΑ ΟΨΕΩΝ (ADR-901 §14.8)
// =============================================================================

/** Οι συμμετοχές του αντικειμένου **μετά** την εγγραφή — και ποιες άλλαξαν. */
export interface EngagementRoster {
  readonly live: readonly Engagement[];
  readonly changed: readonly Engagement[];
}

/**
 * Ο γραφέας ενημερώνει, **μέσα** στη συναλλαγή του, όσους βλέπουν το αντικείμενο (transactional outbox). Το δίνει ο
 * **κάτοχος** του αντικειμένου (π.χ. η υπόθεση μεταβίβασης) — εδώ μένει γενικό, χωρίς εξάρτηση από τον τομέα.
 * 🔑 **Υποχρεωτική παράμετρος**, όχι προαιρετική: ένας καλών που «ξεχνά» το σήμα **δεν μεταγλωττίζεται** — η όψη του
 *    κατόχου δεν μένει ποτέ σιωπηλά μπαγιάτικη μετά από αλλαγή συμμετοχής.
 */
export type EngagementRosterSignal = (tx: Transaction, roster: EngagementRoster) => void;

/** Η λίστα ζωντανών μετά την αντικατάσταση/προσθήκη μιας συμμετοχής. */
function withWritten(live: readonly Engagement[], written: Engagement): readonly Engagement[] {
  const rest = live.filter((e) => e.id !== written.id);
  return LIVE_ENGAGEMENT_STATES.includes(written.state) ? [...rest, written] : rest;
}

// =============================================================================
// ΠΡΟΤΑΣΗ
// =============================================================================

/**
 * Το ζεύγος **υπόθεση ↔ ρόλος** — πάνε **μαζί** (ADR-862 §5.3.10): ένας καλών δεν μπορεί καν να ζητήσει
 * «συμβολαιογράφο σε ανάθεση ΠΕΑ».
 */
type ConveyanceSubjectRole = Pick<ConveyanceEngagement, 'subject' | 'role'>;
type IssuanceSubjectRole = Pick<IssuanceEngagement, 'subject' | 'role'>;
type EngagementSubjectRole = ConveyanceSubjectRole | IssuanceSubjectRole;

function isConveyanceSubjectRole(pair: EngagementSubjectRole): pair is ConveyanceSubjectRole {
  return pair.subject.kind === 'conveyance_case';
}

/** Αντιγράφει **μόνο** το ζεύγος — ποτέ ολόκληρο το αίτημα στο έγγραφο (θα έγραφε `nowMs` στον δίσκο). */
function subjectRoleOf(pair: EngagementSubjectRole): EngagementSubjectRole {
  return isConveyanceSubjectRole(pair)
    ? { subject: pair.subject, role: pair.role }
    : { subject: pair.subject, role: pair.role };
}

/**
 * ⚠️ **Χωρίς `template` και χωρίς `scopes`**: τα **παράγει** ο γραφέας από το είδος της υπόθεσης
 * (`TEMPLATE_OF_SUBJECT` · `SCOPE_OF_SUBJECT`) — ο καλών δεν μπορεί να δώσει νομικό πρότυπο σε ανάθεση έκδοσης.
 */
export type EngagementOfferRequest = EngagementSubjectRole & {
  readonly hostCompanyId: string;
  readonly projectId: string;
  readonly uid: string;
  readonly email: string;
  readonly origin: EngagementOrigin;
  readonly consents: readonly EngagementConsent[];
  readonly offeredBy: string;
  readonly nowMs: number;
};

export type EngagementOfferOutcome =
  | { readonly outcome: 'offered'; readonly engagement: Engagement }
  /** Ιδεμποτησία: ίδιος άνθρωπος, ίδια θέση, ήδη ζωντανή — καμία εγγραφή. */
  | { readonly outcome: 'already-live'; readonly engagement: Engagement }
  /** Η θέση έχει **άλλον** ζωντανό επαγγελματία — πρώτα ανάκληση (ADR-901 §5.2: αντικατάσταση, όχι δύο). */
  | { readonly outcome: 'slot-occupied'; readonly engagement: Engagement }
  /** Ο ίδιος άνθρωπος έχει ήδη **άλλη** θέση στην υπόθεση (π.χ. δικηγόρος ΚΑΙ συμβολαιογράφος). */
  | { readonly outcome: 'role-conflict'; readonly engagement: Engagement }
  | { readonly outcome: 'unreadable' };

function newEngagement(request: EngagementOfferRequest): ProjectEngagement {
  const now = new Date(request.nowMs).toISOString();
  const kind = request.subject.kind;
  return {
    ...subjectRoleOf(request),
    id: generateEngagementId(),
    hostCompanyId: request.hostCompanyId,
    projectId: request.projectId,
    uid: request.uid,
    email: request.email,
    template: TEMPLATE_OF_SUBJECT[kind],
    scopes: [SCOPE_OF_SUBJECT[kind]],
    state: 'offered',
    expiresAt: offerExpiresAt(request.nowMs),
    origin: request.origin,
    consents: [...request.consents],
    offeredBy: request.offeredBy,
    offeredAt: now,
    respondedAt: null,
    revokedBy: null,
    closedAt: null,
    updatedAt: now,
  };
}

/** Οι ζωντανές συμμετοχές της υπόθεσης + αν βρέθηκε **έστω ένα** μη αναγνώσιμο έγγραφο. */
async function readLiveForSubject(
  db: Firestore,
  tx: Transaction,
  home: EngagementHome,
  subject: EngagementSubject,
): Promise<{ readonly live: readonly Engagement[]; readonly unreadable: boolean }> {
  const query = engagementsForSubjectQuery(engagementsCollectionOf(db, home), subject);
  const parsed = (await tx.get(query)).docs.map((doc) => parseEngagement(doc.data()));
  const readable = parsed.filter((e): e is Engagement => e !== null);
  return {
    live: readable.filter((e) => LIVE_ENGAGEMENT_STATES.includes(e.state)),
    unreadable: readable.length !== parsed.length,
  };
}

/** Η κρίση της πρότασης πάνω στις ζωντανές συμμετοχές — **καθαρή**, ώστε να ασκείται χωρίς βάση. */
export function judgeOffer(
  live: readonly Engagement[],
  request: { readonly uid: string; readonly role: EngagementRole },
): Exclude<EngagementOfferOutcome, { outcome: 'offered' } | { outcome: 'unreadable' }> | null {
  const mine = live.find((e) => e.uid === request.uid);
  if (mine) return mine.role === request.role ? { outcome: 'already-live', engagement: mine } : { outcome: 'role-conflict', engagement: mine };
  const occupant = live.find((e) => e.role === request.role);
  return occupant ? { outcome: 'slot-occupied', engagement: occupant } : null;
}

/** **Πρόταση** συμμετοχής — `offered`, χωρίς **καμία** πρόσβαση μέχρι την αποδοχή. */
export function offerEngagement(db: Firestore, request: EngagementOfferRequest, signal: EngagementRosterSignal): Promise<EngagementOfferOutcome> {
  return db.runTransaction(async (tx): Promise<EngagementOfferOutcome> => {
    // Πρόταση πάνω σε ιστορία που δεν καταλαβαίνουμε ⇒ άρνηση: η μοναδικότητα δεν κρίνεται «περίπου».
    const { live, unreadable } = await readLiveForSubject(db, tx, projectHomeOf(request), request.subject);
    if (unreadable) return { outcome: 'unreadable' };
    const existing = judgeOffer(live, request);
    if (existing) return existing;
    const engagement = newEngagement(request);
    tx.create(engagementDocOf(db, engagement), engagement);
    signal(tx, { live: withWritten(live, engagement), changed: [engagement] });
    return { outcome: 'offered', engagement };
  });
}

// =============================================================================
// ΕΞΑΡΓΥΡΩΣΗ ΠΡΟΣΚΛΗΣΗΣ (ADR-901 Φ3) — μέσα στη συναλλαγή της μηχανής ADR-853
// =============================================================================

/** Ό,τι κοινό φέρει **κάθε** αποδοχή πρόσκλησης. */
interface InvitationAcceptanceCore {
  readonly invitationId: string;
  readonly declaredCredential: DeclaredCredential;
  /** ADR-901 §15 — για λογαριασμό ποιου χώρου· κρίθηκε **πριν** από τη συναλλαγή (`decideActingWorkspace`). */
  readonly actingFor: WorkspaceRef;
}

/** Αποδοχή πρόσκλησης σε υπόθεση **γραφείου** — η πρόταση **και** η απάντηση, σε ένα βήμα. */
export type ProjectInvitationAcceptance = EngagementOfferRequest & InvitationAcceptanceCore;

/** ADR-916 Φ-Ε1 — αποδοχή στον **φάκελο ιδιώτη** (`engagement-dossier-plan.ts`). */
export type { DossierInvitationAcceptance };

export type EngagementInvitationAcceptance = ProjectInvitationAcceptance | DossierInvitationAcceptance;

function isDossierAcceptance(request: EngagementInvitationAcceptance): request is DossierInvitationAcceptance {
  return request.subject.kind === 'property_dossier';
}

function projectHomeOf(key: Pick<EngagementKey, 'hostCompanyId' | 'projectId'>): EngagementHome {
  return { kind: 'project', hostCompanyId: key.hostCompanyId, projectId: key.projectId };
}

function acceptanceHomeOf(request: EngagementInvitationAcceptance): EngagementHome {
  return isDossierAcceptance(request) ? { kind: 'dossier', dossierId: request.subject.dossierId } : projectHomeOf(request);
}

/** Η λήξη μιας συμμετοχής που **γίνεται ενεργή** τη στιγμή `nowMs` — ο φάκελος από τη διάρκεια του κατόχου. */
function activeExpiryOf(engagement: Engagement, nowMs: number): string {
  return isDossierEngagement(engagement) ? dossierShareExpiresAt(engagement.shareDays, nowMs) : activeExpiresAt(nowMs);
}

export type EngagementInvitationStage =
  | { readonly outcome: 'refused'; readonly reason: 'slot-occupied' | 'role-conflict' | 'unreadable' }
  /** `write()` καλείται από τη μηχανή **μετά** τη σφράγιση της πρόσκλησης — επιστρέφει τη συμμετοχή. */
  | { readonly outcome: 'commit'; write(): Engagement };

/**
 * **Αποδοχή του συνδέσμου = αποδοχή της συμμετοχής** (πρότυπο Figma/Google Docs: «Accept invite» ⇒ μέσα).
 * Ο σύνδεσμος υπάρχει **ακριβώς επειδή** δεν υπήρχε λογαριασμός για πρόταση `offered`· η ρητή «ναι» του
 * Entra B2B δίνεται με το ίδιο κλικ, μαζί με τη δήλωση ιδιότητας (Ε-4).
 *
 * 🔑 **Αναγνώσεις τώρα, γραφές στο `write()`** (κανόνας Firestore — βλ. `InvitationAcceptance`). Η ίδια κρίση
 * `judgeOffer` με την πρόταση: δεύτερη αποδοχή ⇒ **η ίδια** συμμετοχή · πρόταση `offered` στον ίδιο (ο
 * οικοδεσπότης πρόλαβε αφού φτιάχτηκε ο λογαριασμός) ⇒ γίνεται `active` · άλλος στη θέση ⇒ άρνηση.
 */
export async function stageEngagementByInvitation(
  db: Firestore,
  tx: Transaction,
  request: EngagementInvitationAcceptance,
  signal: EngagementRosterSignal,
): Promise<EngagementInvitationStage> {
  const { live, unreadable } = await readLiveForSubject(db, tx, acceptanceHomeOf(request), request.subject);
  if (unreadable) return { outcome: 'refused', reason: 'unreadable' };
  const existing = judgeOffer(live, request);
  if (existing && existing.outcome !== 'already-live') return { outcome: 'refused', reason: existing.outcome };

  // Ζώνη: ο καλών κατασκευάζει τη δήλωση από τον κριτή — ξένος προσωπικός χώρος εδώ είναι σφάλμα κώδικα, όχι ανθρώπου.
  if (!isOwnActingWorkspace(request.uid, request.actingFor)) throw new Error('Engagement accepted for a foreign personal workspace');
  const acceptance: EngagementTransition = {
    kind: 'accept', byUid: request.uid, declaredCredential: request.declaredCredential, actingFor: request.actingFor,
  };
  const accepted = existing === null ? null : planTransition(existing.engagement, acceptance, request.nowMs);
  if (accepted?.outcome === 'noop') return { outcome: 'commit', write: () => accepted.engagement };
  const signalled = (written: Engagement, also: readonly Engagement[] = []): Engagement => {
    signal(tx, { live: withWritten(live, written), changed: [...also, written] });
    return written;
  };
  if (accepted?.outcome === 'changed') return { outcome: 'commit', write: () => signalled(setEngagement(db, tx, accepted.after)) };
  // Καμία ζωντανή — ή πρόταση που μόλις έληξε (γράφεται `expired`, ονομασμένα) — ⇒ νέα, **ήδη ενεργή**.
  const fresh = activeByInvitation(request);
  return {
    outcome: 'commit',
    write: () => {
      if (accepted?.outcome === 'offer-expired') setEngagement(db, tx, accepted.engagement);
      tx.create(engagementDocOf(db, fresh), fresh);
      return signalled(fresh, accepted?.outcome === 'offer-expired' ? [accepted.engagement] : []);
    },
  };
}

function activeByInvitation(request: EngagementInvitationAcceptance): Engagement {
  if (isDossierAcceptance(request)) return activeDossierByInvitation(request);
  const offered = newEngagement(request);
  return {
    ...offered,
    state: 'active',
    expiresAt: activeExpiresAt(request.nowMs),
    respondedAt: offered.offeredAt,
    origin: { ...request.origin, invitationId: request.invitationId },
    declaredCredential: request.declaredCredential,
    actingFor: request.actingFor,
  };
}

function setEngagement(db: Firestore, tx: Transaction, engagement: Engagement): Engagement {
  tx.set(engagementDocOf(db, engagement), engagement);
  return engagement;
}

// =============================================================================
// ΜΕΤΑΒΑΣΕΙΣ ΕΝΟΣ ΕΓΓΡΑΦΟΥ
// =============================================================================

/** Η απόφαση του **καλεσμένου** ή του **οικοδεσπότη** πάνω σε μία συμμετοχή. */
export type EngagementTransition =
  /**
   * ADR-901 Ε-4 · Φ4 — η αποδοχή **φέρει** τη δήλωση ιδιότητας: ενεργή συμμετοχή χωρίς δήλωση είναι
   * **δομικά αδύνατη**, από όποια διαδρομή κι αν έρθει (πρόταση `offered` ή πρόσκληση με email).
   *
   * ADR-901 §15 (Γ1) — και τον **χώρο για λογαριασμό του οποίου** αναλαμβάνει (`actingFor`): γράφεται **μαζί** με το
   * `active`, **μόνο** εδώ. Δεύτερη αποδοχή είναι `noop` ⇒ το πεδίο **δεν ξαναγράφεται** (Α1δ · άγκυρα Α44).
   */
  | { readonly kind: 'accept'; readonly byUid: string; readonly declaredCredential: DeclaredCredential; readonly actingFor: WorkspaceRef }
  | { readonly kind: 'decline'; readonly byUid: string }
  /** Οικοδεσπότης: `offered` ⇒ withdrawn · `active` ⇒ revoked (άμεσα, ADR-787 Ε-2 §5). */
  | { readonly kind: 'end'; readonly byUid: string }
  /**
   * ADR-916 Φ-Ε1 — **μόνο** φάκελος ιδιώτη, **μόνο** ενεργή: νέα λήξη από το κλειστό μενού, **από σήμερα** (Drive
   * «extend expiry»). Ποτέ «ανάσταση» ληγμένης ή ανακλημένης: εκεί θέλει νέα πρόσκληση (νέα συναίνεση).
   */
  | { readonly kind: 'renew'; readonly byUid: string; readonly shareDays: DossierShareDays }
  /** ADR-916 Φ-Ε1 — **μόνο** φάκελος ιδιώτη, ζωντανή: αλλαγή εύρους (καρτέλες · εξαιρέσεις) — ισχύει στο επόμενο άνοιγμα. */
  | { readonly kind: 'reach'; readonly byUid: string; readonly reach: DossierShareReach };

/** Η απάντηση του **καλεσμένου** — οι υπόλοιπες είναι πράξεις οικοδεσπότη (τις ελέγχει ο καλών: route κατόχου). */
type GuestAnswer = Extract<EngagementTransition, { kind: 'accept' | 'decline' }>;

export type EngagementTransitionOutcome =
  | { readonly outcome: 'changed'; readonly before: Engagement; readonly after: Engagement }
  /** Ιδεμποτησία: ήταν ήδη στην κατάσταση-στόχο. */
  | { readonly outcome: 'noop'; readonly engagement: Engagement }
  /** Η πρόταση έληξε πριν απαντηθεί — γράφεται `expired` (ονομασμένο, ποτέ σιωπηλή αποδοχή). */
  | { readonly outcome: 'offer-expired'; readonly engagement: Engagement }
  /** Η μετάβαση δεν επιτρέπεται από αυτή την κατάσταση (π.χ. αποδοχή ανακληθείσας). */
  | { readonly outcome: 'not-allowed'; readonly engagement: Engagement }
  | { readonly outcome: 'not-found' };

type Planned = Exclude<EngagementTransitionOutcome, { outcome: 'not-found' }>;

function stamp(before: Engagement, nowMs: number, changes: Partial<Engagement>): Planned {
  return { outcome: 'changed', before, after: { ...before, ...changes, updatedAt: new Date(nowMs).toISOString() } };
}

/** Η απάντηση του καλεσμένου — **μόνο** σε `offered`, **μόνο** ο ίδιος. */
function planResponse(e: Engagement, answer: GuestAnswer, nowMs: number): Planned {
  const accept = answer.kind === 'accept';
  const target = accept ? 'active' : 'declined';
  if (e.state === target) return { outcome: 'noop', engagement: e };
  if (e.state !== 'offered') return { outcome: 'not-allowed', engagement: e };
  const at = new Date(nowMs).toISOString();
  // ⚠️ ΟΧΙ `Date.parse(x) <= now`: άκυρη τιμή ⇒ NaN ⇒ `false` ⇒ η πρόταση **δεν έληγε ποτέ** — το σφάλμα
  //    που τεκμηριώνει το `scoped-grant.ts`. Ό,τι δεν διαβάζεται = ληγμένο (fail-closed).
  const expiresAtMs = normalizeToMillisOrNull(e.expiresAt);
  if (expiresAtMs === null || expiresAtMs <= nowMs) {
    return { outcome: 'offer-expired', engagement: { ...e, state: 'expired', closedAt: at, updatedAt: at } };
  }
  if (answer.kind === 'decline') return stamp(e, nowMs, { state: 'declined', respondedAt: at, closedAt: at });
  // Ζώνη του γραφέα: «για λογαριασμό» ξένου προσωπικού χώρου δεν γράφεται, όποιος κι αν το ζήτησε.
  if (!isOwnActingWorkspace(e.uid, answer.actingFor)) return { outcome: 'not-allowed', engagement: e };
  return stamp(e, nowMs, {
    state: 'active', respondedAt: at, expiresAt: activeExpiryOf(e, nowMs),
    declaredCredential: answer.declaredCredential, actingFor: answer.actingFor,
  });
}

/** Το τέλος από τον οικοδεσπότη — απόσυρση πρότασης ή ανάκληση ενεργής. */
function planEnd(e: Engagement, byUid: string, nowMs: number): Planned {
  const at = new Date(nowMs).toISOString();
  if (e.state === 'offered') return stamp(e, nowMs, { state: 'withdrawn', revokedBy: byUid, closedAt: at });
  if (e.state === 'active') return stamp(e, nowMs, { state: 'revoked', revokedAt: at, revokedBy: byUid, closedAt: at });
  return { outcome: 'noop', engagement: e };
}

/** **Καθαρός** σχεδιασμός μιας μετάβασης — ασκείται από τις άγκυρες χωρίς βάση. */
export function planTransition(e: Engagement, transition: EngagementTransition, nowMs: number): Planned {
  if (transition.kind === 'end') return planEnd(e, transition.byUid, nowMs);
  if (transition.kind === 'renew' || transition.kind === 'reach') return planDossierChange(e, transition, nowMs);
  // Μόνο ο ίδιος ο καλεσμένος απαντά — ο οικοδεσπότης δεν «αποδέχεται για λογαριασμό του».
  if (e.uid !== transition.byUid) return { outcome: 'not-allowed', engagement: e };
  return planResponse(e, transition, nowMs);
}

/** Εφαρμογή μετάβασης σε **ένα** έγγραφο, μέσα σε συναλλαγή. */
export function transitionEngagement(
  db: Firestore,
  key: EngagementKey | DossierEngagementKey,
  transition: EngagementTransition,
  nowMs: number,
  signal: EngagementRosterSignal,
): Promise<EngagementTransitionOutcome> {
  const ref = 'dossierId' in key
    ? dossierEngagementsCollection(db, key.dossierId).doc(key.engagementId)
    : engagementRef(db, key);
  return db.runTransaction(async (tx): Promise<EngagementTransitionOutcome> => {
    const current = parseEngagement((await tx.get(ref)).data());
    if (!current) return { outcome: 'not-found' };
    const planned = planTransition(current, transition, nowMs);
    const written = planned.outcome === 'changed' ? planned.after : planned.outcome === 'offer-expired' ? planned.engagement : null;
    if (!written) return planned;
    // Αναγνώσεις πριν από εγγραφές (κανόνας συναλλαγής): οι ζωντανές του αντικειμένου για το σήμα των όψεων.
    const { live } = await readLiveForSubject(db, tx, homeOfEngagement(current), current.subject);
    tx.set(ref, written);
    signal(tx, { live: withWritten(live, written), changed: [written] });
    return planned;
  });
}

// =============================================================================
// ΚΛΕΙΣΙΜΟ ΥΠΟΘΕΣΗΣ
// =============================================================================

/**
 * Η υπόθεση έκλεισε/ακυρώθηκε ⇒ **κάθε** ζωντανή συμμετοχή της παύει: ενεργή ⇒ `completed`,
 * πρόταση ⇒ `withdrawn`. Η **κύρια** λήξη του ADR-862 §5.3.3 — παράγεται από την πράξη, δεν πληκτρολογείται.
 * Ιδεμποτής: δεύτερη κλήση βρίσκει **μηδέν** ζωντανές.
 */
export function closeEngagementsForSubject(
  db: Firestore,
  key: Pick<EngagementKey, 'hostCompanyId' | 'projectId'>,
  subject: EngagementSubject,
  byUid: string,
  nowMs: number,
  signal: EngagementRosterSignal,
): Promise<readonly Engagement[]> {
  return db.runTransaction(async (tx) => {
    // ⚠️ Το κλείσιμο ΔΕΝ σταματά σε χαλασμένο έγγραφο: όποια ζωντανή διαβάζεται, κλείνει (ο κριτής
    //    αρνείται ήδη ό,τι δεν διαβάζεται — η ανάκληση δεν επιτρέπεται να «κολλήσει» σε άλλο έγγραφο).
    const { live } = await readLiveForSubject(db, tx, projectHomeOf(key), subject);
    const at = new Date(nowMs).toISOString();
    const closed = live.map((e) => {
      const after: Engagement = e.state === 'active'
        ? { ...e, state: 'completed', closedAt: at, updatedAt: at }
        : { ...e, state: 'withdrawn', revokedBy: byUid, closedAt: at, updatedAt: at };
      tx.set(engagementRef(db, { ...key, engagementId: e.id }), after);
      return after;
    });
    if (closed.length > 0) signal(tx, { live: [], changed: closed });
    return closed;
  });
}
