/**
 * @fileoverview **«ΜΠΟΡΟΥΝ ΑΥΤΑ ΤΑ BYTES ΝΑ ΦΥΓΟΥΝ;»** — ο ΕΝΑΣ κριτής, για **κάθε** κάτοχο αρχείων αγγελίας.
 * @related ADR-841 §7 (Α14 · Α17.7) · ADR-845 Φ4.2β (Ο-9) · ADR-866 Φ1.3 (§2.11)
 * @module lib/listings/listing-file-deliverability
 *
 * 🔴 **ΕΞΗΧΘΗ ΑΠΟ ΤΟ `agency-media-publication` ΣΤΗ Φ1.3, ΚΑΙ Η ΓΡΑΜΜΗ ΤΗΣ ΤΟΜΗΣ ΕΙΝΑΙ Η ΑΠΟΦΑΣΗ.** Ως τότε ο κριτής
 * είχε **έναν** κάτοχο (γραφείο, `entityType: 'property'`). Ο φάκελος του ιδιώτη (`property_dossier`) ρωτά
 * **την ίδια** ερώτηση για τα **δικά του** αρχεία — ίδιες καταστάσεις, ίδιες μορφές, ίδιο ράφι. Ένα δεύτερο σώμα
 * θα ήταν ακριβώς ο sibling clone που ο N.18 έπιασε ήδη μία φορά εδώ (Βήμα Γ).
 *
 * ⚠️ **Εδώ ζει ΜΟΝΟ η καταλληλότητα** (φρουρός #2). Η **εξουσιοδότηση** (φρουρός #1) διαφέρει ανά κάτοχο **και
 * πρέπει να διαφέρει**: το γραφείο ρωτά `classification === 'public'` («επιτρέπεται να φύγει από την εταιρεία;»),
 * ο ιδιώτης ρωτά τη **δήλωση της αγγελίας** (ADR-866 §2.7.4). Η ανεξαρτησία των δύο φρουρών **είναι** η ασφάλεια.
 */

import { FILE_LIFECYCLE_STATES, FILE_STATUS } from '@/config/domain-constants';
import { FILE_TYPE_CONFIG } from '@/config/file-upload-config';
import type { FileRecord } from '@/types/file-record';

/** Το `FileRecord` όσο το χρειάζεται η **καταλληλότητα** — `Pick` του αληθινού συμβολαίου, ώστε μετονομασία να **σπάει** εδώ. */
export type ListingFileCandidate = Pick<
  FileRecord,
  'id' | 'entityType' | 'storagePath' | 'contentType' | 'status' | 'createdAt' | 'lifecycleState' | 'isDeleted'
>;

/**
 * Οι μορφές που ο καθαριστής του ραφιού μπορεί να **αποκωδικοποιήσει**.
 *
 * 🔑 **Δανεικές από το SSoT των ανεβασμάτων** (`FILE_TYPE_CONFIG.image`): μια δεύτερη λίστα θα σήμαινε ότι κάτι που
 * **επιτρέπεται** να ανέβει μπορεί να **μη** δημοσιεύεται ποτέ, χωρίς να το λέει κανείς.
 */
const DECODABLE_IMAGE_TYPES: readonly string[] = FILE_TYPE_CONFIG.image.mimeTypes;

/**
 * Οι μορφές που ο **ψήστης μοντέλου** μπορεί να παραλάβει (ADR-845 Φ4.2β/Βήμα Γ).
 *
 * 🔴 **ΚΑΤΑΦΑΤΙΚΟΣ ΑΔΕΛΦΟΣ, ΠΟΤΕ ΑΡΝΗΣΗ ΤΟΥ {@link DECODABLE_IMAGE_TYPES}**: *«ό,τι δεν είναι εικόνα είναι μοντέλο»*
 * θα ήταν άρνηση πάνω σε λεξιλόγιο που μεγαλώνει — το τρίτο είδος υλικού θα δημοσιευόταν **ως μοντέλο**.
 */
const DELIVERABLE_MODEL_TYPES: readonly string[] = FILE_TYPE_CONFIG.model.mimeTypes;

/**
 * **Ό,τι ισχύει ΑΝΕΞΑΡΤΗΤΑ από το είδος του υλικού** — κάτοχος · ετοιμότητα · ζωή · μονοπάτι.
 *
 * ⚠️ Το `lifecycleState` και το `isDeleted` είναι **δύο** πεδία για μία κατάσταση· ελέγχονται **αμφότερα**: το ένα να
 * λείπει σε παλιό έγγραφο δεν επιτρέπεται να σημαίνει «δημοσίευσέ το».
 *
 * @param entityType — **ποιος** κατέχει τα αρχεία της αγγελίας (`property` γραφείο · `property_dossier` ιδιώτης).
 *   Αρχείο **άλλης** οντότητας δεν φεύγει ποτέ, όποιο κι αν είναι το ερώτημα που το έφερε.
 */
export function isDeliverableListingFile(
  file: ListingFileCandidate,
  entityType: FileRecord['entityType'],
): boolean {
  if (file.entityType !== entityType) return false;
  if (file.status !== FILE_STATUS.READY) return false;
  if (file.isDeleted === true) return false;
  if (file.lifecycleState !== undefined && file.lifecycleState !== FILE_LIFECYCLE_STATES.ACTIVE) return false;
  return typeof file.storagePath === 'string' && file.storagePath.trim() !== '';
}

/**
 * **Φεύγει ως εικόνα;** — καταλληλότητα + αποκωδικοποιήσιμη μορφή. 🔑 Γι' αυτό τα DXF (`application/dxf`) **δεν** είναι
 * θέμα: δεν μπαίνουν σε `<img>`, όσο κι αν κάποιος τα δηλώσει (ADR-841 Α17.7.1).
 */
export function isDeliverableListingImage(
  file: ListingFileCandidate,
  entityType: FileRecord['entityType'],
): boolean {
  return isDeliverableListingFile(file, entityType) && DECODABLE_IMAGE_TYPES.includes(file.contentType);
}

/** **Φεύγει ως 3D μοντέλο;** — ο καταφατικός αδελφός του {@link isDeliverableListingImage} (φράγμα Ο-9). */
export function isDeliverableListingModel(
  file: ListingFileCandidate,
  entityType: FileRecord['entityType'],
): boolean {
  return isDeliverableListingFile(file, entityType) && DELIVERABLE_MODEL_TYPES.includes(file.contentType);
}
