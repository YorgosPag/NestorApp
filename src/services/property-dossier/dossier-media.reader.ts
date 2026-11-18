/**
 * @fileoverview **Η ΑΝΑΓΝΩΣΗ ΤΟΥ ΦΑΚΕΛΟΥ ΓΙΑ ΤΗ ΔΗΜΟΣΙΕΥΣΗ** — ο φάκελος + τα έτοιμα αρχεία του, από τον διακομιστή.
 * @related ADR-866 Φ1.3 (§2.11) · services/listings/agency-media.reader (ο αδελφός του γραφείου)
 * @module services/property-dossier/dossier-media.reader
 *
 * 🔑 **Το ερώτημα έχει ΗΔΗ δείκτη**: `files_personal` (`entityId` · `entityType` · `status` · `userId`) — ο ίδιος που
 * σερβίρει τη σελίδα του φακέλου. Η εμβέλεια καρτέλας κρίνεται **στη μνήμη** (`dossierMediaMaterial`), όπως στον
 * πελάτη (`readQueryNarrowing`) ⇒ **καμία** νέα μορφή ερωτήματος, κανένα deploy δεικτών (CHECK 3.15 · 3.91).
 *
 * 🔴 **Ο ΚΑΤΟΧΟΣ ΡΩΤΙΕΤΑΙ ΔΥΟ ΦΟΡΕΣ, ΕΠΙΤΗΔΕΣ**: ο φάκελος πρέπει να ανήκει στον κάτοχο της αγγελίας, **και** τα
 * αρχεία να ανήκουν στον κάτοχο του φακέλου. Φάκελος ξένου χρήστη ⇒ `null` — ποτέ αρχεία άλλου στη βιτρίνα.
 *
 * ⚠️ **ΠΕΤΑ σε αποτυχία ανάγνωσης, δεν απαντά «κενό»**: μια σιωπηλή κενή απάντηση θα έσβηνε τη βιτρίνα της αγγελίας
 * σε μια παροδική βλάβη δικτύου. Ο καλών (`republishOwnerListing`) το μετρά ως `failed` ⇒ η προηγούμενη προβολή
 * μένει **άθικτη** — ίδιο συμβόλαιο με την ανάγνωση της ταυτότητας γραφείου (ADR-841 Α22).
 */

import 'server-only';

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { ENTITY_TYPES, FILE_STATUS } from '@/config/domain-constants';
import { propertyDossierFromDocument } from '@/lib/property-dossier/property-dossier-from-document';
import type { FileRecord } from '@/types/file-record';
import type { PropertyDossier } from '@/types/property-dossier';
import type { DossierMediaCandidate, DossierMediaRead } from './dossier-media-publication';

/** Ο φάκελος — ή `null` αν δεν υπάρχει / δεν διαβάζεται. **Χωρίς** κρίση κατόχου: την κάνει ο καλών. */
export async function readPropertyDossier(adminDb: AdminFirestore, dossierId: string): Promise<PropertyDossier | null> {
  const snapshot = await adminDb.collection(COLLECTIONS.PROPERTY_DOSSIERS).doc(dossierId).get();
  return propertyDossierFromDocument(snapshot.data(), dossierId);
}

/** Ένα έτοιμο αρχείο του φακέλου — + τα πεδία ονόματος, για όποιον το δείχνει σε άνθρωπο (ADR-916 Φ-Ε1). */
export type DossierReadyFile = DossierMediaCandidate & Pick<FileRecord, 'displayName' | 'originalFilename'>;

/**
 * Τα **έτοιμα** αρχεία του φακέλου, στο βιβλίο **του κατόχου του** — ο ίδιος δείκτης με τη σελίδα του φακέλου.
 * Τον μοιράζονται η βιτρίνα (ADR-866 Φ1.3) και ο επαγγελματίας του φακέλου (ADR-916 Φ-Ε1): μία ανάγνωση, όχι δύο.
 */
export async function readDossierReadyFiles(
  adminDb: AdminFirestore,
  dossier: Pick<PropertyDossier, 'id' | 'userId'>,
): Promise<readonly DossierReadyFile[]> {
  const files = await readDossierReadyFileDocs(adminDb, dossier);
  return files.map((file) => ({ ...(file.data as DossierReadyFile), id: file.id }));
}

/** Ένα έτοιμο αρχείο του φακέλου **ωμό** — για όποιον κρίνει μόνος του το έγγραφο (π.χ. τα γεγονότα εγγράφου, ADR-945). */
export interface DossierFileDoc {
  readonly id: string;
  readonly data: Readonly<Record<string, unknown>>;
}

/**
 * **Το ΕΝΑ ερώτημα** των έτοιμων αρχείων του φακέλου — ο ίδιος δείκτης με τη σελίδα του φακέλου. Το μοιράζονται η
 * προβολή της βιτρίνας ({@link readDossierReadyFiles}) και τα έγγραφα του ακινήτου ιδιώτη (ADR-945 §7.5).
 */
export async function readDossierReadyFileDocs(
  adminDb: AdminFirestore,
  dossier: Pick<PropertyDossier, 'id' | 'userId'>,
): Promise<readonly DossierFileDoc[]> {
  const files = await adminDb
    .collection(COLLECTIONS.FILES_PERSONAL)
    .where('userId', '==', dossier.userId)
    .where('entityType', '==', ENTITY_TYPES.PROPERTY_DOSSIER)
    .where('entityId', '==', dossier.id)
    .where('status', '==', FILE_STATUS.READY)
    .get();
  return files.docs.map((doc) => ({ id: doc.id, data: doc.data() }));
}

/**
 * Διαβάζει τον φάκελο **και** τα έτοιμα αρχεία του — ή `null` αν ο φάκελος δεν υπάρχει / δεν ανήκει στον `ownerUserId`.
 *
 * @param ownerUserId — ο κάτοχος της **αγγελίας** (`authorUserId`)· ο φάκελος οφείλει να είναι δικός του.
 */
export async function readDossierMedia(
  adminDb: AdminFirestore,
  dossierId: string,
  ownerUserId: string,
): Promise<DossierMediaRead | null> {
  const dossier = await readPropertyDossier(adminDb, dossierId);
  if (dossier === null || dossier.userId !== ownerUserId) return null;
  return { dossier, files: await readDossierReadyFiles(adminDb, dossier) };
}
