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
 * Η πρόοδος γράφεται **εδώ** (`recordHandoverFileDelivery`, CAS) — ο εκτελεστής δεν αγγίζει ποτέ τη συλλογή.
 */

import type { Firestore as AdminFirestore, Query, Transaction } from 'firebase-admin/firestore';

import { PROPERTY_HANDOVER_TRACKED_FIELDS } from '@/config/audit-tracked-fields';
import { COLLECTIONS } from '@/config/firestore-collections';
import { nowISO } from '@/lib/date-local';
import { getErrorMessage } from '@/lib/error-utils';
import { HANDOVER_DELIVERY_INLINE_FILE_BUDGET, HANDOVER_DELIVERY_INLINE_HASH_BYTE_BUDGET } from '@/config/property-handover-delivery-policy';
import { fileDeliveryStateOf } from '@/lib/property-handover/handover-delivery-plan';
import {
  planPropertyHandovers,
  propertyHandoverSnapshotOf,
  type PropertyHandoverSnapshot,
  type PropertyHandoverWrite,
} from '@/lib/property-handover/handover-plan';
import { propertyHandoverFromDocument } from '@/lib/property-handover/property-handover-from-document';
import { createModuleLogger } from '@/lib/telemetry';
import {
  deliverHandoverFiles,
  type HandoverFileDeliveryRecorder,
  type HandoverProtocolIssuer,
} from '@/server/property-handover-delivery/handover-delivery.server';
import {
  deliverIssuedHandoverInvitations,
  followUpHandoverInvitation,
  type HandoverDeliveryRecorder,
} from '@/server/property-handover-invitations/handover-invitation-delivery';
import type { MintedHandoverInvitation } from '@/server/property-handover-invitations/handover-invitation-kind';
import { recordTrackedEntityWrite } from '@/services/entity-audit-tracked-write';
import { stagePropertyDossierHandoverProjection } from '@/services/property-dossier/property-dossier-write.service';
import type { PropertyHandover, PropertyHandoverFileDelivery, PropertyHandoverInvitationDelivery } from '@/types/property-handover';
import type { PropertyHandoverProtocolPointer } from '@/types/property-handover-protocol';

import { stageHandoverInvitations } from './property-handover-invitation-stage';

const logger = createModuleLogger('PropertyHandoverWrite');

/** Ποιος ζήτησε τη συμφιλίωση — μόνο για το ημερολόγιο· το αποτέλεσμα **δεν** εξαρτάται από αυτό. */
export type PropertyHandoverSyncCause = 'property-write' | 'legal-phase' | 'acceptance' | 'reconcile';

export interface PropertyHandoverSyncRequest {
  readonly cause: PropertyHandoverSyncCause;
  /** uid του δρώντα — `'system'` για δίχτυ και γραφέα νομικής φάσης χωρίς άνθρωπο. */
  readonly performedBy: string;
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
function storedHandover(handover: PropertyHandover): Omit<PropertyHandover, 'id'> & { readonly fileDeliveryState: string | null } {
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

function handoverDocRef(adminDb: AdminFirestore, handoverId: string) {
  return adminDb.collection(COLLECTIONS.PROPERTY_HANDOVERS).doc(handoverId);
}

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

/**
 * **Η έκβαση ενός email πρόσκλησης στο κάτοπτρο** — CAS: γράφει **μόνο** αν η παράδοση δείχνει ακόμη **αυτή** την
 * πρόσκληση (μια νεότερη έκδοση στο μεταξύ δεν κληρονομεί την έκβαση της παλιάς). Τηλεμετρία παράδοσης, όχι πράξη
 * ανθρώπου ⇒ κανένα ίχνος οντότητας (τα παρακολουθούμενα πεδία είναι κύκλος ζωής και παραλήπτης).
 */
export async function recordHandoverInvitationDelivery(
  adminDb: AdminFirestore,
  input: { readonly handoverId: string; readonly invitationId: string; readonly delivery: PropertyHandoverInvitationDelivery; readonly reminded: boolean },
): Promise<void> {
  const ref = handoverDocRef(adminDb, input.handoverId);
  await adminDb.runTransaction(async (tx) => {
    const link = propertyHandoverFromDocument((await tx.get(ref)).data(), ref.id)?.invitation ?? null;
    if (link === null || link.status !== 'issued' || link.invitationId !== input.invitationId) return;
    const now = nowISO();
    tx.update(ref, {
      'invitation.delivery': input.delivery,
      'invitation.deliveryAttempts': link.deliveryAttempts + 1,
      ...(input.reminded && input.delivery === 'accepted' ? { 'invitation.remindedAt': now } : {}),
      updatedAt: now,
    });
  });
}

/**
 * **Φ-Γ1 — η πρόοδος της αντιγραφής**, στην παράδοση **και** (προβολή, Δ10) στον κύριο φάκελο του αγοραστή, ατομικά.
 * CAS: γράφει **μόνο** αν η παράδοση οφείλει ακόμη αντιγραφή στον **ίδιο** παραλήπτη — μια ανάκληση ή αλλαγή χεριών στο
 * μεταξύ δεν κληρονομεί πρόοδο που δεν της ανήκει. Τεχνική πρόοδος, όχι πράξη ανθρώπου ⇒ κανένα ίχνος οντότητας.
 */
export async function recordHandoverFileDelivery(
  adminDb: AdminFirestore,
  input: { readonly handoverId: string; readonly recipientUserId: string; readonly fileDelivery: PropertyHandoverFileDelivery },
): Promise<void> {
  const ref = handoverDocRef(adminDb, input.handoverId);
  await adminDb.runTransaction(async (tx) => {
    const current = propertyHandoverFromDocument((await tx.get(ref)).data(), ref.id);
    const recipient = current?.recipient ?? null;
    if (current === null || recipient === null || fileDeliveryStateOf(current) === null || recipient.userId !== input.recipientUserId) return;
    const { state, delivered, total } = input.fileDelivery;
    const projection = await stagePropertyDossierHandoverProjection(tx, adminDb, {
      dossierId: recipient.dossierId, userId: recipient.userId, handoverId: current.id,
      handoverLifecycle: current.lifecycle, fileDelivery: { state, delivered, total },
    });
    const after: PropertyHandover = { ...current, fileDelivery: input.fileDelivery, updatedAt: nowISO() };
    tx.update(ref, { fileDelivery: after.fileDelivery, fileDeliveryState: fileDeliveryStateOf(after), updatedAt: after.updatedAt });
    projection.commit();
  });
}

/** Τι περιμένει ο γραφέας του Πρωτοκόλλου να βρει — και τι γράφει αν το βρει (Φ-Γ2 Σ4). */
export interface HandoverProtocolPointerWrite {
  readonly handoverId: string;
  readonly recipientUserId: string;
  /** Το αποτύπωμα που σφραγίστηκε — πρέπει να είναι **ακόμη** το αποτύπωμα της παράδοσης. */
  readonly ledgerDigest: string;
  /** Το πρωτόκολλο που αντικαθίσταται — `null` στην πρώτη αναθεώρηση. Άλλος δείκτης ⇒ κάποιος πρόλαβε. */
  readonly previousProtocolId: string | null;
  readonly pointer: PropertyHandoverProtocolPointer;
}

/** Η γραφή του δείκτη, ετοιμασμένη: ανάγνωση **έγινε**, γραφή στο `commit()` (το Firestore θέλει αναγνώσεις πρώτα). */
export interface HandoverProtocolPointerStage {
  readonly write: PropertyHandoverWrite & { readonly kind: 'update' };
  commit(): void;
}

/**
 * **Φ-Γ2 Σ4 — ο δείκτης στο τελευταίο Πρωτόκολλο**, στην παράδοση **και** (προβολή, Δ10) στον κύριο φάκελο του αγοραστή,
 * μέσα στη συναλλαγή του γραφέα του πρωτοκόλλου. **CAS**: `null` (καμία γραφή) αν η παράδοση **δεν** είναι πια
 * `delivered` με **το ίδιο** αποτύπωμα, στον **ίδιο** παραλήπτη, με **τον ίδιο** προηγούμενο δείκτη — μια συμπλήρωση, μια
 * ανάκληση ή μια ταυτόχρονη έκδοση στο μεταξύ **δεν** κληρονομεί πρωτόκολλο που δεν περιγράφει την αλήθεια της.
 */
export async function stageHandoverProtocolPointer(
  tx: Transaction,
  adminDb: AdminFirestore,
  input: HandoverProtocolPointerWrite,
): Promise<HandoverProtocolPointerStage | null> {
  const ref = handoverDocRef(adminDb, input.handoverId);
  const before = propertyHandoverFromDocument((await tx.get(ref)).data(), ref.id);
  const recipient = before?.recipient ?? null;
  const delivery = before?.fileDelivery ?? null;
  if (before === null || recipient === null || recipient.userId !== input.recipientUserId) return null;
  // Ακυρωμένη (ή πια μη οφειλόμενη) παράδοση **δεν** παίρνει Πρωτόκολλο, όσο «delivered» κι αν έμεινε η πρόοδός της.
  if (fileDeliveryStateOf(before) === null) return null;
  if (delivery?.state !== 'delivered' || delivery.digest !== input.ledgerDigest) return null;
  if ((before.protocol?.protocolId ?? null) !== input.previousProtocolId) return null;
  const { revision, issuedAt, recipientFileId } = input.pointer;
  const projection = await stagePropertyDossierHandoverProjection(tx, adminDb, {
    dossierId: recipient.dossierId, userId: recipient.userId, handoverId: before.id, handoverLifecycle: before.lifecycle,
    protocol: { revision, issuedAt, fileId: recipientFileId },
  });
  const after: PropertyHandover = { ...before, protocol: input.pointer, updatedAt: nowISO() };
  return {
    write: { kind: 'update', before, after },
    commit: () => {
      tx.update(ref, { protocol: after.protocol, updatedAt: after.updatedAt });
      projection.commit();
    },
  };
}

/** Ό,τι έγινε σε μία συναλλαγή — για το ίχνος, τα email και το δίχτυ. */
interface AppliedPlan {
  /** Οι μεταβάσεις κύκλου ζωής (το ίχνος) — με το `after` **όπως γράφτηκε** (μαζί με το κάτοπτρο). */
  readonly lifecycleWrites: readonly PropertyHandoverWrite[];
  /** Πόσες παραδόσεις άλλαξαν **μόνο** κάτοπτρο πρόσκλησης (π.χ. άλλαξε το email της επαφής). */
  readonly mirrorWrites: number;
  readonly issued: readonly MintedHandoverInvitation[];
  readonly awaitingConfiguration: number;
  /** Όλες οι παραδόσεις του ακινήτου, όπως **είναι** μετά το commit. */
  readonly handovers: readonly PropertyHandover[];
}

const NOTHING_APPLIED: AppliedPlan = { lifecycleWrites: [], mirrorWrites: 0, issued: [], awaitingConfiguration: 0, handovers: [] };

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

/** Η συναλλαγή: ανάγνωση → σχέδιο → πρόσκληση → προβολή → εγγραφές (όλες οι αναγνώσεις **πριν** από κάθε γραφή). */
function applyPlan(adminDb: AdminFirestore, propertyId: string, actorUid: string): Promise<AppliedPlan> {
  return adminDb.runTransaction(async (tx) => {
    const state = await readHandoverState(tx, adminDb, propertyId);
    if (state === null) return NOTHING_APPLIED;
    const nowValue = nowISO();
    const planned = planPropertyHandovers(state.snapshot, state.existing, nowValue);
    const invitations = await stageHandoverInvitations(tx, adminDb, {
      companyId: state.snapshot.companyId, handovers: afterLifecycle(state.existing, planned), actorUid, nowValue,
    });
    // Το κάτοπτρο **πάνω** στη μετάβαση: ένα `set` ανά έγγραφο, με την τελική του μορφή.
    const lifecycleWrites = planned.map((write) => ({ ...write, after: invitations.mirrored.get(write.after.id) ?? write.after }));
    const projections = await stageDossierProjections(tx, adminDb, lifecycleWrites);

    const handovers = writeHandovers(tx, adminDb, state.existing, lifecycleWrites, invitations.mirrored);
    invitations.commit();
    projections.forEach((commit) => commit());

    const lifecycleIds = new Set(lifecycleWrites.map((write) => write.after.id));
    const mirrorWrites = [...invitations.mirrored.keys()].filter((id) => !lifecycleIds.has(id)).length;
    return { lifecycleWrites, mirrorWrites, issued: invitations.issued, awaitingConfiguration: invitations.awaitingConfiguration, handovers };
  });
}

/**
 * **Μετά το commit**: τα πρώτα email των νέων προσκλήσεων — και, **μόνο** στο νυχτερινό δίχτυ, επανάληψη αποτυχιών και
 * η μία υπενθύμιση (ένα PATCH ακινήτου δεν πληρώνει email τρίτων). Ποτέ δεν πετά.
 */
async function deliverAfterCommit(adminDb: AdminFirestore, applied: AppliedPlan, request: PropertyHandoverSyncRequest): Promise<void> {
  const { cause } = request;
  const record: HandoverDeliveryRecorder = (input) => recordHandoverInvitationDelivery(adminDb, input);
  await deliverIssuedHandoverInvitations(adminDb, applied.issued, record);
  await deliverDueFiles(adminDb, applied.handovers, request);
  if (cause !== 'reconcile') return;
  const fresh = new Set(applied.issued.map(({ invitation }) => invitation.handoverId));
  for (const handover of applied.handovers) {
    if (!fresh.has(handover.id)) await followUpHandoverInvitation(adminDb, handover, record);
  }
}

/**
 * **Φ-Γ1 — τα αρχεία που οφείλονται**, ένα πρώτο κομμάτι (`HANDOVER_DELIVERY_INLINE_FILE_BUDGET`)· το cron συνεχίζει.
 * Στο νυχτερινό δίχτυ ξανακοιτά και τις **παραδομένες**: ένα νέο παραδοτέο αρχείο (Δ5) φτάνει μόνο του.
 */
async function deliverDueFiles(adminDb: AdminFirestore, handovers: readonly PropertyHandover[], request: PropertyHandoverSyncRequest): Promise<void> {
  const due = handovers.filter((handover) => {
    const state = fileDeliveryStateOf(handover);
    return state !== null && (state !== 'delivered' || request.cause === 'reconcile');
  });
  if (due.length === 0) return;
  const record: HandoverFileDeliveryRecorder = (input) => recordHandoverFileDelivery(adminDb, input);
  const own = request.protocolIssuer === undefined ? await openOwnProtocolRun(adminDb) : null;
  const issue = request.protocolIssuer ?? own?.issue ?? null;
  const budget = { maxFiles: HANDOVER_DELIVERY_INLINE_FILE_BUDGET, deadlineAt: null, maxHashBytes: HANDOVER_DELIVERY_INLINE_HASH_BYTE_BUDGET };
  try {
    for (const handover of due) await deliverHandoverFiles(adminDb, handover, budget, record, issue);
  } finally {
    own?.finish();
  }
}

/**
 * Φ-Γ2 Σ4 — η **δική** της εκτέλεση έκδοσης, για συμφιλίωση χωρίς εκδότη από τον καλούντα. ⚠️ **Δυναμική** εισαγωγή, επίτηδες:
 * (α) ο γραφέας του πρωτοκόλλου εισάγει **αυτό** το αρχείο (δείκτης · ίχνος) — στατική εισαγωγή θα έκλεινε κύκλο·
 * (β) φέρνει jsPDF + pdf-lib + κρυπτογραφία, που **δεν** χρειάζεται κάθε PATCH ακινήτου.
 */
async function openOwnProtocolRun(adminDb: AdminFirestore): Promise<{ readonly issue: HandoverProtocolIssuer; finish(): number }> {
  const { openHandoverProtocolRun } = await import('./property-handover-protocol-write.service');
  return openHandoverProtocolRun(adminDb);
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
    const applied = await applyPlan(adminDb, propertyId, request.performedBy);
    await Promise.all(applied.lifecycleWrites.map((write) => recordHandoverWrite(write, request.performedBy)));
    await deliverAfterCommit(adminDb, applied, request);
    const writes = applied.lifecycleWrites.length;
    if (writes + applied.mirrorWrites > 0) {
      logger.info('Property handovers synced', { propertyId, cause: request.cause, writes, invitations: applied.mirrorWrites, issued: applied.issued.length });
    }
    return { kind: 'synced', writes, invitationWrites: applied.mirrorWrites, invitationsAwaitingConfiguration: applied.awaitingConfiguration };
  } catch (error) {
    logger.error('Property handover sync failed', { propertyId, cause: request.cause, error: getErrorMessage(error) });
    return { kind: 'failed' };
  }
}
