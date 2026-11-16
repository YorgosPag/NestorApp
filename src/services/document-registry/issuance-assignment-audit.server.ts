/**
 * @fileoverview ADR-915 §27 · §45 — το **ιστορικό** μιας πράξης ανάθεσης έκδοσης στην καρτέλα του ακινήτου (ADR-195).
 *   Εξήχθη από τον γραφέα (`issuance-assignments.server.ts`, όριο N.7.1) χωρίς αλλαγή συμπεριφοράς.
 * @module services/document-registry/issuance-assignment-audit.server
 *
 * 🔑 Στάδιο (τιμή καταλόγου) και επαγγελματίας (επαφή + όνομα της στιγμής), σε πεδίο **ανά είδος** — το ΠΕΑ και η
 *    ταυτότητα του ίδιου ακινήτου δεν μπερδεύονται. Γράφεται **μόνο** ό,τι άλλαξε, **μετά** τη συναλλαγή.
 */

import 'server-only';

import type { IssuanceAssignmentRecord, IssuanceStage } from '@/lib/document-validity/issuance-assignment';
// §45.21 — η δήλωση των πεδίων ζει σε κοινό module: τη διαβάζει και η γραμμή Ιστορικού για να φορτώσει τα λεξιλόγια.
import { ISSUANCE_AUDIT_FIELDS, type IssuanceAuditFields } from '@/lib/document-validity/issuance-audit-fields';
import { lastAnsweredDeliveryChangeOf, pendingDeliveryChangeOf } from '@/lib/document-validity/issuance-delivery-change';
import { issuanceDeliveryOf } from '@/lib/document-validity/issuance-delivery-due';
import { currentInspectionContactOf } from '@/lib/document-validity/issuance-inspection-contact';
import { EntityAuditService } from '@/services/entity-audit.service';
import type { IssuanceWrite, IssuanceWriter } from './issuance-assignments.server';

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
  const before = t.previous?.professionalContactId ?? null;
  const after = t.next.professionalContactId;
  if (before !== after) changes.push(contactChange(fields.professional, before, after, names));
  const request = t.next.approvalRequest;
  if (request !== null && request.invitationId !== t.previous?.approvalRequest?.invitationId) {
    changes.push(contactChange(fields.approvalRequest, t.previous?.approvalRequest?.ownerContactId ?? null, request.ownerContactId, names));
  }
  // §45 Φ2 — η προθεσμία είναι ΠΑΡΑΓΟΜΕΝΗ: γράφεται όταν αλλάζει η τρέχουσα (έγκριση προσφοράς · ορισμός · αλλαγή).
  const dueBefore = t.previous === null ? null : issuanceDeliveryOf(t.previous)?.dueOn ?? null;
  const dueAfter = issuanceDeliveryOf(t.next)?.dueOn ?? null;
  if (dueBefore !== dueAfter) changes.push({ field: fields.deliveryDue, oldValue: dueBefore, newValue: dueAfter });
  return [...changes, ...inspectionAuditChangesOf(fields, t, names), ...deliveryChangeAuditOf(fields, t)];
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

/** Ποιος φαίνεται στο ιστορικό — ο άνθρωπος (γραφείου ή μηχανικός με συμμετοχή), ή ο σύνδεσμος (με το όνομα του αποδέκτη του). */
function performerOf(writer: IssuanceWriter): string {
  return writer.kind === 'link' ? `issuance-link:${writer.invitationId}` : writer.uid;
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
    companyId: write.companyId,
  });
}
