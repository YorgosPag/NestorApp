/**
 * @fileoverview ADR-915 §26 — ο **ρητός** υπεύθυνος εγγράφων ακινήτου: ο ΕΝΑΣ αναγνώστης και ο ΕΝΑΣ γραφέας του
 *   `document_obligor_designations` (deny-all — μόνο εδώ).
 * @related obligor-designation-schema.ts (σχήμα · ταυτότητα) · lib/document-validity/obligor-lead.ts (η αλυσίδα)
 * @module services/document-registry/obligor-designations.server
 *
 * 🔑 **Ένα έγγραφο ανά (γραφείο, ακίνητο)**, ντετερμινιστικό ⇒ ορισμός = `set`, επαναφορά στην αυτόματη επιλογή =
 *    `delete`, καμία διπλή εγγραφή· ο αναγνώστης δεν ρωτά — ξέρει ήδη τις ταυτότητες (`getAll`).
 * 🔑 **Ξένο ≡ ανύπαρκτο**: έγγραφο με άλλο `companyId` (ή άλλο ακίνητο) δεν διαβάζεται ποτέ ως ορισμός.
 * 🔑 **Ιστορικό στην καρτέλα του ακινήτου** (ADR-195): ποιος όρισε ποιον, πότε — με το όνομα της επαφής **τη στιγμή της
 *    αλλαγής** ως ετικέτα, και την ταυτότητα της επαφής ως τιμή (πρότυπο FK id + label).
 * ⚠️ Μη αναγνώσιμο έγγραφο ⇒ παραλείπεται **και** αναφέρεται — ποτέ μαντεψιά υπευθύνου.
 */

import 'server-only';

import type { Firestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { chunkArray } from '@/lib/array-utils';
import { createModuleLogger } from '@/lib/telemetry';
import { EntityAuditService } from '@/services/entity-audit.service';
import { REGISTRY_GET_ALL_CHUNK, type RegistryPropertyScope } from './document-registry.types';
import { obligorDesignationIdOf, parseObligorDesignation, type DocumentObligorDesignation } from './obligor-designation-schema';

const logger = createModuleLogger('obligor-designations');

/** Το όνομα του πεδίου στο ιστορικό (`audit.fields.documentObligorLead`). */
export const OBLIGOR_LEAD_AUDIT_FIELD = 'documentObligorLead';

function designationsCollection(db: Firestore) {
  return db.collection(COLLECTIONS.DOCUMENT_OBLIGOR_DESIGNATIONS);
}

/** Ακίνητο → ρητή επιλογή, μόνο για τα ζητούμενα ακίνητα του μισθωτή. */
export async function readObligorDesignations(
  db: Firestore,
  companyId: string,
  propertyIds: readonly string[],
): Promise<ReadonlyMap<string, DocumentObligorDesignation>> {
  const designations = new Map<string, DocumentObligorDesignation>();
  for (const group of chunkArray([...new Set(propertyIds)], REGISTRY_GET_ALL_CHUNK)) {
    const refs = group.map((propertyId) => designationsCollection(db).doc(obligorDesignationIdOf(companyId, propertyId)));
    for (const snapshot of await db.getAll(...refs)) {
      if (!snapshot.exists) continue;
      const parsed = parseObligorDesignation(snapshot.data());
      if (parsed === null || parsed.companyId !== companyId) {
        logger.warn('Μη αναγνώσιμος ορισμός υπευθύνου — παραλείφθηκε', { designationId: snapshot.id });
        continue;
      }
      designations.set(parsed.propertyId, parsed);
    }
  }
  return designations;
}

export interface ObligorDesignationWrite {
  readonly companyId: string;
  readonly actorUid: string;
  readonly actorName: string | null;
  readonly property: { readonly id: string; readonly scope: RegistryPropertyScope; readonly name: string | null };
  /** Η νέα ρητή επιλογή· `null` = επαναφορά στην αυτόματη επιλογή (το έγγραφο σβήνεται). */
  readonly nextContactId: string | null;
  /** Ονόματα επαφών τη στιγμή της αλλαγής — ετικέτες του ιστορικού (λείπει ⇒ μόνο η ταυτότητα). */
  readonly names: Readonly<Record<string, string | null>>;
  readonly nowIso: string;
}

export type ObligorDesignationOutcome = 'changed' | 'unchanged';

async function recordDesignationAudit(write: ObligorDesignationWrite, previousContactId: string | null): Promise<void> {
  const { nextContactId, property, names } = write;
  await EntityAuditService.recordChange({
    entityType: property.scope === 'property' ? 'property' : 'owner_property',
    entityId: property.id,
    entityName: property.name,
    action: 'updated',
    changes: [{
      field: OBLIGOR_LEAD_AUDIT_FIELD,
      oldValue: previousContactId,
      newValue: nextContactId,
      oldValueLabel: previousContactId === null ? null : names[previousContactId] ?? null,
      newValueLabel: nextContactId === null ? null : names[nextContactId] ?? null,
    }],
    performedBy: write.actorUid,
    performedByName: write.actorName,
    companyId: write.companyId,
  });
}

/**
 * Ορίζει (ή επαναφέρει) τον υπεύθυνο. Ανάγνωση και εγγραφή στην **ίδια** συναλλαγή: δύο ταυτόχρονες αλλαγές δεν
 * γράφουν ποτέ λάθος «από» στο ιστορικό. Ίδια επιλογή με την τρέχουσα ⇒ καμία εγγραφή, κανένα ίχνος (ιδεμποτές).
 */
export async function writeObligorDesignation(db: Firestore, write: ObligorDesignationWrite): Promise<ObligorDesignationOutcome> {
  const ref = designationsCollection(db).doc(obligorDesignationIdOf(write.companyId, write.property.id));
  const outcome = await db.runTransaction(async (tx) => {
    const current = parseObligorDesignation((await tx.get(ref)).data());
    const previous = current !== null && current.companyId === write.companyId ? current.contactId : null;
    if (previous === write.nextContactId) return { changed: false, previous };
    if (write.nextContactId === null) {
      tx.delete(ref);
    } else {
      const designation: DocumentObligorDesignation = {
        id: ref.id,
        companyId: write.companyId,
        propertyId: write.property.id,
        scope: write.property.scope,
        contactId: write.nextContactId,
        designatedByUid: write.actorUid,
        designatedAt: write.nowIso,
      };
      tx.set(ref, designation);
    }
    return { changed: true, previous };
  });
  if (!outcome.changed) return 'unchanged';
  await recordDesignationAudit(write, outcome.previous);
  return 'changed';
}
