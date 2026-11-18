import 'server-only';

/**
 * @fileoverview **Το Ιστορικό της πρόσβασης στον φάκελο ιδιώτη** — ο ΕΝΑΣ γραφέας (ADR-916 Φ-Ε1 · ADR-195).
 * @module services/property-dossier/dossier-access-audit
 * @related `lib/property-dossier/dossier-audit-fields.ts` (τα ονόματα πεδίων — η ίδια δήλωση με τον αναγνώστη)
 *
 * | Πράξη | Δράστης | Ενέργεια | Πεδία |
 * |---|---|---|---|
 * | πρόσκληση · επαναποστολή · ακύρωση | κάτοχος | `updated` | `invitation` |
 * | αποδοχή | επαγγελματίας | `created` | `access` · `accessUntil` · `credential` |
 * | ανάκληση | κάτοχος | `status_changed` | `access` |
 * | ανανέωση · εύρος | κάτοχος | `updated` | `accessUntil` · `reachTab` · `excludedFile` |
 * | άνοιγμα · λήψη αρχείου | επαγγελματίας | `document_accessed` | `documentView` / `documentDownload` |
 *
 * 🔑 **Όλα στον ΦΑΚΕΛΟ** (`property_dossier`, προσωπικό βιβλίο του κατόχου) — όπως η μεταβίβαση γράφει στην υπόθεση και
 *    η έκδοση στο ακίνητο: ο κάτοχος βλέπει **σε μία καρτέλα** ποιος μπήκε, τι άλλαξε και τι άνοιξε (Google Drive Activity ·
 *    Datasite audit), με λέξεις — όχι κλειδιά.
 * 🔑 Αρχεία με **ταυτότητα + λέξη της στιγμής** (`newValue: fileId` · `newValueLabel: όνομα`, ADR-195 FK): μετονομασία
 *    αργότερα δεν ξαναγράφει το παρελθόν, και το id τεκμηριώνει **ποιο** αρχείο.
 * ⛔ **Όχι** «για λογαριασμό ποιου γραφείου» (`actingFor`): η τιμή του είναι αναγνωριστικό γραφείου, που στον ιδιώτη δεν
 *    λέει τίποτα· ο άνθρωπος φαίνεται ως δράστης της γραμμής.
 */

import type { CaseFileMode } from '@/lib/conveyance/case-activity';
import { DOSSIER_ACCESS_AUDIT_FIELDS, type DossierAccessAuditFields } from '@/lib/property-dossier/dossier-audit-fields';
import { answerChanges } from '@/services/conveyance/conveyance-engagement-support';
import { EntityAuditService } from '@/services/entity-audit.service';
import type { AuditAction, AuditFieldChange } from '@/types/audit-trail';
import type { DossierEngagement, DossierEngagementRole } from '@/types/engagement';

/** Ο φάκελος της γραμμής: ταυτότητα · κάτοχος (= το βιβλίο) · όνομα της στιγμής (αν διαβάστηκε). */
export interface DossierAuditTarget {
  readonly id: string;
  readonly userId: string;
  readonly label: string | null;
}

/** Ο δράστης: uid + email· το όνομα το λύνει η υπηρεσία ιστορικού από το προφίλ («Όνομα (email)»). */
export interface DossierAuditActor {
  readonly uid: string;
  readonly email: string | null;
}

async function recordOnDossier(
  dossier: DossierAuditTarget,
  actor: DossierAuditActor,
  action: AuditAction,
  changes: readonly AuditFieldChange[],
): Promise<string | null> {
  if (changes.length === 0) return null;
  return EntityAuditService.recordChange({
    entityType: 'property_dossier',
    entityId: dossier.id,
    entityName: dossier.label,
    action,
    changes: [...changes],
    performedBy: actor.uid,
    performedByName: actor.email,
    userId: dossier.userId,
  });
}

// =============================================================================
// ΠΡΟΣΚΛΗΣΗ
// =============================================================================

/** Τι έγινε στην πρόσκληση — η τιμή ζει στον κατάλογο `property-market:dossier.access.audit.invitation`. */
export type DossierInvitationAuditEvent =
  | { readonly kind: 'invited' | 'resent'; readonly email: string }
  | { readonly kind: 'revoked' };

/** `invited:<email>` ⇒ «προσκλήθηκε · <email>» (ταυτότητα με είδος, ίδια μορφή με την πρόσκληση της έκδοσης). */
function invitationValueOf(event: DossierInvitationAuditEvent): string {
  return event.kind === 'revoked' ? event.kind : `${event.kind}:${event.email}`;
}

export async function recordDossierInvitationAudit(
  dossier: DossierAuditTarget,
  actor: DossierAuditActor,
  role: DossierEngagementRole,
  event: DossierInvitationAuditEvent,
): Promise<void> {
  const field = DOSSIER_ACCESS_AUDIT_FIELDS[role].invitation;
  await recordOnDossier(dossier, actor, 'updated', [{ field, oldValue: null, newValue: invitationValueOf(event) }]);
}

// =============================================================================
// ΑΠΟΔΟΧΗ · ΑΛΛΑΓΕΣ ΤΟΥ ΚΑΤΟΧΟΥ
// =============================================================================

/** Τα πεδία της **απάντησης** (κοινά με τη μεταβίβαση, `answerChanges`) → τα πεδία του φακέλου. `null` ⇒ δεν γράφεται. */
const ANSWER_FIELD: Readonly<Record<string, keyof DossierAccessAuditFields | null>> = {
  state: 'access',
  declaredCredential: 'credential',
  actingFor: null,
};

function answerOnDossier(fields: DossierAccessAuditFields, engagement: DossierEngagement): AuditFieldChange[] {
  return answerChanges(null, engagement).flatMap((change) => {
    const key = ANSWER_FIELD[change.field];
    return key ? [{ ...change, field: fields[key] }] : [];
  });
}

/** Ο επαγγελματίας **ανέλαβε**: κατάσταση · λήξη · δηλωμένη ιδιότητα, με εκείνον ως δράστη. */
export async function recordDossierAccessAccepted(
  dossier: DossierAuditTarget,
  actor: DossierAuditActor,
  engagement: DossierEngagement,
): Promise<void> {
  const fields = DOSSIER_ACCESS_AUDIT_FIELDS[engagement.role];
  await recordOnDossier(dossier, actor, 'created', [
    ...answerOnDossier(fields, engagement),
    { field: fields.accessUntil, oldValue: null, newValue: engagement.expiresAt },
  ]);
}

/**
 * Μία γραμμή ανά στοιχείο που μπήκε (`— → x`) ή βγήκε (`x → —`)· η σειρά του πίνακα δεν είναι αλλαγή. Με `names`
 * (αρχεία) η λέξη της στιγμής πάει στο `*ValueLabel`· χωρίς (καρτέλες) τη λύνει ο κατάλογος του πεδίου.
 */
function setDiff(field: string, before: readonly string[], after: readonly string[], names?: ReadonlyMap<string, string>): AuditFieldChange[] {
  const added = after.filter((id) => !before.includes(id)).map((id): AuditFieldChange => ({
    field, oldValue: null, newValue: id, ...(names ? { newValueLabel: names.get(id) ?? null } : {}),
  }));
  const removed = before.filter((id) => !after.includes(id)).map((id): AuditFieldChange => ({
    field, oldValue: id, newValue: null, ...(names ? { oldValueLabel: names.get(id) ?? null } : {}),
  }));
  return [...added, ...removed];
}

/** Οι αλλαγές μιας πράξης κατόχου — **μόνο** ό,τι άλλαξε πραγματικά. */
export function dossierAccessChanges(
  before: DossierEngagement,
  after: DossierEngagement,
  fileNames: ReadonlyMap<string, string>,
): AuditFieldChange[] {
  const fields = DOSSIER_ACCESS_AUDIT_FIELDS[after.role];
  const scalar: AuditFieldChange[] = [
    { field: fields.access, oldValue: before.state, newValue: after.state },
    { field: fields.accessUntil, oldValue: before.expiresAt, newValue: after.expiresAt },
  ];
  return [
    ...scalar.filter((change) => change.oldValue !== change.newValue),
    ...setDiff(fields.reachTab, before.reach.tabs, after.reach.tabs),
    ...setDiff(fields.excludedFile, before.reach.excludedFileIds, after.reach.excludedFileIds, fileNames),
  ];
}

/** Τα αρχεία που μπήκαν ή βγήκαν από τις εξαιρέσεις — `[]` ⇒ δεν χρειάζεται ανάγνωση ονομάτων. */
export function touchedExclusions(before: DossierEngagement, after: DossierEngagement): string[] {
  const was = before.reach.excludedFileIds;
  const now = after.reach.excludedFileIds;
  return [...now.filter((id) => !was.includes(id)), ...was.filter((id) => !now.includes(id))];
}

/** Ανάκληση · ανανέωση · εύρος — μία γραμμή, με τον κάτοχο ως δράστη. */
export async function recordDossierAccessChanged(
  dossier: DossierAuditTarget,
  actor: DossierAuditActor,
  action: AuditAction,
  changes: readonly AuditFieldChange[],
): Promise<void> {
  await recordOnDossier(dossier, actor, action, changes);
}

// =============================================================================
// ΑΝΟΙΓΜΑΤΑ ΑΡΧΕΙΩΝ
// =============================================================================

/**
 * Ένα άνοιγμα, μία γραμμή στο Ιστορικό του φακέλου (DocuSign «Viewed» · Datasite). **Ρίχνει** αν δεν γράφτηκε: ο
 * σύνδεσμος δίνεται **μόνο** αφού υπάρχει ίχνος (`signAndRecordOpening` ⇒ `failed`).
 */
export async function recordDossierDocumentOpened(
  dossier: DossierAuditTarget,
  actor: DossierAuditActor,
  opening: { readonly role: DossierEngagementRole; readonly mode: CaseFileMode; readonly fileId: string; readonly fileName: string },
): Promise<void> {
  const fields = DOSSIER_ACCESS_AUDIT_FIELDS[opening.role];
  const field = opening.mode === 'view' ? fields.documentView : fields.documentDownload;
  const auditId = await recordOnDossier(dossier, actor, 'document_accessed', [
    { field, oldValue: null, newValue: opening.fileId, newValueLabel: opening.fileName },
  ]);
  if (auditId === null) throw new Error(`dossier document access not recorded for ${opening.fileId}`);
}
