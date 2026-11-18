/**
 * @fileoverview ADR-945 §7.5 — τα **έγγραφα ενός ακινήτου ιδιώτη** στο **δικό του** βιβλίο: η δήλωση ΠΕΑ του μπλοκ
 *   `energy` **και** τα αρχεία του φακέλου του (`files_personal`, ADR-866) με γεγονότα εγγράφου.
 * @related registry-documents.server.ts (`registryDocumentsOf` · `dossierRegistryFileOf` — οι ΙΔΙΟΙ κριτές με το μητρώο
 *   γραφείου) · property-dossier/dossier-media.reader.ts (το ΕΝΑ ερώτημα του φακέλου) ·
 *   server/energy-certificate/energy-certificate-file-scope.ts (`ownerPeaFileScope` — ίδιος κανόνας δοχείου)
 * @module services/document-registry/owner-property-documents.server
 *
 * 🔑 **Ίδια γεγονότα, ίδιος κανόνας με το γραφείο** — καμία δεύτερη μετάφραση «αρχείο ⇒ έγγραφο»: η δήλωση και τα αρχεία
 *    γίνονται γραμμές με το `registryDocumentsOf` (η δήλωση υποχωρεί όταν το αρχείο-πηγή της είναι ήδη γραμμή).
 * 🔒 **Ο κάτοχος ρωτιέται δύο φορές, επίτηδες** (όπως η βιτρίνα, `readDossierMedia`): ο φάκελος πρέπει να είναι του
 *    ιδιώτη που κρατά το βιβλίο, **και** τα αρχεία του κατόχου του φακέλου (το ερώτημα). Φάκελος ξένου ⇒ μόνο η δήλωση.
 * 🔒 **Θεματοφυλακή γραφείου ⇒ κανένα `files_personal`** (`ownerPeaFileScope`: `entityId: null`) — τα αρχεία του
 *    ακινήτου ζουν τότε στο γραφείο, και τα διαβάζει το μητρώο του (`readDocumentRegistry`).
 * ⚠️ **ΠΕΤΑ σε αποτυχία ανάγνωσης**: «κανένα έγγραφο» από βλάβη θα έκανε ολοκληρωμένη ανάθεση να φαίνεται ανοιχτή.
 */

import 'server-only';

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import type { RegistryDocument } from '@/lib/document-validity/document-registry';
import { trimmedStringOrNull } from '@/lib/type-guards';
import type { CustodyScope } from '@/lib/workspace/custody-scope';
import { readDossierReadyFileDocs, readPropertyDossier } from '@/services/property-dossier/dossier-media.reader';
import { dossierRegistryFileOf, registryDocumentsOf, type RegistryFile } from './registry-documents.server';
import type { RegistryProperty } from './registry-properties.server';

/** Τα αρχεία του φακέλου του ακινήτου — μόνο σε προσωπική θεματοφυλακή, μόνο φάκελος **του** ιδιώτη. */
async function readDossierFiles(db: AdminFirestore, property: RegistryProperty, owner: CustodyScope): Promise<readonly RegistryFile[]> {
  const userId = owner.userId ?? null;
  const dossierId = trimmedStringOrNull(property.data.dossierId);
  if (userId === null || dossierId === null) return [];
  const dossier = await readPropertyDossier(db, dossierId);
  if (dossier === null || dossier.userId !== userId) return [];
  const docs = await readDossierReadyFileDocs(db, dossier);
  return docs.flatMap((doc) => {
    const file = dossierRegistryFileOf(doc.id, doc.data, property.id);
    return file === null ? [] : [file];
  });
}

/**
 * Τα έγγραφα του ακινήτου ιδιώτη, όπως θα τα έβλεπε το μητρώο: αρχεία του φακέλου + η δήλωση ΠΕΑ. Το ακίνητο και το
 * βιβλίο έρχονται **από τον κριτή υποκειμένου** (`readUpkeepSubject`), ποτέ από τον καλούντα.
 */
export async function readOwnerPropertyDocuments(
  db: AdminFirestore,
  subject: { readonly property: RegistryProperty; readonly owner: CustodyScope },
): Promise<readonly RegistryDocument[]> {
  const files = await readDossierFiles(db, subject.property, subject.owner);
  return registryDocumentsOf(files, [subject.property], new Map([[subject.property.id, subject.property]]));
}
