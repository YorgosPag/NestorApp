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
 *    της αλλαγής), σε πεδίο **ανά είδος** — το ΠΕΑ και η ταυτότητα του ίδιου ακινήτου δεν μπερδεύονται.
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
  planIssuanceReminders,
  withIssuanceReminderSent,
  withIssuanceRemindersRetired,
} from '@/lib/document-validity/issuance-reminder';
import { isOwnedByCompany } from '@/lib/auth/tenant-ownership';
import { createModuleLogger } from '@/lib/telemetry';
import { EntityAuditService } from '@/services/entity-audit.service';
import { DOCUMENT_REGISTRY_CAPS, type RegistryPropertyScope } from './document-registry.types';
import {
  issuanceAssignmentIdOf,
  issuanceRecordOf,
  parseIssuanceAssignment,
  type DocumentIssuanceAssignment,
} from './issuance-assignment-schema';

const logger = createModuleLogger('issuance-assignments');

/** Βαλβίδα ασφαλείας του καταλόγου, όχι σελιδοποίηση — **μία** τιμή, στο `DOCUMENT_REGISTRY_CAPS`. */
export const ISSUANCE_ROSTER_CAP = DOCUMENT_REGISTRY_CAPS['issuance-assignments'];

/**
 * Το πεδίο του ιστορικού ανά είδος — `null` για είδη αρχής (δεν ανατίθενται). Τα ονόματα ζουν στο
 * `common-audit:audit.fields.*` και οι τιμές σταδίου στον κατάλογο `document-registry:issuance.stage`.
 */
/** Τα πεδία του ιστορικού **ενός** είδους (ονόματα στο `common-audit:audit.fields.*`). */
export interface IssuanceAuditFields {
  readonly stage: string;
  readonly professional: string;
  /** §28 — σε ποιον υπεύθυνο στάλθηκε σύνδεσμος έγκρισης (επαφή + όνομα της στιγμής). */
  readonly approvalRequest: string;
}

export const ISSUANCE_AUDIT_FIELDS: Readonly<Record<DocumentKind, IssuanceAuditFields | null>> = {
  'energy-certificate': {
    stage: 'energyCertificateIssuanceStage', professional: 'energyCertificateIssuer', approvalRequest: 'energyCertificateIssuanceApprovalRequest',
  },
  'building-identity': {
    stage: 'buildingIdentityIssuanceStage', professional: 'buildingIdentityIssuer', approvalRequest: 'buildingIdentityIssuanceApprovalRequest',
  },
  'tax-clearance': null,
  'insurance-clearance': null,
  'enfia-certificate': null,
  'electrical-installation': {
    stage: 'electricalInstallationIssuanceStage',
    professional: 'electricalInstallationIssuer',
    approvalRequest: 'electricalInstallationIssuanceApprovalRequest',
  },
};

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
  | { readonly kind: 'link'; readonly invitationId: string; readonly name: string | null; readonly verifiedBy: LinkVerification };

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

interface Transition {
  readonly previous: IssuanceAssignmentRecord | null;
  readonly next: IssuanceAssignmentRecord;
  readonly previousStage: IssuanceStage | null;
  readonly nextStage: IssuanceStage;
}

interface AuditChange {
  readonly field: string;
  readonly oldValue: string | null;
  readonly newValue: string | null;
  readonly oldValueLabel?: string | null;
  readonly newValueLabel?: string | null;
}

/** Μια αλλαγή επαφής στο ιστορικό — ταυτότητα + το όνομα **της στιγμής**. */
function contactChange(field: string, before: string | null, after: string, names: IssuanceWrite['names']): AuditChange {
  return { field, oldValue: before, newValue: after, oldValueLabel: before === null ? null : names[before] ?? null, newValueLabel: names[after] ?? null };
}

function auditChangesOf(fields: IssuanceAuditFields, t: Transition, names: IssuanceWrite['names']): AuditChange[] {
  // Το στάδιο γράφεται **μόνο** όταν άλλαξε: ένα αίτημα έγκρισης αφήνει το `proposed` ίδιο — «proposed → proposed» είναι θόρυβος.
  const changes: AuditChange[] = t.previousStage === t.nextStage ? [] : [{ field: fields.stage, oldValue: t.previousStage, newValue: t.nextStage }];
  const before = t.previous?.professionalContactId ?? null;
  const after = t.next.professionalContactId;
  if (before !== after) changes.push(contactChange(fields.professional, before, after, names));
  const request = t.next.approvalRequest;
  if (request !== null && request.invitationId !== t.previous?.approvalRequest?.invitationId) {
    changes.push(contactChange(fields.approvalRequest, t.previous?.approvalRequest?.ownerContactId ?? null, request.ownerContactId, names));
  }
  return changes;
}

/** Ποιος φαίνεται στο ιστορικό — ο άνθρωπος του γραφείου, ή ο σύνδεσμος (με το όνομα του αποδέκτη του). */
function performerOf(writer: IssuanceWriter): string {
  return writer.kind === 'office' ? writer.uid : `issuance-link:${writer.invitationId}`;
}

async function recordIssuanceAudit(write: IssuanceWrite, transition: Transition): Promise<void> {
  const fields = ISSUANCE_AUDIT_FIELDS[write.documentKind];
  if (fields === null) return;
  const changes = auditChangesOf(fields, transition, write.names);
  if (changes.length === 0) return;
  await EntityAuditService.recordChange({
    entityType: write.property.scope === 'property' ? 'property' : 'owner_property',
    entityId: write.property.id,
    entityName: write.property.name,
    action: 'updated',
    changes,
    performedBy: performerOf(write.writer),
    performedByName: write.writer.name,
    companyId: write.companyId,
  });
}

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

/** Η CAS του γραφείου — ο σύνδεσμος δεσμεύεται αλλού (στον μειωτή, στο τρέχον αίτημα). */
function casHolds(writer: IssuanceWriter, previousStage: IssuanceStage | null): boolean {
  return writer.kind === 'link' || previousStage === writer.expectedStage;
}

function actorOf(writer: IssuanceWriter, nowIso: string): IssuanceActor {
  return writer.kind === 'office' ? { kind: 'office', uid: writer.uid, nowIso } : { kind: 'link', invitationId: writer.invitationId, verifiedBy: writer.verifiedBy, nowIso };
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
  // Το ΠΡΑΓΜΑΤΙΚΟ στάδιο (και κλειστό: `ownerRejected` · `cancelled`) — όχι το ορατό, που για κλειστό είναι `null`.
  const nextStage = issuanceStageOf(reduced.record);
  const outcome: IssuanceWriteOutcome = { ok: true, outcome: reduced.changed ? 'changed' : 'unchanged', stage: nextStage, record: reduced.record };
  if (!reduced.changed) return { outcome, ...NOTHING_TO_WRITE };
  const transition: Transition = { previous, next: reduced.record, previousStage, nextStage };
  return {
    outcome,
    commit: () => { tx.set(ref, storedOf(write, ref.id, reduced.record)); },
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

/** Ποιο μήνυμα — η ανάθεση (γραφείο, ακίνητο, είδος) και το `invitationId` που τη γέννησε. */
export interface IssuanceMessageTarget {
  readonly companyId: string;
  readonly propertyId: string;
  readonly documentKind: DocumentKind;
  readonly invitationId: string;
}

/**
 * **Η τηλεμετρία ενός μηνύματος** (παράδοση §30 · υπενθυμίσεις §31), σε συναλλαγή — ο ΙΔΙΟΣ δρόμος για όλες. Δεν περνά από
 * τον μειωτή και **δεν** γράφει ιστορικό: δεν αλλάζει στάδιο ούτε μπάλα. `update` ⇒ `null` = τίποτα να γραφτεί. Πετά σε βλάβη.
 */
async function updateMessageTelemetry(db: Firestore, target: IssuanceMessageTarget, update: (record: IssuanceAssignmentRecord) => IssuanceAssignmentRecord | null): Promise<boolean> {
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

/** Τα πεδία ερωτήματος της σάρωσης — ένα ανά είδος μηνύματος· ένα πεδίο, εύρος ⇒ αυτόματος δείκτης, κανένας σύνθετος. */
const REMINDER_DUE_FIELDS = ['approvalRequest.reminders.dueAt', 'notice.reminders.dueAt'] as const;

/**
 * **Ποιες αναθέσεις οφείλουν υπενθύμιση** (§31) — σε **όλα** τα γραφεία: η σάρωση είναι του συστήματος, όχι χρήστη. Κάθε
 * έγγραφο κρίνεται ξανά με το **δικό** του `companyId` από τον καλούντα. Φραγμένο ανά πεδίο (`limit`)· `truncated` το λέει.
 */
export async function readDueIssuanceReminders(db: Firestore, nowIso: string, limit: number): Promise<{ readonly assignments: readonly DocumentIssuanceAssignment[]; readonly truncated: boolean }> {
  const snapshots = await Promise.all(REMINDER_DUE_FIELDS.map((field) => assignmentsCollection(db).where(field, '<=', nowIso).limit(limit).get()));
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
