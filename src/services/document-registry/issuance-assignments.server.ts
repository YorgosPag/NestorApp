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

import type { Firestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import type { DocumentKind } from '@/config/document-validity/document-validity';
import {
  issuanceStageOf,
  issuanceStateOf,
  reduceIssuance,
  visibleIssuanceStage,
  type IssuanceAction,
  type IssuanceAssignmentRecord,
  type IssuanceRosterEntry,
  type IssuanceStage,
} from '@/lib/document-validity/issuance-assignment';
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
export const ISSUANCE_AUDIT_FIELDS: Readonly<Record<DocumentKind, { readonly stage: string; readonly professional: string } | null>> = {
  'energy-certificate': { stage: 'energyCertificateIssuanceStage', professional: 'energyCertificateIssuer' },
  'building-identity': { stage: 'buildingIdentityIssuanceStage', professional: 'buildingIdentityIssuer' },
  'tax-clearance': null,
  'insurance-clearance': null,
  'enfia-certificate': null,
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

export interface IssuanceWrite {
  readonly companyId: string;
  readonly actorUid: string;
  readonly actorName: string | null;
  readonly property: { readonly id: string; readonly scope: RegistryPropertyScope; readonly name: string | null };
  readonly documentKind: DocumentKind;
  /** Το νεότερο έγγραφο του είδους στο ακίνητο (`issuedOn`) — ολοκληρωμένη ανάθεση ≡ καμία. */
  readonly latestIssuedOn: string | null;
  /** Το στάδιο που **είδε** ο άνθρωπος (`null` = καμία ενεργή ανάθεση) — η CAS. */
  readonly expectedStage: IssuanceStage | null;
  readonly action: IssuanceAction;
  /** Ονόματα επαφών τη στιγμή της αλλαγής — ετικέτες του ιστορικού. */
  readonly names: Readonly<Record<string, string | null>>;
  readonly nowIso: string;
}

export type IssuanceWriteOutcome =
  | { readonly ok: true; readonly outcome: 'changed' | 'unchanged'; readonly stage: IssuanceStage }
  | { readonly ok: false; readonly refusal: 'stale' | 'transition-refused' | 'unqualified' };

interface Transition {
  readonly previous: IssuanceAssignmentRecord | null;
  readonly next: IssuanceAssignmentRecord;
  readonly previousStage: IssuanceStage | null;
  readonly nextStage: IssuanceStage;
}

function auditChangesOf(fields: { readonly stage: string; readonly professional: string }, t: Transition, names: IssuanceWrite['names']) {
  const changes = [{ field: fields.stage, oldValue: t.previousStage, newValue: t.nextStage }];
  const before = t.previous?.professionalContactId ?? null;
  const after = t.next.professionalContactId;
  if (before === after) return changes;
  return [...changes, {
    field: fields.professional,
    oldValue: before,
    newValue: after,
    oldValueLabel: before === null ? null : names[before] ?? null,
    newValueLabel: names[after] ?? null,
  }];
}

async function recordIssuanceAudit(write: IssuanceWrite, transition: Transition): Promise<void> {
  const fields = ISSUANCE_AUDIT_FIELDS[write.documentKind];
  if (fields === null) return;
  await EntityAuditService.recordChange({
    entityType: write.property.scope === 'property' ? 'property' : 'owner_property',
    entityId: write.property.id,
    entityName: write.property.name,
    action: 'updated',
    changes: auditChangesOf(fields, transition, write.names),
    performedBy: write.actorUid,
    performedByName: write.actorName,
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

/**
 * Εφαρμόζει **μία** πράξη στην ανάθεση (γραφείο, ακίνητο, είδος). Ανάγνωση, CAS, κρίση και εγγραφή στην **ίδια**
 * συναλλαγή· ίδια πρόταση ξανά ⇒ `unchanged`, κανένα ίχνος. Το ιστορικό γράφεται **μετά** την επιτυχία.
 */
export async function writeIssuanceAction(db: Firestore, write: IssuanceWrite): Promise<IssuanceWriteOutcome> {
  const ref = assignmentsCollection(db).doc(issuanceAssignmentIdOf(write.companyId, write.property.id, write.documentKind));
  const result = await db.runTransaction(async (tx) => {
    const stored = parseIssuanceAssignment((await tx.get(ref)).data());
    const previous = stored !== null && stored.companyId === write.companyId ? issuanceRecordOf(stored) : null;
    const previousStage = visibleIssuanceStage(issuanceStateOf(previous, write.latestIssuedOn));
    if (previousStage !== write.expectedStage) return { ok: false as const, refusal: 'stale' as const };
    const reduced = reduceIssuance(write.documentKind, previous, write.latestIssuedOn, write.action, { uid: write.actorUid, nowIso: write.nowIso });
    if (!reduced.ok) return reduced;
    // Το ΠΡΑΓΜΑΤΙΚΟ στάδιο (και κλειστό: `ownerRejected` · `cancelled`) — όχι το ορατό, που για κλειστό είναι `null`.
    const nextStage = issuanceStageOf(reduced.record);
    if (reduced.changed) tx.set(ref, storedOf(write, ref.id, reduced.record));
    return { ok: true as const, changed: reduced.changed, transition: { previous, next: reduced.record, previousStage, nextStage } };
  });
  if (!result.ok) return result;
  if (result.changed) await recordIssuanceAudit(write, result.transition);
  return { ok: true, outcome: result.changed ? 'changed' : 'unchanged', stage: result.transition.nextStage };
}
