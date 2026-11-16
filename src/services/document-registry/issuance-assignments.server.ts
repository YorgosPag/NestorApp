/**
 * @fileoverview ADR-915 §27 — η **ανάθεση έκδοσης**: ο ΕΝΑΣ αναγνώστης και ο ΕΝΑΣ γραφέας του
 *   `document_issuance_assignments` (deny-all — μόνο εδώ).
 * @related issuance-assignment-schema.ts (σχήμα · ταυτότητα) · lib/document-validity/issuance-assignment.ts (ο μειωτής)
 * @module services/document-registry/issuance-assignments.server
 *
 * 🔑 **Ο κατάλογος του γραφείου διαβάζεται ΜΙΑ φορά** (`companyId ==`, φραγμένος): από αυτόν βγαίνουν **και** οι τρέχουσες
 *    αναθέσεις των γραμμών **και** οι υποψήφιοι «ξανά» — ένα ερώτημα, μία αλήθεια. Το όριο **λέγεται** (`truncated`).
 * 🔑 **Γραφή σε συναλλαγή με CAS**: ο πελάτης στέλνει το στάδιο που **είδε**· αν άλλαξε στο μεταξύ (άλλος συνεργάτης,
 *    άλλη καρτέλα) ⇒ `stale`, ποτέ σιωπηλή υπερκάλυψη. Ο μειωτής κρίνει πάνω στο **φρέσκο** έγγραφο.
 * 🔑 **Ιστορικό στην καρτέλα του ακινήτου** (ADR-195): στάδιο (τιμή καταλόγου) και επαγγελματίας (επαφή + όνομα τη στιγμή
 *    της αλλαγής), σε πεδίο **ανά είδος** — `issuance-assignment-audit.server.ts`.
 * ⚠️ Μη αναγνώσιμο έγγραφο ⇒ παραλείπεται **και** αναφέρεται — ποτέ μαντεψιά απόφασης.
 */

import 'server-only';

import type { DocumentReference, Firestore, Transaction } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import type { DocumentKind } from '@/config/document-validity/document-validity';
import {
  issuanceStageOf,
  issuanceStateOf,
  reduceIssuance,
  messageOf,
  visibleIssuanceStage,
  type IssuanceAction,
  type IssuanceActor,
  type IssuanceRefusalReason,
  type IssuanceAssignmentRecord,
  type IssuanceStage,
  type LinkVerification,
} from '@/lib/document-validity/issuance-assignment';
import {
  withIssuanceDelivery,
  withObservedDelivery,
  type DeliverySlot,
  type IssuanceDelivery,
  type IssuanceDeliveryOutcome,
  type ObservedDeliveryOutcome,
} from '@/lib/document-validity/issuance-delivery';
import type { IssuanceRosterEntry } from '@/lib/document-validity/issuance-candidates';
import {
  withDeliveryReminderPlan,
  withDeliveryReminderSent,
  withDeliveryRemindersRetired,
  withManualDeliveryReminder,
} from '@/lib/document-validity/issuance-delivery-reminder';
import {
  planIssuanceReminders,
  withIssuanceReminderSent,
  withIssuanceRemindersRetired,
} from '@/lib/document-validity/issuance-reminder';
import { isOwnedByCompany } from '@/lib/auth/tenant-ownership';
import { createModuleLogger } from '@/lib/telemetry';
import { DOCUMENT_REGISTRY_CAPS, type RegistryPropertyScope } from './document-registry.types';
import { recordIssuanceAudit, type IssuanceTransition } from './issuance-assignment-audit.server';
import {
  issuanceAssignmentIdOf,
  issuanceRecordOf,
  parseIssuanceAssignment,
  type DocumentIssuanceAssignment,
} from './issuance-assignment-schema';

const logger = createModuleLogger('issuance-assignments');

/** Βαλβίδα ασφαλείας του καταλόγου, όχι σελιδοποίηση — **μία** τιμή, στο `DOCUMENT_REGISTRY_CAPS`. */
export const ISSUANCE_ROSTER_CAP = DOCUMENT_REGISTRY_CAPS['issuance-assignments'];

function assignmentsCollection(db: Firestore) {
  return db.collection(COLLECTIONS.DOCUMENT_ISSUANCE_ASSIGNMENTS);
}

export interface IssuanceRoster {
  readonly entries: readonly (IssuanceRosterEntry & { readonly assignment: DocumentIssuanceAssignment })[];
  readonly truncated: boolean;
}

/** Όλες οι αναθέσεις του γραφείου (φραγμένα). Ξένο ≡ ανύπαρκτο· χαλασμένο ⇒ παραλείπεται και αναφέρεται. */
export async function readIssuanceRoster(db: Firestore, companyId: string): Promise<IssuanceRoster> {
  const snapshot = await assignmentsCollection(db).where('companyId', '==', companyId).limit(ISSUANCE_ROSTER_CAP).get();
  const entries = snapshot.docs.flatMap((doc) => {
    const assignment = parseIssuanceAssignment(doc.data());
    if (assignment === null || assignment.companyId !== companyId) {
      logger.warn('Μη αναγνώσιμη ανάθεση έκδοσης — παραλείφθηκε', { assignmentId: doc.id });
      return [];
    }
    return [{ propertyId: assignment.propertyId, documentKind: assignment.documentKind, record: issuanceRecordOf(assignment), assignment }];
  });
  return { entries, truncated: snapshot.size >= ISSUANCE_ROSTER_CAP };
}

/**
 * **Ποιος γράφει** (§28 Η-Β2). Το γραφείο φέρνει τη CAS «ό,τι είδε ο άνθρωπος» (`expectedStage`)· ο σύνδεσμος **δεν**
 * φέρνει στάδιο — η CAS του είναι η **δέσμευση** στο τρέχον αίτημα, που την κρίνει ο μειωτής (`actor-refused`).
 */
export type IssuanceWriter =
  | { readonly kind: 'office'; readonly uid: string; readonly name: string | null; readonly expectedStage: IssuanceStage | null }
  /** `verifiedBy` (§29) — τι απέδειξε ο κάτοχος· ο μειωτής το συγκρίνει με ό,τι ζήτησε το αίτημα. */
  | { readonly kind: 'link'; readonly invitationId: string; readonly name: string | null; readonly verifiedBy: LinkVerification }
  /** §45.20 Φ6γ — ο μηχανικός από τη συμμετοχή του (αποδεδειγμένη από τον καλούντα)· CAS όπως το γραφείο. */
  | { readonly kind: 'engagement'; readonly engagementId: string; readonly uid: string; readonly name: string | null; readonly expectedStage: IssuanceStage | null }
  /**
   * ADR-943 §5.9 — ο διακομιστής, **αφού** διάβασε την αλήθεια στο API του παρόχου (Κ-8). **Καμία CAS**: η δέσμευσή του
   * είναι η αναφορά του παρόχου, που την κρίνει ο μειωτής (ιδεμποτία · ποσό · στάδιο). `provider` = ο δράστης στο ίχνος.
   */
  | { readonly kind: 'system'; readonly source: 'payments'; readonly provider: string; readonly name: null };

export interface IssuanceWrite {
  readonly companyId: string;
  readonly writer: IssuanceWriter;
  readonly property: { readonly id: string; readonly scope: RegistryPropertyScope; readonly name: string | null };
  readonly documentKind: DocumentKind;
  /** Το νεότερο έγγραφο του είδους στο ακίνητο (`issuedOn`) — ολοκληρωμένη ανάθεση ≡ καμία. */
  readonly latestIssuedOn: string | null;
  readonly action: IssuanceAction;
  /** Ονόματα επαφών τη στιγμή της αλλαγής — ετικέτες του ιστορικού. */
  readonly names: Readonly<Record<string, string | null>>;
  readonly nowIso: string;
}

export type IssuanceWriteOutcome =
  | { readonly ok: true; readonly outcome: 'changed' | 'unchanged'; readonly stage: IssuanceStage; readonly record: IssuanceAssignmentRecord }
  | { readonly ok: false; readonly refusal: 'stale' | IssuanceRefusalReason };


function storedOf(write: IssuanceWrite, id: string, record: IssuanceAssignmentRecord): DocumentIssuanceAssignment {
  return {
    ...record,
    id,
    companyId: write.companyId,
    propertyId: write.property.id,
    scope: write.property.scope,
    documentKind: write.documentKind,
    updatedAt: write.nowIso,
  };
}

function assignmentRefOf(db: Firestore, companyId: string, propertyId: string, kind: DocumentKind): DocumentReference {
  return assignmentsCollection(db).doc(issuanceAssignmentIdOf(companyId, propertyId, kind));
}

/** Η ανάθεση του μισθωτή μέσα στη συναλλαγή — ξένη ή χαλασμένη ≡ καμία. */
async function readInTx(tx: Transaction, ref: DocumentReference, companyId: string): Promise<IssuanceAssignmentRecord | null> {
  const stored = parseIssuanceAssignment((await tx.get(ref)).data());
  return stored !== null && stored.companyId === companyId ? issuanceRecordOf(stored) : null;
}

/**
 * Μια πράξη **έτοιμη να γραφτεί** μέσα σε συναλλαγή που ανήκει στον καλούντα (§28 Η-Β4): οι αναγνώσεις έγιναν, η κρίση
 * έγινε· το `commit()` γράφει (καλείται **μετά** από κάθε άλλη ανάγνωση της συναλλαγής), το `audit()` **μετά** τη συναλλαγή.
 */
export interface StagedIssuanceWrite {
  readonly outcome: IssuanceWriteOutcome;
  commit(): void;
  audit(): Promise<void>;
}

const NOTHING_TO_WRITE = { commit: (): void => undefined, audit: async (): Promise<void> => undefined };

/** Η CAS του γραφείου και της συμμετοχής — ο σύνδεσμος και το σύστημα δεσμεύονται αλλού (στον μειωτή). */
function casHolds(writer: IssuanceWriter, previousStage: IssuanceStage | null): boolean {
  return writer.kind === 'link' || writer.kind === 'system' || previousStage === writer.expectedStage;
}

function actorOf(writer: IssuanceWriter, nowIso: string): IssuanceActor {
  switch (writer.kind) {
    case 'office': return { kind: 'office', uid: writer.uid, nowIso };
    case 'link': return { kind: 'link', invitationId: writer.invitationId, verifiedBy: writer.verifiedBy, nowIso };
    case 'engagement': return { kind: 'engagement', engagementId: writer.engagementId, uid: writer.uid, nowIso };
    case 'system': return { kind: 'system', source: writer.source, nowIso };
  }
}

/**
 * **Η ΜΙΑ κρίση-και-γραφή** κάθε πράξης ανάθεσης: ανάγνωση → CAS → **ο ίδιος** μειωτής. Τη χρησιμοποιούν η πράξη του
 * γραφείου, η αποστολή με σύνδεσμο (μαζί με την πρόσκληση, στην ίδια συναλλαγή) και η απάντηση από σύνδεσμο.
 */
export async function stageIssuanceAction(tx: Transaction, db: Firestore, write: IssuanceWrite): Promise<StagedIssuanceWrite> {
  const ref = assignmentRefOf(db, write.companyId, write.property.id, write.documentKind);
  const previous = await readInTx(tx, ref, write.companyId);
  const previousStage = visibleIssuanceStage(issuanceStateOf(previous, write.latestIssuedOn));
  if (!casHolds(write.writer, previousStage)) return { outcome: { ok: false, refusal: 'stale' }, ...NOTHING_TO_WRITE };
  const reduced = reduceIssuance(write.documentKind, previous, write.latestIssuedOn, write.action, actorOf(write.writer, write.nowIso));
  if (!reduced.ok) return { outcome: reduced, ...NOTHING_TO_WRITE };
  // §45 Φ3 — νέα προθεσμία (έγκριση · ορισμός · αλλαγή) ⇒ νέο πρόγραμμα υπενθυμίσεων, στην ΙΔΙΑ εγγραφή (proactive).
  const record = reduced.changed ? withDeliveryReminderPlan(reduced.record, write.nowIso) : reduced.record;
  // Το ΠΡΑΓΜΑΤΙΚΟ στάδιο (και κλειστό: `ownerRejected` · `cancelled`) — όχι το ορατό, που για κλειστό είναι `null`.
  const nextStage = issuanceStageOf(record);
  const outcome: IssuanceWriteOutcome = { ok: true, outcome: reduced.changed ? 'changed' : 'unchanged', stage: nextStage, record };
  if (!reduced.changed) return { outcome, ...NOTHING_TO_WRITE };
  const transition: IssuanceTransition = { previous, next: record, previousStage, nextStage };
  return {
    outcome,
    commit: () => { tx.set(ref, storedOf(write, ref.id, record)); },
    audit: () => recordIssuanceAudit(write, transition),
  };
}

/**
 * Εφαρμόζει **μία** πράξη στην ανάθεση (γραφείο, ακίνητο, είδος), σε δική της συναλλαγή· ίδια πρόταση ξανά ⇒
 * `unchanged`, κανένα ίχνος. Το ιστορικό γράφεται **μετά** την επιτυχία.
 */
export async function writeIssuanceAction(db: Firestore, write: IssuanceWrite): Promise<IssuanceWriteOutcome> {
  const staged = await db.runTransaction(async (tx) => {
    const next = await stageIssuanceAction(tx, db, write);
    next.commit();
    return next;
  });
  await staged.audit();
  return staged.outcome;
}

/** Ποια ανάθεση — (γραφείο, ακίνητο, είδος): η ΜΙΑ ταυτότητα. */
export interface IssuanceAssignmentTarget {
  readonly companyId: string;
  readonly propertyId: string;
  readonly documentKind: DocumentKind;
}

/** Ποιο μήνυμα — η ανάθεση και το `invitationId` που τη γέννησε. */
export interface IssuanceMessageTarget extends IssuanceAssignmentTarget {
  readonly invitationId: string;
}

/**
 * **Η τηλεμετρία ενός μηνύματος** (παράδοση §30 · υπενθυμίσεις §31), σε συναλλαγή — ο ΙΔΙΟΣ δρόμος για όλες. Δεν περνά από
 * τον μειωτή και **δεν** γράφει ιστορικό: δεν αλλάζει στάδιο ούτε μπάλα. `update` ⇒ `null` = τίποτα να γραφτεί. Πετά σε βλάβη.
 */
async function updateMessageTelemetry(db: Firestore, target: IssuanceAssignmentTarget, update: (record: IssuanceAssignmentRecord) => IssuanceAssignmentRecord | null): Promise<boolean> {
  const ref = assignmentRefOf(db, target.companyId, target.propertyId, target.documentKind);
  return db.runTransaction(async (tx) => {
    const stored = parseIssuanceAssignment((await tx.get(ref)).data());
    if (stored === null || !isOwnedByCompany(stored, target.companyId)) return false;
    const next = update(issuanceRecordOf(stored));
    if (next === null) return false;
    tx.set(ref, { ...stored, ...next });
    return true;
  });
}

/**
 * **Η παράδοση** (§28 Η-Β9) — μόνο στο μήνυμα που τη γέννησε (CAS στο `invitationId`). Τηλεμετρία, όχι στάδιο. Ποτέ δεν
 * πετά: τα email έχουν ήδη φύγει. §31 — `reminders` ⇒ το πρόγραμμα υπενθυμίσεων ξεκινά **στην ίδια** εγγραφή, και **μόνο**
 * αν ο αποστολέας λέει ότι το μήνυμα έφυγε (`planIssuanceReminders`): ποτέ υπενθύμιση για email που δεν ταξίδεψε.
 */
export async function recordIssuanceDelivery(
  db: Firestore,
  target: IssuanceMessageTarget,
  delivery: IssuanceDelivery,
  reminders: { readonly expiresAt: string } | null = null,
): Promise<boolean> {
  try {
    return await updateMessageTelemetry(db, target, (record) => {
      const delivered = withIssuanceDelivery(record, target.invitationId, delivery);
      if (delivered === null || reminders === null) return delivered;
      return planIssuanceReminders(delivered, target.invitationId, reminders.expiresAt) ?? delivered;
    });
  } catch (error) {
    logger.warn('Η παράδοση του μηνύματος ανάθεσης δεν καταγράφηκε', {
      invitationId: target.invitationId,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

/** §31 — τι απέγινε μια υπενθύμιση: έφυγε (το επόμενο από το ίδιο πρόγραμμα) ή το πρόγραμμα αποσύρεται. */
export type IssuanceReminderChange =
  | { readonly kind: 'sent'; readonly dueAt: string; readonly sentAt: string; readonly expiresAt: string }
  | { readonly kind: 'retired'; readonly dueAt: string };

/**
 * **Μία υπενθύμιση καταγράφεται** (§31) — CAS στο `dueAt` που κρίθηκε: αν στο μεταξύ στάλθηκε νέο μήνυμα ή άλλαξε το
 * πρόγραμμα, δεν γράφεται τίποτα (`false`). ⚠️ **Πετά** σε βλάβη: η σάρωση το μετρά ως αποτυχία, και η επόμενη ξανακρίνει.
 */
export function recordIssuanceReminder(db: Firestore, target: IssuanceMessageTarget, change: IssuanceReminderChange): Promise<boolean> {
  return updateMessageTelemetry(db, target, (record) => (change.kind === 'sent'
    ? withIssuanceReminderSent(record, target.invitationId, change)
    : withIssuanceRemindersRetired(record, target.invitationId, change.dueAt)));
}

/**
 * §45 Φ3 — τι απέγινε μια υπενθύμιση παράδοσης: αυτόματη έφυγε (η επόμενη από το ίδιο πρόγραμμα) · το πρόγραμμα
 * αποσύρεται · χειροκίνητη έφυγε (ποιος, πότε).
 */
export type DeliveryReminderChange =
  | { readonly kind: 'sent'; readonly dueAt: string; readonly sentAt: string }
  | { readonly kind: 'retired'; readonly dueAt: string }
  | { readonly kind: 'manual'; readonly at: string; readonly byUid: string };

/**
 * **Μία υπενθύμιση παράδοσης καταγράφεται** — ο ΙΔΙΟΣ δρόμος τηλεμετρίας με τη §31, με CAS: η αυτόματη στο `dueAt` που
 * κρίθηκε, η χειροκίνητη στην κρίση «όχι δύο την ίδια ημέρα» (ξανατρέχει στη συναλλαγή). `false` = τίποτα δεν γράφτηκε.
 * ⚠️ **Πετά** σε βλάβη: η σάρωση το μετρά ως αποτυχία, η χειροκίνητη το λέει στον άνθρωπο.
 */
export function recordDeliveryReminder(db: Firestore, target: IssuanceAssignmentTarget, change: DeliveryReminderChange): Promise<boolean> {
  return updateMessageTelemetry(db, target, (record) => {
    switch (change.kind) {
      case 'sent': return withDeliveryReminderSent(record, change);
      case 'retired': return withDeliveryRemindersRetired(record, change.dueAt);
      case 'manual': return withManualDeliveryReminder(record, { at: change.at, byUid: change.byUid });
    }
  });
}

/**
 * Τα πεδία ερωτήματος των σαρώσεων — ένα ανά πρόγραμμα· ένα πεδίο, εύρος ⇒ αυτόματος δείκτης, κανένας σύνθετος. Ρητά
 * ονόματα: οι πύλες δεικτών (CHECK 3.15 · 3.91) τα διαβάζουν στατικά.
 */
const REMINDER_DUE_FIELDS = ['approvalRequest.reminders.dueAt', 'notice.reminders.dueAt'] as const;
const DELIVERY_REMINDER_DUE_FIELDS = ['deliveryReminders.dueAt'] as const;

export interface DueAssignments {
  readonly assignments: readonly DocumentIssuanceAssignment[];
  readonly truncated: boolean;
}

/**
 * **Ποιες αναθέσεις οφείλουν υπενθύμιση μηνύματος** (§31) — σε **όλα** τα γραφεία: η σάρωση είναι του συστήματος, όχι
 * χρήστη. Κάθε έγγραφο κρίνεται ξανά με το **δικό** του `companyId` από τον καλούντα. Φραγμένο ανά πεδίο (`limit`).
 */
export function readDueIssuanceReminders(db: Firestore, nowIso: string, limit: number): Promise<DueAssignments> {
  return readAssignmentsDueBy(db, REMINDER_DUE_FIELDS, nowIso, limit);
}

/** **Ποιες αναθέσεις οφείλουν υπενθύμιση παράδοσης** (§45 Φ3) — ίδιο σχήμα με τη §31. */
export function readDueDeliveryReminders(db: Firestore, nowIso: string, limit: number): Promise<DueAssignments> {
  return readAssignmentsDueBy(db, DELIVERY_REMINDER_DUE_FIELDS, nowIso, limit);
}

async function readAssignmentsDueBy(db: Firestore, fields: readonly string[], nowIso: string, limit: number): Promise<DueAssignments> {
  const snapshots = await Promise.all(fields.map((field) => assignmentsCollection(db).where(field, '<=', nowIso).limit(limit).get()));
  const byId = new Map<string, DocumentIssuanceAssignment>();
  for (const doc of snapshots.flatMap((snapshot) => snapshot.docs)) {
    const assignment = parseIssuanceAssignment(doc.data());
    if (assignment === null) logger.warn('Μη αναγνώσιμη ανάθεση έκδοσης στη σάρωση υπενθυμίσεων', { assignmentId: doc.id });
    else byId.set(assignment.id, assignment);
  }
  return { assignments: [...byId.values()], truncated: snapshots.some((snapshot) => snapshot.size >= limit) };
}

export type IssuanceObservationOutcome =
  | { readonly kind: 'recorded'; readonly previous: IssuanceDeliveryOutcome | undefined; readonly next: IssuanceDeliveryOutcome; readonly record: IssuanceAssignmentRecord }
  /** Η ανάθεση δεν υπάρχει πια ή το μήνυμα αντικαταστάθηκε — το γεγονός δεν αφορά κανέναν. */
  | { readonly kind: 'stale' }
  /** Το γεγονός πρόλαβε την αναφορά του αποστολέα — ο πάροχος θα το ξαναστείλει. */
  | { readonly kind: 'not-reported' };

function slotValueOf(record: IssuanceAssignmentRecord, invitationId: string, slot: DeliverySlot): IssuanceDeliveryOutcome | undefined {
  const delivery = messageOf(record, invitationId)?.delivery ?? null;
  if (delivery === null) return undefined;
  return slot.kind === 'recipient' ? delivery.recipient : delivery.coOwners[slot.contactId];
}

/**
 * **Γεγονός παράδοσης του παρόχου** (§30 Η-Δ2) — ο ΙΔΙΟΣ γραφέας, η ΙΔΙΑ αναδίπλωση με την αναφορά του αποστολέα. Ιδεμποτής:
 * το ίδιο γεγονός δεύτερη φορά ⇒ `previous === next`, καμία εγγραφή. ⚠️ **Πετά** σε βλάβη βάσης: ο webhook απαντά 5xx και
 * ο πάροχος ξαναστέλνει — αντίθετα από το `recordIssuanceDelivery`, εδώ η επανάληψη **είναι** η θεραπεία.
 */
export async function recordIssuanceObservation(
  db: Firestore,
  target: { readonly companyId: string; readonly propertyId: string; readonly documentKind: DocumentKind; readonly invitationId: string },
  slot: DeliverySlot,
  outcome: ObservedDeliveryOutcome,
): Promise<IssuanceObservationOutcome> {
  const ref = assignmentRefOf(db, target.companyId, target.propertyId, target.documentKind);
  return db.runTransaction(async (tx): Promise<IssuanceObservationOutcome> => {
    const stored = parseIssuanceAssignment((await tx.get(ref)).data());
    if (stored === null || !isOwnedByCompany(stored, target.companyId)) return { kind: 'stale' };
    const record = issuanceRecordOf(stored);
    if (messageOf(record, target.invitationId) === null) return { kind: 'stale' };
    const next = withObservedDelivery(record, target.invitationId, slot, outcome);
    if (next === null) return { kind: 'not-reported' };
    const previous = slotValueOf(record, target.invitationId, slot);
    const after = slotValueOf(next, target.invitationId, slot) ?? outcome;
    if (previous !== after) tx.set(ref, { ...stored, ...next });
    return { kind: 'recorded', previous, next: after, record: next };
  });
}
