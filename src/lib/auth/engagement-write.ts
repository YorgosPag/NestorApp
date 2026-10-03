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

import { activeExpiresAt, offerExpiresAt } from '@/config/engagement-policy';
import { normalizeToMillisOrNull } from '@/lib/date-local';
import { generateEngagementId } from '@/services/enterprise-id.service';
import { parseEngagement } from './engagement-schema';
import { engagementRef, engagementsCollection, engagementsForSubjectQuery } from './engagement-ref';
import {
  LIVE_ENGAGEMENT_STATES,
  type DeclaredCredential,
  type Engagement,
  type EngagementConsent,
  type EngagementKey,
  type EngagementOrigin,
  type EngagementSubject,
} from '@/types/engagement';
import type { CdeAudience } from '@/types/container-access';
import type { LegalProfessionalRole } from '@/types/legal-contracts';

// =============================================================================
// ΠΡΟΤΑΣΗ
// =============================================================================

export interface EngagementOfferRequest {
  readonly hostCompanyId: string;
  readonly projectId: string;
  readonly uid: string;
  readonly email: string;
  readonly template: CdeAudience;
  readonly role: LegalProfessionalRole;
  readonly subject: EngagementSubject;
  readonly origin: EngagementOrigin;
  readonly consents: readonly EngagementConsent[];
  readonly offeredBy: string;
  readonly nowMs: number;
}

export type EngagementOfferOutcome =
  | { readonly outcome: 'offered'; readonly engagement: Engagement }
  /** Ιδεμποτησία: ίδιος άνθρωπος, ίδια θέση, ήδη ζωντανή — καμία εγγραφή. */
  | { readonly outcome: 'already-live'; readonly engagement: Engagement }
  /** Η θέση έχει **άλλον** ζωντανό επαγγελματία — πρώτα ανάκληση (ADR-901 §5.2: αντικατάσταση, όχι δύο). */
  | { readonly outcome: 'slot-occupied'; readonly engagement: Engagement }
  /** Ο ίδιος άνθρωπος έχει ήδη **άλλη** θέση στην υπόθεση (π.χ. δικηγόρος ΚΑΙ συμβολαιογράφος). */
  | { readonly outcome: 'role-conflict'; readonly engagement: Engagement }
  | { readonly outcome: 'unreadable' };

function newEngagement(request: EngagementOfferRequest): Engagement {
  const now = new Date(request.nowMs).toISOString();
  return {
    id: generateEngagementId(),
    hostCompanyId: request.hostCompanyId,
    projectId: request.projectId,
    uid: request.uid,
    email: request.email,
    template: request.template,
    role: request.role,
    subject: request.subject,
    scopes: ['conveyance:case:view'],
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
  key: Pick<EngagementKey, 'hostCompanyId' | 'projectId'>,
  subject: EngagementSubject,
): Promise<{ readonly live: readonly Engagement[]; readonly unreadable: boolean }> {
  const query = engagementsForSubjectQuery(engagementsCollection(db, key.hostCompanyId, key.projectId), subject);
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
  request: Pick<EngagementOfferRequest, 'uid' | 'role'>,
): Exclude<EngagementOfferOutcome, { outcome: 'offered' } | { outcome: 'unreadable' }> | null {
  const mine = live.find((e) => e.uid === request.uid);
  if (mine) return mine.role === request.role ? { outcome: 'already-live', engagement: mine } : { outcome: 'role-conflict', engagement: mine };
  const occupant = live.find((e) => e.role === request.role);
  return occupant ? { outcome: 'slot-occupied', engagement: occupant } : null;
}

/** **Πρόταση** συμμετοχής — `offered`, χωρίς **καμία** πρόσβαση μέχρι την αποδοχή. */
export function offerEngagement(db: Firestore, request: EngagementOfferRequest): Promise<EngagementOfferOutcome> {
  return db.runTransaction(async (tx): Promise<EngagementOfferOutcome> => {
    // Πρόταση πάνω σε ιστορία που δεν καταλαβαίνουμε ⇒ άρνηση: η μοναδικότητα δεν κρίνεται «περίπου».
    const { live, unreadable } = await readLiveForSubject(db, tx, request, request.subject);
    if (unreadable) return { outcome: 'unreadable' };
    const existing = judgeOffer(live, request);
    if (existing) return existing;
    const engagement = newEngagement(request);
    tx.create(engagementRef(db, { ...request, engagementId: engagement.id }), engagement);
    return { outcome: 'offered', engagement };
  });
}

// =============================================================================
// ΕΞΑΡΓΥΡΩΣΗ ΠΡΟΣΚΛΗΣΗΣ (ADR-901 Φ3) — μέσα στη συναλλαγή της μηχανής ADR-853
// =============================================================================

/** Ό,τι γράφει η αποδοχή πρόσκλησης με email — η πρόταση **και** η απάντηση, σε ένα βήμα. */
export interface EngagementInvitationAcceptance extends EngagementOfferRequest {
  readonly invitationId: string;
  readonly declaredCredential: DeclaredCredential;
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
): Promise<EngagementInvitationStage> {
  const { live, unreadable } = await readLiveForSubject(db, tx, request, request.subject);
  if (unreadable) return { outcome: 'refused', reason: 'unreadable' };
  const existing = judgeOffer(live, request);
  if (existing && existing.outcome !== 'already-live') return { outcome: 'refused', reason: existing.outcome };

  const acceptance: EngagementTransition = { kind: 'accept', byUid: request.uid, declaredCredential: request.declaredCredential };
  const accepted = existing === null ? null : planTransition(existing.engagement, acceptance, request.nowMs);
  if (accepted?.outcome === 'noop') return { outcome: 'commit', write: () => accepted.engagement };
  if (accepted?.outcome === 'changed') return { outcome: 'commit', write: () => setEngagement(db, tx, accepted.after) };
  // Καμία ζωντανή — ή πρόταση που μόλις έληξε (γράφεται `expired`, ονομασμένα) — ⇒ νέα, **ήδη ενεργή**.
  const fresh = activeByInvitation(request);
  return {
    outcome: 'commit',
    write: () => {
      if (accepted?.outcome === 'offer-expired') setEngagement(db, tx, accepted.engagement);
      tx.create(engagementRef(db, { ...request, engagementId: fresh.id }), fresh);
      return fresh;
    },
  };
}

function activeByInvitation(request: EngagementInvitationAcceptance): Engagement {
  const offered = newEngagement(request);
  return {
    ...offered,
    state: 'active',
    expiresAt: activeExpiresAt(request.nowMs),
    respondedAt: offered.offeredAt,
    origin: { ...request.origin, invitationId: request.invitationId },
    declaredCredential: request.declaredCredential,
  };
}

function setEngagement(db: Firestore, tx: Transaction, engagement: Engagement): Engagement {
  tx.set(engagementRef(db, { ...engagement, engagementId: engagement.id }), engagement);
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
   */
  | { readonly kind: 'accept'; readonly byUid: string; readonly declaredCredential: DeclaredCredential }
  | { readonly kind: 'decline'; readonly byUid: string }
  /** Οικοδεσπότης: `offered` ⇒ withdrawn · `active` ⇒ revoked (άμεσα, ADR-787 Ε-2 §5). */
  | { readonly kind: 'end'; readonly byUid: string };

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
function planResponse(e: Engagement, answer: Exclude<EngagementTransition, { kind: 'end' }>, nowMs: number): Planned {
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
  return answer.kind === 'accept'
    ? stamp(e, nowMs, { state: 'active', respondedAt: at, expiresAt: activeExpiresAt(nowMs), declaredCredential: answer.declaredCredential })
    : stamp(e, nowMs, { state: 'declined', respondedAt: at, closedAt: at });
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
  // Μόνο ο ίδιος ο καλεσμένος απαντά — ο οικοδεσπότης δεν «αποδέχεται για λογαριασμό του».
  if (e.uid !== transition.byUid) return { outcome: 'not-allowed', engagement: e };
  return planResponse(e, transition, nowMs);
}

/** Εφαρμογή μετάβασης σε **ένα** έγγραφο, μέσα σε συναλλαγή. */
export function transitionEngagement(
  db: Firestore,
  key: EngagementKey,
  transition: EngagementTransition,
  nowMs: number,
): Promise<EngagementTransitionOutcome> {
  const ref = engagementRef(db, key);
  return db.runTransaction(async (tx): Promise<EngagementTransitionOutcome> => {
    const current = parseEngagement((await tx.get(ref)).data());
    if (!current) return { outcome: 'not-found' };
    const planned = planTransition(current, transition, nowMs);
    if (planned.outcome === 'changed') tx.set(ref, planned.after);
    if (planned.outcome === 'offer-expired') tx.set(ref, planned.engagement);
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
): Promise<readonly Engagement[]> {
  return db.runTransaction(async (tx) => {
    // ⚠️ Το κλείσιμο ΔΕΝ σταματά σε χαλασμένο έγγραφο: όποια ζωντανή διαβάζεται, κλείνει (ο κριτής
    //    αρνείται ήδη ό,τι δεν διαβάζεται — η ανάκληση δεν επιτρέπεται να «κολλήσει» σε άλλο έγγραφο).
    const { live } = await readLiveForSubject(db, tx, key, subject);
    const at = new Date(nowMs).toISOString();
    return live.map((e) => {
      const after: Engagement = e.state === 'active'
        ? { ...e, state: 'completed', closedAt: at, updatedAt: at }
        : { ...e, state: 'withdrawn', revokedBy: byUid, closedAt: at, updatedAt: at };
      tx.set(engagementRef(db, { ...key, engagementId: e.id }), after);
      return after;
    });
  });
}
