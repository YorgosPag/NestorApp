import 'server-only';

/**
 * @fileoverview **Ο ΕΝΑΣ ΓΡΑΦΕΑΣ ΤΗΣ ΠΑΡΑΔΟΣΗΣ** — φέρνει τις παραδόσεις ενός ακινήτου στην αλήθεια της πώλησης.
 * @related ADR-916 §5.3 · lib/property-handover/handover-plan.ts (η απόφαση) · ADR-195 (ίχνος)
 * @module services/property-handover/property-handover-write.service
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 Ο ΓΡΑΦΕΑΣ ΔΕΝ ΑΠΟΦΑΣΙΖΕΙ
 * ────────────────────────────────────────────────────────────────────────────
 * Διαβάζει ακίνητο + υπάρχουσες παραδόσεις **μέσα** σε συναλλαγή, ζητά το σχέδιο από το καθαρό
 * `planPropertyHandovers` και το εφαρμόζει. Δύο ταυτόχρονες κλήσεις (PATCH · `legalPhase`) ⇒ η δεύτερη
 * συναλλαγή ξαναπαίζει, βλέπει την πρώτη και γράφει **τίποτα** (ADR-916 Π5).
 *
 * 🛡️ **ΠΟΤΕ ΔΕΝ ΠΕΤΑ**: η πώληση **δεν** αποτυγχάνει επειδή απέτυχε η παράδοση. Αποτυχία = γραμμή στο
 * ημερολόγιο + `failed` στον καλούντα — και το νυχτερινό δίχτυ (`property-handover-reconcile`) ξαναπερνά
 * από **εδώ** (ίδιος κώδικας, όχι δεύτερη μηχανή).
 *
 * 📜 **Ίχνος μετά το commit** (ADR-195 · πρότυπο `property-dossier-write.service.ts`): το σώμα της
 * συναλλαγής ξανατρέχει σε σύγκρουση, άρα παρενέργεια μέσα του θα γραφόταν δύο φορές.
 *
 * ✉️ **Φ-Β — η πρόσκληση του αγοραστή στην ΙΔΙΑ συναλλαγή** (`property-handover-invitation-stage.ts`): κύκλος ζωής,
 * κάτοπτρο πρόσκλησης, η ίδια η πρόσκληση (supersede) και η προβολή στον φάκελο του αγοραστή γράφονται **αδιαίρετα**.
 * Τα email φεύγουν **μετά** το commit (ίδιος λόγος με το ίχνος)· το δίχτυ ξαναδοκιμάζει ό,τι δεν έγινε δεκτό.
 *
 * 📦 **Φ-Γ1 — τα αρχεία, μετά το commit** (`server/property-handover-delivery`): όταν η παράδοση **οφείλεται**
 * (`fileDeliveryStateOf`), ο εκτελεστής αντιγράφει ένα πρώτο κομμάτι και το cron `property-handover-delivery` συνεχίζει.
 * Η πρόοδος γράφεται από τις γραφές προόδου (`property-handover-progress-write.ts`, CAS) — ο εκτελεστής δεν αγγίζει ποτέ
 * τη συλλογή.
 *
 * ↩️ **Φ-Δ.5 — η ανάκληση στην ΙΔΙΑ συναλλαγή** (`applyHandoverWithdrawal`): η κρίση ξανατρέχει πάνω στο **φρέσκο**
 * στιγμιότυπο της πώλησης, η μετάβαση `withdrawn` μπαίνει στο **ίδιο** σχέδιο (ίδιο ίχνος · ίδια προβολή στον φάκελο ·
 * ίδια ανάκληση πρόσκλησης), και το email φεύγει **μετά** το commit — με δίχτυ.
 */

import type { Firestore as AdminFirestore, Query, Transaction } from 'firebase-admin/firestore';

import { PROPERTY_HANDOVER_TRACKED_FIELDS } from '@/config/audit-tracked-fields';
import { COLLECTIONS } from '@/config/firestore-collections';
import { nowISO } from '@/lib/date-local';
import { getErrorMessage } from '@/lib/error-utils';
import { fileDeliveryStateOf } from '@/lib/property-handover/handover-delivery-plan';
import {
  planPropertyHandovers,
  propertyHandoverSnapshotOf,
  type PropertyHandoverSnapshot,
  type PropertyHandoverWrite,
} from '@/lib/property-handover/handover-plan';
import {
  applyHandoverWithdrawal,
  withdrawalNoticeRetryDueOf,
  type HandoverWithdrawalOutcome,
} from '@/lib/property-handover/handover-withdrawal-plan';
import { propertyHandoverFromDocument } from '@/lib/property-handover/property-handover-from-document';
import { createModuleLogger } from '@/lib/telemetry';
import type {
  HandoverFileDeliveryRecorder,
  HandoverProtocolIssuer,
} from '@/server/property-handover-delivery/handover-delivery.server';
import {
  deliverIssuedHandoverInvitations,
  followUpHandoverInvitation,
  type HandoverDeliveryRecorder,
} from '@/server/property-handover-invitations/handover-invitation-delivery';
import type { MintedHandoverInvitation } from '@/server/property-handover-invitations/handover-invitation-kind';
import {
  deliverHandoverWithdrawalNotice,
  type HandoverWithdrawalNoticeRecorder,
} from '@/server/property-handover-withdrawal/handover-withdrawal-notice';
import { recordTrackedEntityWrite } from '@/services/entity-audit-tracked-write';
import { stagePropertyDossierHandoverProjection } from '@/services/property-dossier/property-dossier-write.service';
import type { PropertyHandover } from '@/types/property-handover';

import { deliverDueHandoverFiles } from './property-handover-delivery-trigger';
import {
  handoverDocRef,
  recordHandoverFileDelivery,
  recordHandoverInvitationDelivery,
  recordHandoverWithdrawalNotice,
  withdrawalNoticeStateOf,
} from './property-handover-progress-write';
import {
  stageHandoverInvitations,
  type HandoverInvitationRenewalOutcome,
  type HandoverInvitationRenewalRequest,
} from './property-handover-invitation-stage';

const logger = createModuleLogger('PropertyHandoverWrite');

/**
 * Ποιος ζήτησε τη συμφιλίωση — μόνο για το ημερολόγιο· το αποτέλεσμα **δεν** εξαρτάται από αυτό. Η ρητή πρόθεση του
 * γραφείου (`office-renewal`, Φ-Δ.3) περνά από το {@link PropertyHandoverSyncRequest.renewal}, **όχι** από την αιτία.
 */
export type PropertyHandoverSyncCause =
  | 'property-write' | 'legal-phase' | 'acceptance' | 'reconcile' | 'office-renewal' | 'office-file-decision' | 'office-withdrawal'
  | 'office-line-closure';

/**
 * Οι αιτίες που ξανακοιτούν και τις **παραδομένες** παραδόσεις: το δίχτυ (συμπληρώσεις, Δ5) και η απόφαση γραφείου ανά
 * αρχείο (Φ-Δ.4 — ό,τι έγινε «Παραδίδεται» φτάνει τώρα, και το «θέλουν απόφαση» ξαναμετριέται τώρα, όχι στο νυχτερινό).
 */
const CAUSES_RESCANNING_DELIVERED: ReadonlySet<PropertyHandoverSyncCause> = new Set(['reconcile', 'office-file-decision']);

export interface PropertyHandoverSyncRequest {
  readonly cause: PropertyHandoverSyncCause;
  /** uid του δρώντα — `'system'` για δίχτυ και γραφέα νομικής φάσης χωρίς άνθρωπο. */
  readonly performedBy: string;
  /**
   * Φ-Δ.3 (Ο9) — «το γραφείο ζητά νέα πρόσκληση»: supersede **στην ίδια** συναλλαγή με τη συμφιλίωση (ποτέ δεύτερος
   * γραφέας). Η κρίση (`handoverInvitationRenewalOf`) ξανατρέχει **μέσα** στη συναλλαγή — μια ταυτόχρονη αποδοχή ή
   * δεύτερο κλικ βλέπει την πρώτη και αρνείται `not-renewable`.
   */
  readonly renewal?: HandoverInvitationRenewalRequest;
  /**
   * Φ-Δ.5 (Δ8) — «το γραφείο ανακαλεί την παράδοση»: η κρίση (`handoverWithdrawalOf`) ξανατρέχει **μέσα** στη συναλλαγή,
   * πάνω στο φρέσκο στιγμιότυπο — μια πώληση που αποκαταστάθηκε στο μεταξύ ⇒ `not-withdrawable`, δεύτερο κλικ ⇒ `unchanged`.
   */
  readonly withdrawal?: { readonly handoverId: string; readonly reason: string };
  /**
   * Φ-Γ2 Σ4 — ο εκδότης Πρωτοκόλλου **της εκτέλεσης του καλούντα** (π.χ. το νυχτερινό δίχτυ ανοίγει **μία** συνεδρία
   * σφράγισης για όλα τα ακίνητα ⇒ ένα σήμα). Απών ⇒ η συμφιλίωση ανοίγει δική της, **μόνο** αν κάποια παράδοση τρέξει.
   */
  readonly protocolIssuer?: HandoverProtocolIssuer;
}

export type PropertyHandoverSyncOutcome =
  /**
   * `writes` = μεταβάσεις κύκλου ζωής (στο δίχτυ: σημείο κλήσης που ξέφυγε). `invitationWrites` = παραδόσεις που
   * άλλαξαν **μόνο** πρόσκληση — π.χ. άλλαξε το email της επαφής, πράξη που **δεν** έχει σημείο κλήσης· δεν είναι διαρροή.
   */
  | {
      readonly kind: 'synced';
      readonly writes: number;
      readonly invitationWrites: number;
      /** Προσκλήσεις που οφείλονται αλλά περιμένουν το μυστικό των συνδέσμων (ADR-916 §5.6) — ΕΝΑ σήμα, όχι σφάλμα. */
      readonly invitationsAwaitingConfiguration: number;
      /** Φ-Δ.3 — η έκβαση της ρητής πρόθεσης· `null` όταν δεν ζητήθηκε. */
      readonly renewal: HandoverInvitationRenewalOutcome | null;
      /** Φ-Δ.5 — η έκβαση της ανάκλησης· `null` όταν δεν ζητήθηκε. */
      readonly withdrawal: HandoverWithdrawalOutcome | null;
    }
  | { readonly kind: 'failed' };

/**
 * Οι αποθηκευμένες παραδόσεις ενός ακινήτου — **πάντα** με τον μισθωτή (CHECK 3.10/3.35), μόνο ισότητες (3.91).
 * Το ΕΝΑ ερώτημα: το διαβάζουν ο γραφέας (μέσα σε συναλλαγή) **και** η προεπισκόπηση.
 */
export function propertyHandoversQuery(adminDb: AdminFirestore, companyId: string, propertyId: string): Query {
  return adminDb
    .collection(COLLECTIONS.PROPERTY_HANDOVERS)
    .where('companyId', '==', companyId)
    .where('propertyId', '==', propertyId);
}

/**
 * Το έγγραφο όπως αποθηκεύεται — η ταυτότητα είναι το id του εγγράφου, όχι πεδίο. Το `fileDeliveryState` είναι
 * **παράγωγο** (`fileDeliveryStateOf`) και υπάρχει μόνο για το ερώτημα ισότητας του cron — ποτέ χειρόγραφο, άρα δεν
 * μπορεί να διαφωνήσει με την παράδοση. Ο αναγνώστης δεν το διαβάζει.
 */
function storedHandover(handover: PropertyHandover): Omit<PropertyHandover, 'id'> & {
  readonly fileDeliveryState: string | null;
  readonly withdrawalNoticeState: string | null;
} {
  return {
    companyId: handover.companyId,
    propertyId: handover.propertyId,
    recipientContactId: handover.recipientContactId,
    lifecycle: handover.lifecycle,
    completion: handover.completion,
    // ⚠️ `set` ολόκληρου εγγράφου: ό,τι δεν περάσει από εδώ **σβήνεται** — και ο παραλήπτης δεν ξαναγράφεται ποτέ.
    recipient: handover.recipient,
    invitation: handover.invitation,
    fileDelivery: handover.fileDelivery,
    // Φ-Γ2 Σ4 — ο δείκτης στο τελευταίο Πρωτόκολλο: μια συμφιλίωση που δεν τον περνούσε θα τον **έσβηνε** ⇒ η επόμενη
    // έκδοση θα έβγαινε ξανά «αναθεώρηση 1» χωρίς `supersedes`.
    protocol: handover.protocol,
    // Φ-Δ.5 — η ανάκληση + το παράγωγο του διχτυού των email της (ποτέ χειρόγραφο).
    withdrawal: handover.withdrawal,
    withdrawalNoticeState: withdrawalNoticeStateOf(handover),
    fileDeliveryState: fileDeliveryStateOf(handover),
    createdAt: handover.createdAt,
    updatedAt: handover.updatedAt,
  };
}

/**
 * **Το ίχνος μιας γραφής παράδοσης** — το ΕΝΑ σημείο, για τη συμφιλίωση **και** για την αποδοχή της πρόσκλησης
 * (Φ-Β, `recipient`). Καλείται **μετά** το commit.
 */
export async function recordHandoverWrite(write: PropertyHandoverWrite, performedBy: string): Promise<void> {
  await recordTrackedEntityWrite({
    entityType: 'property_handover',
    entityId: write.after.id,
    entityName: null,
    trackedFields: PROPERTY_HANDOVER_TRACKED_FIELDS,
    before: write.kind === 'update' ? write.before : null,
    after: write.after,
    performedBy,
    ledger: { companyId: write.after.companyId },
  });
}

// =============================================================================
// Φ-Β — ΟΙ ΑΛΛΕΣ ΓΡΑΦΕΣ ΤΗΣ ΠΑΡΑΔΟΣΗΣ, ΣΤΟΝ ΙΔΙΟ ΓΡΑΦΕΑ (καμία δεύτερη διαδρομή προς τη συλλογή)
// =============================================================================

/**
 * **Ο αγοραστής αποδέχτηκε** — μέσα στη συναλλαγή της εξαργύρωσης (ADR-853 §20: ένα κλικ ⇒ ένα αποτέλεσμα). Ο καλών
 * έχει ήδη διαβάσει και κρίνει την παράδοση **στην ίδια** συναλλαγή· το ίχνος (`recordHandoverWrite`) μετά το commit.
 */
export function stageHandoverRecipient(tx: Transaction, adminDb: AdminFirestore, after: PropertyHandover): void {
  // Φ-Γ1 — αποδοχή σε **ήδη** ολοκληρωμένη πώληση ⇒ η αντιγραφή οφείλεται από **αυτή** τη στιγμή (Ο12).
  tx.update(handoverDocRef(adminDb, after.id), {
    recipient: after.recipient, fileDeliveryState: fileDeliveryStateOf(after), updatedAt: after.updatedAt,
  });
}

/**
 * **«Δεν το θέλω»** — μέσα στη συναλλαγή της εξαργύρωσης. Η πρόσκληση που απαντιέται είναι **πάντα** η τρέχουσα του
 * κατόπτρου (το supersede είναι ατομικό με το κάτοπτρο), άρα δεν χρειάζεται ανάγνωση — και δεν επιτρέπεται: ο πυρήνας
 * καλεί το άγκιστρο της άρνησης **μετά** από γραφή.
 */
export function stageHandoverInvitationDeclined(tx: Transaction, adminDb: AdminFirestore, handoverId: string, declinedAt: string): void {
  tx.update(handoverDocRef(adminDb, handoverId), { 'invitation.declinedAt': declinedAt, updatedAt: declinedAt });
}

/** Ό,τι έγινε σε μία συναλλαγή — για το ίχνος, τα email και το δίχτυ. */
interface AppliedPlan {
  /** Οι μεταβάσεις κύκλου ζωής (το ίχνος) — με το `after` **όπως γράφτηκε** (μαζί με το κάτοπτρο). */
  readonly lifecycleWrites: readonly PropertyHandoverWrite[];
  /**
   * Οι παραδόσεις που άλλαξαν **μόνο** κάτοπτρο πρόσκλησης (π.χ. άλλαξε το email · νέα από το γραφείο) — για το ίχνος
   * (Φ-Δ.3): γραμμή γράφεται **μόνο** αν άλλαξε η ταυτότητα της πρόσκλησης, ποτέ για τηλεμετρία αποστολής.
   */
  readonly mirrorWrites: readonly PropertyHandoverWrite[];
  readonly issued: readonly MintedHandoverInvitation[];
  readonly awaitingConfiguration: number;
  /** Όλες οι παραδόσεις του ακινήτου, όπως **είναι** μετά το commit. */
  readonly handovers: readonly PropertyHandover[];
  readonly renewal: HandoverInvitationRenewalOutcome | null;
  readonly withdrawal: HandoverWithdrawalOutcome | null;
}

const NOTHING_APPLIED: AppliedPlan = {
  lifecycleWrites: [], mirrorWrites: [], issued: [], awaitingConfiguration: 0, handovers: [], renewal: null, withdrawal: null,
};

/** Οι εγγραφές **μόνο** κατόπτρου, ως `update` με το πριν — ό,τι δεν είναι ήδη μετάβαση κύκλου ζωής. */
function mirrorOnlyWrites(
  existing: readonly PropertyHandover[],
  lifecycleWrites: readonly PropertyHandoverWrite[],
  mirrored: ReadonlyMap<string, PropertyHandover>,
): readonly PropertyHandoverWrite[] {
  const lifecycleIds = new Set(lifecycleWrites.map((write) => write.after.id));
  return existing.flatMap((before) => {
    const after = mirrored.get(before.id);
    return after === undefined || lifecycleIds.has(before.id) ? [] : [{ kind: 'update' as const, before, after }];
  });
}

/** Οι παραδόσεις όπως **θα** είναι μετά το σχέδιο κύκλου ζωής — υπάρχουσες + γεννήσεις, με τις μεταβάσεις. */
function afterLifecycle(existing: readonly PropertyHandover[], writes: readonly PropertyHandoverWrite[]): readonly PropertyHandover[] {
  const byId = new Map(existing.map((handover) => [handover.id, handover]));
  for (const write of writes) byId.set(write.after.id, write.after);
  return [...byId.values()];
}

/**
 * **Η προβολή στον φάκελο του αγοραστή** (Δ10) — μόνο για παραδόσεις με παραλήπτη των οποίων **άλλαξε** ο κύκλος ζωής.
 * Αναγνώσεις εδώ· οι γραφές στα `commit()` που επιστρέφονται.
 */
async function stageDossierProjections(
  tx: Transaction,
  adminDb: AdminFirestore,
  writes: readonly PropertyHandoverWrite[],
): Promise<ReadonlyArray<() => void>> {
  const staged = await Promise.all(writes.flatMap((write) => {
    const { recipient } = write.after;
    if (write.kind !== 'update' || recipient === null) return [];
    return [stagePropertyDossierHandoverProjection(tx, adminDb, {
      dossierId: recipient.dossierId, userId: recipient.userId, handoverId: write.after.id, handoverLifecycle: write.after.lifecycle,
    })];
  }));
  return staged.map((stage) => stage.commit);
}

/** Το ακίνητο και οι υπάρχουσες παραδόσεις του — **μέσα** στη συναλλαγή. `null` ⇒ ακίνητο χωρίς μισθωτή/ανύπαρκτο. */
async function readHandoverState(
  tx: Transaction,
  adminDb: AdminFirestore,
  propertyId: string,
): Promise<{ readonly snapshot: PropertyHandoverSnapshot; readonly existing: readonly PropertyHandover[] } | null> {
  const propertySnap = await tx.get(adminDb.collection(COLLECTIONS.PROPERTIES).doc(propertyId));
  const snapshot = propertySnap.exists ? propertyHandoverSnapshotOf(propertyId, propertySnap.data() ?? {}) : null;
  if (!snapshot) return null;
  const existing = (await tx.get(propertyHandoversQuery(adminDb, snapshot.companyId, propertyId))).docs.flatMap((doc) => {
    const handover = propertyHandoverFromDocument(doc.data(), doc.id);
    return handover ? [handover] : [];
  });
  return { snapshot, existing };
}

/**
 * **Οι εγγραφές των παραδόσεων** — ένα έγγραφο ανά παράδοση που άλλαξε (μετάβαση **ή** κάτοπτρο), στην τελική του μορφή.
 * Επιστρέφει όλες τις παραδόσεις του ακινήτου όπως είναι **μετά**.
 */
function writeHandovers(
  tx: Transaction,
  adminDb: AdminFirestore,
  existing: readonly PropertyHandover[],
  lifecycleWrites: readonly PropertyHandoverWrite[],
  mirrored: ReadonlyMap<string, PropertyHandover>,
): readonly PropertyHandover[] {
  const changed = new Map(lifecycleWrites.map((write) => [write.after.id, { handover: write.after, create: write.kind === 'create' }]));
  for (const [id, handover] of mirrored) if (!changed.has(id)) changed.set(id, { handover, create: false });
  const final = new Map(existing.map((handover) => [handover.id, handover]));
  for (const [id, { handover, create }] of changed) {
    const ref = adminDb.collection(COLLECTIONS.PROPERTY_HANDOVERS).doc(id);
    // `create` στη γέννηση: αν το ντετερμινιστικό έγγραφο υπάρχει ήδη χωρίς να το είδε το ερώτημα
    // (π.χ. αλλοιωμένο), η συναλλαγή αποτυγχάνει δυνατά — ποτέ σιωπηλή αντικατάσταση.
    if (create) tx.create(ref, storedHandover(handover));
    else tx.set(ref, storedHandover(handover));
    final.set(id, handover);
  }
  return [...final.values()];
}

const UNKNOWN_WITHDRAWAL: HandoverWithdrawalOutcome = { kind: 'refused', reason: 'handover-unknown' };

/**
 * Η συναλλαγή: ανάγνωση → σχέδιο (+ ανάκληση) → πρόσκληση → προβολή → εγγραφές (όλες οι αναγνώσεις **πριν** από κάθε γραφή).
 */
function applyPlan(adminDb: AdminFirestore, propertyId: string, request: PropertyHandoverSyncRequest): Promise<AppliedPlan> {
  return adminDb.runTransaction(async (tx) => {
    const state = await readHandoverState(tx, adminDb, propertyId);
    // Ακίνητο που δεν διαβάζεται ⇒ καμία παράδοση του δεν είναι γνωστή — ίδια απάντηση με την ξένη (καμία πληροφορία ύπαρξης).
    if (state === null) return request.withdrawal ? { ...NOTHING_APPLIED, withdrawal: UNKNOWN_WITHDRAWAL } : NOTHING_APPLIED;
    const nowValue = nowISO();
    const reconciled = planPropertyHandovers(state.snapshot, state.existing, nowValue);
    const withdrawal = request.withdrawal === undefined ? null : applyHandoverWithdrawal(
      reconciled, state.existing, state.snapshot, { ...request.withdrawal, performedBy: request.performedBy, nowValue },
    );
    const planned = withdrawal?.writes ?? reconciled;
    const invitations = await stageHandoverInvitations(tx, adminDb, {
      companyId: state.snapshot.companyId, handovers: afterLifecycle(state.existing, planned),
      actorUid: request.performedBy, nowValue, renewal: request.renewal,
    });
    // Το κάτοπτρο **πάνω** στη μετάβαση: ένα `set` ανά έγγραφο, με την τελική του μορφή.
    const lifecycleWrites = planned.map((write) => ({ ...write, after: invitations.mirrored.get(write.after.id) ?? write.after }));
    const projections = await stageDossierProjections(tx, adminDb, lifecycleWrites);

    const handovers = writeHandovers(tx, adminDb, state.existing, lifecycleWrites, invitations.mirrored);
    invitations.commit();
    projections.forEach((commit) => commit());

    const { issued, awaitingConfiguration, renewal } = invitations;
    const mirrorWrites = mirrorOnlyWrites(state.existing, lifecycleWrites, invitations.mirrored);
    return { lifecycleWrites, mirrorWrites, issued, awaitingConfiguration, handovers, renewal, withdrawal: withdrawal?.outcome ?? null };
  });
}

/**
 * **Φ-Δ.5 — τα email ανάκλησης**: η **πράξη** στέλνει για την παράδοση που μόλις ανακάλεσε· το **δίχτυ** ξαναδοκιμάζει
 * ό,τι δεν έγινε δεκτό (`withdrawalNoticeRetryDueOf`: ποτέ μέσα στη χάρη ενός `pending` — αλλιώς διπλό email).
 */
async function deliverWithdrawalNotices(adminDb: AdminFirestore, applied: AppliedPlan, request: PropertyHandoverSyncRequest): Promise<void> {
  const record: HandoverWithdrawalNoticeRecorder = (input) => recordHandoverWithdrawalNotice(adminDb, input);
  const nowValue = nowISO();
  const justWithdrawn = applied.withdrawal?.kind === 'withdrawn' ? request.withdrawal?.handoverId : undefined;
  for (const handover of applied.handovers) {
    const due = handover.id === justWithdrawn || (request.cause === 'reconcile' && withdrawalNoticeRetryDueOf(handover, nowValue));
    if (due) await deliverHandoverWithdrawalNotice(adminDb, handover, record);
  }
}

/**
 * **Μετά το commit**: τα πρώτα email των νέων προσκλήσεων — και, **μόνο** στο νυχτερινό δίχτυ, επανάληψη αποτυχιών και
 * η μία υπενθύμιση (ένα PATCH ακινήτου δεν πληρώνει email τρίτων). Ποτέ δεν πετά.
 */
async function deliverAfterCommit(adminDb: AdminFirestore, applied: AppliedPlan, request: PropertyHandoverSyncRequest): Promise<void> {
  const { cause } = request;
  const record: HandoverDeliveryRecorder = (input) => recordHandoverInvitationDelivery(adminDb, input);
  await deliverIssuedHandoverInvitations(adminDb, applied.issued, record);
  const recordFiles: HandoverFileDeliveryRecorder = (input) => recordHandoverFileDelivery(adminDb, input);
  await deliverDueHandoverFiles(adminDb, applied.handovers, {
    rescanDelivered: CAUSES_RESCANNING_DELIVERED.has(cause), protocolIssuer: request.protocolIssuer,
  }, recordFiles);
  await deliverWithdrawalNotices(adminDb, applied, request);
  if (cause !== 'reconcile') return;
  const fresh = new Set(applied.issued.map(({ invitation }) => invitation.handoverId));
  for (const handover of applied.handovers) {
    if (!fresh.has(handover.id)) await followUpHandoverInvitation(adminDb, handover, record);
  }
}

/**
 * **Συμφιλιώνει** τις παραδόσεις ενός ακινήτου — κύκλο ζωής **και** πρόσκληση αγοραστή. Ιδεμπότητο · ποτέ δεν πετά ·
 * ίχνος μόνο για ό,τι άλλαξε.
 */
export async function syncPropertyHandovers(
  adminDb: AdminFirestore,
  propertyId: string,
  request: PropertyHandoverSyncRequest,
): Promise<PropertyHandoverSyncOutcome> {
  try {
    const applied = await applyPlan(adminDb, propertyId, request);
    const audited = [...applied.lifecycleWrites, ...applied.mirrorWrites];
    await Promise.all(audited.map((write) => recordHandoverWrite(write, request.performedBy)));
    await deliverAfterCommit(adminDb, applied, request);
    const writes = applied.lifecycleWrites.length;
    const invitationWrites = applied.mirrorWrites.length;
    if (writes + invitationWrites > 0) {
      logger.info('Property handovers synced', { propertyId, cause: request.cause, writes, invitations: invitationWrites, issued: applied.issued.length });
    }
    return {
      kind: 'synced', writes, invitationWrites,
      invitationsAwaitingConfiguration: applied.awaitingConfiguration, renewal: applied.renewal, withdrawal: applied.withdrawal,
    };
  } catch (error) {
    logger.error('Property handover sync failed', { propertyId, cause: request.cause, error: getErrorMessage(error) });
    return { kind: 'failed' };
  }
}
