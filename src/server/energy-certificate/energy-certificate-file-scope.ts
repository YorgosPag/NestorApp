/**
 * @fileoverview **Πού ζει το ΠΕΑ ενός ακινήτου** — το ΕΝΑ δοχείο για εισαγωγή (ADR-777 §8.96) και για ανάγνωση των
 * γεγονότων του (ADR-915 Φ3β-2).
 * @related `app/api/properties/[id]/energy-certificate-import/route.ts` ·
 *   `app/api/owner-properties/[ownerPropertyId]/energy-certificate-import/route.ts` · `app/api/properties/[id]/route.ts` ·
 *   `services/owner-property/owner-property-energy-certificate.service.ts`
 * @module server/energy-certificate/energy-certificate-file-scope
 *
 * 🔑 **Ένα σημείο, τέσσερις καταναλωτές**: ζούσε inline στις δύο διαδρομές εισαγωγής· οι δύο γραφείς του μπλοκ
 * χρειάζονται **το ίδιο** δοχείο για να διαβάσουν τα γεγονότα του `sourceFileId`. Δύο αντίγραφα θα μπορούσαν να
 * αποκλίνουν σιωπηλά — η εισαγωγή να δέχεται αρχείο που η αξίωση δεν βλέπει (ή το αντίθετο).
 * 🔑 **PDF**: το `sourceFileId` το βάζει **μόνο** η εισαγωγή (`peaPatchOf`), που δέχεται μόνο PDF.
 */

import 'server-only';

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { ENTITY_TYPES } from '@/config/domain-constants';
import { COLLECTIONS } from '@/config/firestore-collections';
import type { DocumentFacts } from '@/lib/document-validity/document-facts';
import type { EnergyCertificate } from '@/lib/energy-certificate/energy-certificate';
import { custodyOf } from '@/lib/owner-property/listing-custody';
import { readContainerDocumentFacts, type ContainerFileScope } from '@/server/files/document-facts-read';
import type { OwnerProperty } from '@/types/owner-property';

export const PEA_CONTENT_TYPE = 'application/pdf';

/**
 * Ακίνητο του γραφείου: τα «Έγγραφα» του ακινήτου. Ο κάτοχος = η εταιρεία της **συνεδρίας**, ακριβώς όπως ανεβάζει
 * η καρτέλα «Έγγραφα» (`usePropertyFilesTab` → `custody: { companyId }`)· την εμβέλεια την κρίνει ο φρουρός μισθωτή.
 */
export function companyPeaFileScope(companyId: string, propertyId: string): ContainerFileScope {
  return {
    fileCollection: COLLECTIONS.FILES,
    container: {
      owner: { kind: 'company', companyId },
      entityType: ENTITY_TYPES.PROPERTY,
      entityId: propertyId,
      contentType: PEA_CONTENT_TYPE,
    },
  };
}

/**
 * Αγγελία ιδιώτη: ο **φάκελος** του ακινήτου (`property_dossier`, `files_personal`, ADR-866). Αγγελία χωρίς φάκελο ή
 * σε χώρο γραφείου ⇒ `entityId: null` ⇒ κανένα αρχείο δεν της ανήκει.
 */
export function ownerPeaFileScope(uid: string, property: OwnerProperty): ContainerFileScope {
  const personal = custodyOf(property).kind === 'personal';
  return {
    fileCollection: COLLECTIONS.FILES_PERSONAL,
    container: {
      owner: { kind: 'personal', userId: uid },
      entityType: ENTITY_TYPES.PROPERTY_DOSSIER,
      entityId: personal ? (property.dossierId ?? null) : null,
      contentType: PEA_CONTENT_TYPE,
    },
  };
}

/** Τα γεγονότα του ΠΕΑ από το οποίο ήρθε το μπλοκ — `null` όταν το μπλοκ δεν δηλώνει πηγή (καμία ανάγνωση). */
export function peaSourceFacts(
  db: AdminFirestore,
  scope: ContainerFileScope,
  certificate: EnergyCertificate,
): Promise<DocumentFacts | null> {
  if (certificate.sourceFileId === null) return Promise.resolve(null);
  return readContainerDocumentFacts(db, scope, certificate.sourceFileId);
}
