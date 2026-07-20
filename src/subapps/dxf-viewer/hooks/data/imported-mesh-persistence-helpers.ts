/**
 * Imported mesh persistence — καθαρός μετατροπέας doc→entity (ADR-683 Φ3β).
 *
 * Καθρέφτης του `furniture-persistence-helpers.ts`, με **μία κρίσιμη διαφορά**:
 *
 * 🔴 **Δηλώνει το Storage path του κόμβου πριν επιστρέψει την οντότητα.** Το μητρώο του
 * `bim-mesh-url-resolver` είναι in-memory module singleton — μετά από refresh είναι **άδειο**.
 * Ο resolver τότε πέφτει στη σύμβαση της curated βιβλιοθήκης (`bim-mesh-library/imported/…`),
 * path που **δεν υπάρχει** για εισαγόμενα (ζουν σε project-scoped δέντρο). Αποτέλεσμα χωρίς αυτή
 * τη γραμμή: μετά το reload ο χρήστης βλέπει μόνο το placeholder κουτί, για πάντα, χωρίς κανένα
 * σφάλμα πουθενά.
 *
 * Είναι επίσης ο λόγος που ο μετατροπέας **δεν** είναι απλό object literal: έχει μία, σκόπιμη,
 * παρενέργεια — και τεκμηριώνεται ως τέτοια αντί να κρυφτεί.
 *
 * @module hooks/data/imported-mesh-persistence-helpers
 * @see ../../bim-3d/library/bim-mesh-library/imported-mesh-assets — `registerImportedMeshAsset`
 * @see ./furniture-persistence-helpers — ο αδελφός χωρίς εξωτερικό asset
 */

import type { ImportedMeshEntity } from '../../bim/entities/imported-mesh/imported-mesh-types';
import {
  computeImportedMeshGeometry,
  validateImportedMeshParams,
} from '../../bim/entities/imported-mesh/imported-mesh-geometry';
import type { ImportedMeshDoc } from '../../bim/entities/imported-mesh/imported-mesh-firestore-service';
import { registerImportedMeshAsset } from '../../bim-3d/library/bim-mesh-library/imported-mesh-assets';

/** Χτίζει `ImportedMeshEntity` από persisted `ImportedMeshDoc` — και δηλώνει το asset του. */
export function importedMeshDocToEntity(doc: ImportedMeshDoc): ImportedMeshEntity {
  const validation = doc.validation ?? validateImportedMeshParams(doc.params).bimValidation;

  // Η δήλωση γίνεται ΕΔΩ και όχι στον 3Δ converter: ο converter τρέχει ανά καρέ και δεν έχει
  // πρόσβαση στο έγγραφο — μόνο το hydrate ξέρει το πραγματικό `storagePath`.
  if (doc.params.uploadId && doc.params.nodeName && doc.params.storagePath) {
    registerImportedMeshAsset(doc.params.uploadId, doc.params.nodeName, doc.params.storagePath);
  }

  return {
    id: doc.id,
    type: 'imported-mesh',
    kind: 'imported',
    name: doc.name ?? doc.params.nodeName,
    layerId: doc.layerId ?? '0',
    floorId: doc.floorId,
    params: doc.params,
    geometry: doc.geometry ?? computeImportedMeshGeometry(doc.params),
    validation,
    visible: true,
    ifcType: 'IfcBuildingElementProxy',
  } as ImportedMeshEntity;
}
