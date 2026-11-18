/**
 * @fileoverview ADR-915 §27 · §45 — το **ιστορικό** μιας πράξης ανάθεσης έκδοσης στην καρτέλα του ακινήτου (ADR-195).
 *   Εξήχθη από τον γραφέα (`issuance-assignments.server.ts`, όριο N.7.1) χωρίς αλλαγή συμπεριφοράς.
 * @module services/document-registry/issuance-assignment-audit.server
 *
 * 🔑 Στάδιο (τιμή καταλόγου) και επαγγελματίας (επαφή + όνομα της στιγμής), σε πεδίο **ανά είδος** — το ΠΕΑ και η
 *    ταυτότητα του ίδιου ακινήτου δεν μπερδεύονται. Γράφεται **μόνο** ό,τι άλλαξε, **μετά** τη συναλλαγή.
 */

import 'server-only';

import { advanceStateOf } from '@/lib/document-validity/issuance-advance';
import type { IssuanceAssignmentRecord, IssuanceStage } from '@/lib/document-validity/issuance-assignment';
import { agreedQuoteOf, quoteTotalsOf } from '@/lib/document-validity/issuance-quote';
import { majorFromMinor, MONEY_MINOR_DECIMALS } from '@/lib/money/money';
// §45.21 — η δήλωση των πεδίων ζει σε κοινό module: τη διαβάζει και η γραμμή Ιστορικού για να φορτώσει τα λεξιλόγια.
import { ISSUANCE_AUDIT_FIELDS, type IssuanceAuditFields } from '@/lib/document-validity/issuance-audit-fields';
import { lastAnsweredDeliveryChangeOf, pendingDeliveryChangeOf } from '@/lib/document-validity/issuance-delivery-change';
import { issuanceDeliveryOf } from '@/lib/document-validity/issuance-delivery-due';
import { currentInspectionContactOf } from '@/lib/document-validity/issuance-inspection-contact';
import { professionalReferenceOf } from '@/lib/document-validity/issuance-professional';
import { custodyOnly } from '@/lib/workspace/custody-scope';
import { EntityAuditService } from '@/services/entity-audit.service';
import type { IssuanceWrite, IssuanceWriter } from './issuance-assignments.server';
import { ledgerOwnerOf } from './issuance-ledger';

export interface IssuanceTransition {
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

function auditChangesOf(fields: IssuanceAuditFields, t: IssuanceTransition, names: IssuanceWrite['names']): AuditChange[] {
  // Το στάδιο γράφεται **μόνο** όταν άλλαξε: ένα αίτημα έγκρισης αφήνει το `proposed` ίδιο — «proposed → proposed» είναι θόρυβος.
  const changes: AuditChange[] = t.previousStage === t.nextStage ? [] : [{ field: fields.stage, oldValue: t.previousStage, newValue: t.nextStage }];
  const before = t.previous === null ? null : professionalReferenceOf(t.previous.professional);
  const after = professionalReferenceOf(t.next.professional);
  if (before !== after) changes.push(contactChange(fields.professional, before, after, names));
  const request = t.next.approvalRequest;
  if (request !== null && request.invitationId !== t.previous?.approvalRequest?.invitationId) {
    changes.push(contactChange(fields.approvalRequest, t.previous?.approvalRequest?.ownerContactId ?? null, request.ownerContactId, names));
  }
  // §45 Φ2 — η προθεσμία είναι ΠΑΡΑΓΟΜΕΝΗ: γράφεται όταν αλλάζει η τρέχουσα (έγκριση προσφοράς · ορισμός · αλλαγή).
  const dueBefore = t.previous === null ? null : issuanceDeliveryOf(t.previous)?.dueOn ?? null;
  const dueAfter = issuanceDeliveryOf(t.next)?.dueOn ?? null;
  if (dueBefore !== dueAfter) changes.push({ field: fields.deliveryDue, oldValue: dueBefore, newValue: dueAfter });
  return [...changes, ...inspectionAuditChangesOf(fields, t, names), ...deliveryChangeAuditOf(fields, t), ...moneyAuditChangesOf(fields, t)];
}

/** Ποσό σε λεπτά ⇒ ευρώ με δύο δεκαδικά (`"40.00"`) — ουδέτερο ως προς γλώσσα· `null` = δεν υπάρχει. */
function eurosOf(minor: number | null): string | null {
  return minor === null ? null : majorFromMinor(minor).toFixed(MONEY_MINOR_DECIMALS);
}

/** Τα γεγονότα χρημάτων μιας εγγραφής, όπως τα γράφει το ιστορικό. */
function moneyFactsOf(record: IssuanceAssignmentRecord | null) {
  if (record === null) return { total: null, advance: null, state: null, waiver: null };
  const agreed = agreedQuoteOf(record);
  const state = advanceStateOf(record).kind;
  const funded = record.advanceEvents.find((event) => event.kind === 'funded');
  return {
    total: eurosOf(agreed === null ? null : quoteTotalsOf(agreed).totalMinor),
    advance: eurosOf(agreed?.advance?.amountMinor ?? null),
    state: state === 'none' ? null : state,
    waiver: funded?.kind === 'funded' ? funded.withdrawalWaiverAt : null,
  };
}

/**
 * ADR-943 Φ4 — η συμφωνία σε χρήματα και η προκαταβολή: γράφεται **μόνο** ό,τι άλλαξε. Κλείνει και το κενό §42.6 (ποσά
 * χωρίς πεδίο ιστορικού): η εγκεκριμένη τιμή φαίνεται πλέον στο Ιστορικό του ακινήτου.
 */
function moneyAuditChangesOf(fields: IssuanceAuditFields, t: IssuanceTransition): AuditChange[] {
  const before = moneyFactsOf(t.previous);
  const after = moneyFactsOf(t.next);
  const pairs: readonly (readonly [string, string | null, string | null])[] = [
    [fields.quoteTotal, before.total, after.total],
    [fields.advanceAmount, before.advance, after.advance],
    [fields.advanceState, before.state, after.state],
    [fields.withdrawalWaiver, before.waiver, after.waiver],
  ];
  return pairs.filter(([, oldValue, newValue]) => oldValue !== newValue).map(([field, oldValue, newValue]) => ({ field, oldValue, newValue }));
}

/**
 * §45.20 Φ6γ — το εκκρεμές αίτημα αλλαγής προθεσμίας: γράφεται όταν ανοίγει ή κλείνει (η νέα προθεσμία γράφεται χωριστά).
 * Όταν **κλείνει**, γράφεται και **πώς** (αποδοχή/απόρριψη) και, στην απόρριψη, **γιατί** — αλλιώς τα δύο φαίνονταν ίδια.
 */
function deliveryChangeAuditOf(fields: IssuanceAuditFields, t: IssuanceTransition): AuditChange[] {
  const before = t.previous === null ? null : pendingDeliveryChangeOf(t.previous)?.dueOn ?? null;
  const after = pendingDeliveryChangeOf(t.next)?.dueOn ?? null;
  if (before === after) return [];
  const changes: AuditChange[] = [{ field: fields.deliveryChangeRequest, oldValue: before, newValue: after }];
  const answer = before !== null && after === null ? lastAnsweredDeliveryChangeOf(t.next)?.answer ?? null : null;
  if (answer === null) return changes;
  changes.push({ field: fields.deliveryChangeAnswer, oldValue: null, newValue: answer.outcome });
  if (answer.outcome === 'declined' && answer.reason !== null) {
    changes.push({ field: fields.deliveryChangeDeclineReason, oldValue: null, newValue: answer.reason });
  }
  return changes;
}

/** §45.15 — ο υπεύθυνος αυτοψίας: γράφεται ό,τι άλλαξε (πρόσωπο · ιδιότητα), ποτέ «Χ → Χ». */
function inspectionAuditChangesOf(fields: IssuanceAuditFields, t: IssuanceTransition, names: IssuanceWrite['names']): AuditChange[] {
  const before = t.previous === null ? null : currentInspectionContactOf(t.previous);
  const after = currentInspectionContactOf(t.next);
  if (after === null) return [];
  const changes: AuditChange[] = [];
  if (before?.contactId !== after.contactId) changes.push(contactChange(fields.inspectionContact, before?.contactId ?? null, after.contactId, names));
  if (before?.role !== after.role) changes.push({ field: fields.inspectionRole, oldValue: before?.role ?? null, newValue: after.role });
  return changes;
}

/** Ποιος φαίνεται στο ιστορικό — ο άνθρωπος (γραφείου, μηχανικός με συμμετοχή, ιδιώτης), ή ο σύνδεσμος (με το όνομα του αποδέκτη του). */
function performerOf(writer: IssuanceWriter): string {
  switch (writer.kind) {
    case 'link': return `issuance-link:${writer.invitationId}`;
    // ADR-943 §5.9 — ο δράστης ενός γεγονότος χρημάτων είναι ο πάροχος (`provider:everypay`), όπως στο τιμολόγιο.
    case 'system': return `provider:${writer.provider}`;
    case 'office': case 'engagement': case 'owner': return writer.uid;
  }
}

export async function recordIssuanceAudit(write: IssuanceWrite, transition: IssuanceTransition): Promise<void> {
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
    // ADR-945 Δ1 — το ιστορικό ζει στο ΙΔΙΟ βιβλίο με την ανάθεση (γραφείο ή ιδιώτης), όπως οι δηλώσεις §37.
    ...custodyOnly(ledgerOwnerOf(write.ledger)),
  });
}
