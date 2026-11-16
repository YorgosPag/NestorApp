/**
 * @fileoverview ADR-915 §27 · §45 — το **ιστορικό** μιας πράξης ανάθεσης έκδοσης στην καρτέλα του ακινήτου (ADR-195).
 *   Εξήχθη από τον γραφέα (`issuance-assignments.server.ts`, όριο N.7.1) χωρίς αλλαγή συμπεριφοράς.
 * @module services/document-registry/issuance-assignment-audit.server
 *
 * 🔑 Στάδιο (τιμή καταλόγου) και επαγγελματίας (επαφή + όνομα της στιγμής), σε πεδίο **ανά είδος** — το ΠΕΑ και η
 *    ταυτότητα του ίδιου ακινήτου δεν μπερδεύονται. Γράφεται **μόνο** ό,τι άλλαξε, **μετά** τη συναλλαγή.
 */

import 'server-only';

import type { DocumentKind } from '@/config/document-validity/document-validity';
import type { IssuanceAssignmentRecord, IssuanceStage } from '@/lib/document-validity/issuance-assignment';
import { lastAnsweredDeliveryChangeOf, pendingDeliveryChangeOf } from '@/lib/document-validity/issuance-delivery-change';
import { issuanceDeliveryOf } from '@/lib/document-validity/issuance-delivery-due';
import { currentInspectionContactOf } from '@/lib/document-validity/issuance-inspection-contact';
import { EntityAuditService } from '@/services/entity-audit.service';
import type { IssuanceWrite, IssuanceWriter } from './issuance-assignments.server';

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
  /** §45 Φ2 — η προθεσμία παράδοσης (ISO ημέρα· ο αναγνώστης του ιστορικού τη μορφοποιεί ως ημερομηνία). */
  readonly deliveryDue: string;
  /** §45.15 — ο υπεύθυνος αυτοψίας (επαφή + όνομα της στιγμής) και η ιδιότητά του (κατάλογος `issuance.inspectionRole`). */
  readonly inspectionContact: string;
  readonly inspectionRole: string;
  /** §45.20 Φ6γ — το αίτημα αλλαγής προθεσμίας του μηχανικού: «— → ημέρα» όταν ζητείται · «ημέρα → —» όταν απαντηθεί. */
  readonly deliveryChangeRequest: string;
  /**
   * §45.20 Φ6γ — **η απάντηση** του γραφείου («— → έγινε δεκτό | απορρίφθηκε», κατάλογος `issuance.delivery.change.outcome`)
   * και, στην απόρριψη, η αιτιολογία του. Χωρίς αυτά αποδοχή και απόρριψη γράφονταν ΙΔΙΑ («ημέρα → —»).
   */
  readonly deliveryChangeAnswer: string;
  readonly deliveryChangeDeclineReason: string;
}

export const ISSUANCE_AUDIT_FIELDS: Readonly<Record<DocumentKind, IssuanceAuditFields | null>> = {
  'energy-certificate': {
    stage: 'energyCertificateIssuanceStage', professional: 'energyCertificateIssuer', approvalRequest: 'energyCertificateIssuanceApprovalRequest',
    deliveryDue: 'energyCertificateIssuanceDeliveryDue',
    inspectionContact: 'energyCertificateIssuanceInspectionContact', inspectionRole: 'energyCertificateIssuanceInspectionRole',
    deliveryChangeRequest: 'energyCertificateIssuanceDeliveryChangeRequest',
    deliveryChangeAnswer: 'energyCertificateIssuanceDeliveryChangeAnswer',
    deliveryChangeDeclineReason: 'energyCertificateIssuanceDeliveryChangeDeclineReason',
  },
  'building-identity': {
    stage: 'buildingIdentityIssuanceStage', professional: 'buildingIdentityIssuer', approvalRequest: 'buildingIdentityIssuanceApprovalRequest',
    deliveryDue: 'buildingIdentityIssuanceDeliveryDue',
    inspectionContact: 'buildingIdentityIssuanceInspectionContact', inspectionRole: 'buildingIdentityIssuanceInspectionRole',
    deliveryChangeRequest: 'buildingIdentityIssuanceDeliveryChangeRequest',
    deliveryChangeAnswer: 'buildingIdentityIssuanceDeliveryChangeAnswer',
    deliveryChangeDeclineReason: 'buildingIdentityIssuanceDeliveryChangeDeclineReason',
  },
  'tax-clearance': null,
  'insurance-clearance': null,
  'enfia-certificate': null,
  'electrical-installation': {
    stage: 'electricalInstallationIssuanceStage',
    professional: 'electricalInstallationIssuer',
    approvalRequest: 'electricalInstallationIssuanceApprovalRequest',
    deliveryDue: 'electricalInstallationIssuanceDeliveryDue',
    inspectionContact: 'electricalInstallationIssuanceInspectionContact',
    inspectionRole: 'electricalInstallationIssuanceInspectionRole',
    deliveryChangeRequest: 'electricalInstallationIssuanceDeliveryChangeRequest',
    deliveryChangeAnswer: 'electricalInstallationIssuanceDeliveryChangeAnswer',
    deliveryChangeDeclineReason: 'electricalInstallationIssuanceDeliveryChangeDeclineReason',
  },
};

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
