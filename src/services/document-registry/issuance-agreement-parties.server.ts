import 'server-only';

/**
 * @fileoverview ADR-915 §45.15 — **με ποιον κλείνει την αυτοψία, και ποιοι είναι οι ιδιοκτήτες** — ό,τι χρειάζεται ο
 *   επαγγελματίας για το έντυπο, μέσα στον χώρο μιας αναληφθείσας ανάθεσης.
 * @related issuance-engagement-host-adapter.ts (`agreementOf` — μόνο σε `accepted`) ·
 *   lib/document-validity/issuance-inspection-contact.ts (ο ορισμός) · document-registry.service.ts (οι ιδιοκτήτες)
 * @module services/document-registry/issuance-agreement-parties.server
 *
 * 🔑 **Καμία δεύτερη αλήθεια**: οι ιδιοκτήτες είναι ό,τι λέει ο **ίδιος** αναγνώστης του μητρώου (`ownerContactIds`,
 *    §26 Ζ5)· όνομα, τηλέφωνο και ΑΦΜ είναι της επαφής **τώρα** (`readOwnedContactDocs` — ξένη επαφή ≡ ανύπαρκτη).
 * 🔑 **Αποτυχία ⇒ `null`, ποτέ μαντεψιά**: η όψη λέει «δεν διαβάστηκαν», όχι «κανένας ιδιοκτήτης».
 */

import type { Firestore } from 'firebase-admin/firestore';

import { currentInspectionContactOf } from '@/lib/document-validity/issuance-inspection-contact';
import { trimmedStringOrNull } from '@/lib/type-guards';
import { extractContactDisplayName, extractContactPrimaryPhone, extractContactVatNumber } from '@/server/lib/contact-doc-fields';
import { readOwnedContactDocs } from '@/server/lib/owned-contact-docs';
import { createModuleLogger } from '@/lib/telemetry';
import type { InspectionContactView, IssuanceOwnerView } from '@/types/my-engagements';

import { readDocumentRegistry } from './document-registry.service';
import { issuanceRecordOf, type DocumentIssuanceAssignment } from './issuance-assignment-schema';

const logger = createModuleLogger('issuance-agreement-parties');

export interface IssuanceAgreementParties {
  readonly inspectionContact: InspectionContactView | null;
  readonly owners: readonly IssuanceOwnerView[] | null;
}

/** Οι ιδιοκτήτες του ακινήτου κατά τον αναγνώστη του μητρώου — `null` = δεν διαβάστηκαν τώρα. */
async function ownerContactIdsOf(db: Firestore, assignment: DocumentIssuanceAssignment, now: Date): Promise<readonly string[] | null> {
  try {
    const registry = await readDocumentRegistry(db, assignment.companyId, now);
    return registry.properties[assignment.propertyId]?.ownerContactIds ?? [];
  } catch (error) {
    logger.warn('Οι ιδιοκτήτες της ανάθεσης δεν διαβάστηκαν', { assignmentId: assignment.id, error });
    return null;
  }
}

function inspectionViewOf(
  entry: ReturnType<typeof currentInspectionContactOf>,
  docs: ReadonlyMap<string, FirebaseFirestore.DocumentData>,
): InspectionContactView | null {
  if (entry === null) return null;
  const data = docs.get(entry.contactId);
  return {
    name: data ? trimmedStringOrNull(extractContactDisplayName(data)) : null,
    phone: data ? extractContactPrimaryPhone(data) : null,
    role: entry.role,
    roleOther: entry.roleOther,
  };
}

/** Ο υπεύθυνος αυτοψίας + οι ιδιοκτήτες με ΑΦΜ — **ένα** batch επαφών για όλους. */
export async function readIssuanceAgreementParties(db: Firestore, assignment: DocumentIssuanceAssignment, now: Date): Promise<IssuanceAgreementParties> {
  const entry = currentInspectionContactOf(issuanceRecordOf(assignment));
  const ownerIds = await ownerContactIdsOf(db, assignment, now);
  const wanted = [...new Set([...(ownerIds ?? []), ...(entry === null ? [] : [entry.contactId])])];
  const docs = wanted.length === 0 ? new Map<string, FirebaseFirestore.DocumentData>() : await readOwnedContactDocs(db, assignment.companyId, wanted).catch(() => null);
  if (docs === null) return { inspectionContact: entry === null ? null : inspectionViewOf(entry, new Map()), owners: null };
  const owners = ownerIds?.map((id) => {
    const data = docs.get(id);
    return { name: data ? trimmedStringOrNull(extractContactDisplayName(data)) : null, vatNumber: data ? extractContactVatNumber(data) : null };
  }) ?? null;
  return { inspectionContact: inspectionViewOf(entry, docs), owners };
}
