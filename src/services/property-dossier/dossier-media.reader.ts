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
import type { DossierMediaCandidate, DossierMediaRead } from './dossier-media-publication';

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
  const snapshot = await adminDb.collection(COLLECTIONS.PROPERTY_DOSSIERS).doc(dossierId).get();
  const dossier = propertyDossierFromDocument(snapshot.data(), dossierId);
  if (dossier === null || dossier.userId !== ownerUserId) return null;

  const files = await adminDb
    .collection(COLLECTIONS.FILES_PERSONAL)
    .where('userId', '==', dossier.userId)
    .where('entityType', '==', ENTITY_TYPES.PROPERTY_DOSSIER)
    .where('entityId', '==', dossier.id)
    .where('status', '==', FILE_STATUS.READY)
    .get();

  return {
    dossier,
    files: files.docs.map((doc) => ({ ...(doc.data() as DossierMediaCandidate), id: doc.id })),
  };
}
