/**
 * @fileoverview **«ΠΟΙΑ ΑΡΧΕΙΑ ΤΟΥ ΓΡΑΦΕΙΟΥ ΔΗΜΟΣΙΕΥΟΝΤΑΙ;»** — η μία απάντηση (ADR-841 §7 Α14).
 * @related ADR-841 §7 (Α14.2 · Α14.3 · Α14.4) · lib/owner-property/owner-media-publication
 * @module services/listings/agency-media-publication
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΔΥΟ ΕΡΩΤΗΣΕΙΣ, ΔΥΟ ΦΡΟΥΡΟΙ — και η **ανεξαρτησία** τους ΕΙΝΑΙ η ασφάλεια
 * ────────────────────────────────────────────────────────────────────────────
 *
 *   1. **ΕΞΟΥΣΙΟΔΟΤΗΣΗ** — *«επιτρέπεται να φύγει από την εταιρεία;»*
 *      ⇒ `classification === 'public'`, **ανθρώπινη** πράξη σε υπάρχουσα οθόνη.
 *   2. **ΚΑΤΑΛΛΗΛΟΤΗΤΑ** — *«είναι φωτογραφία του ακινήτου;»*
 *      ⇒ κατηγορία `photos` + αποκωδικοποιήσιμη εικόνα + έτοιμο + όχι στα σκουπίδια.
 *
 * 🔴 **Γιατί ο δεύτερος φρουρός δεν είναι περιττός, ΜΕΤΡΗΜΕΝΑ (Α14.1)**: η ζωντανή
 * `files` έχει **3 κατόψεις DXF**. Είναι **νόμιμα** δημόσια πληροφορία *(δημοσιευμένη
 * οικοδομική άδεια)* — μια μέρα κάποιος **θα** τις σημάνει `public` με απόλυτο δίκιο.
 * Με **έναν** φρουρό, εκείνη η **σωστή** πράξη διακυβέρνησης θα δημοσίευε **κατόψεις
 * στη βιτρίνα**. Ο δρόμος «αυτόματα» απορρίφθηκε ακριβώς γι' αυτό· ένας μόνο φρουρός
 * θα τον ξανάνοιγε από την πίσω πόρτα.
 *
 * 🏆 Είναι ο διαχωρισμός της **RESO** *(το πρότυπο των MLS)*: το `Media` resource κρατά
 * **χωριστά** τα δικαιώματα από την κατηγορία. Δεν τον μιμηθήκαμε — τον βρήκαμε **ήδη
 * μοντελοποιημένο** εδώ, σε δύο πεδία γραμμένα από δύο διαφορετικά ADR *(031 · 191)*.
 *
 * ⛔ **ΚΑΝΕΝΑ νέο πεδίο.** Η σημαία `publicVisibility` που πρότεινε το handoff θα ήταν
 * **δεύτερη απάντηση στο «είναι δημόσιο;»** δίπλα σε πεδίο που ορίζεται αυτολεξεί ως
 * *«can be shared externally (e.g. marketing photos)»*.
 */

import { compareInstantsAsc } from '@/lib/date-local';
import {
  FILE_CATEGORIES,
  FILE_CLASSIFICATIONS,
  FILE_LIFECYCLE_STATES,
  FILE_STATUS,
} from '@/config/domain-constants';
import { FILE_TYPE_CONFIG } from '@/config/file-upload-config';
import { PUBLISHED_MEDIA_LIMIT } from '@/lib/owner-property/owner-media-publication';
import type { FileRecord } from '@/types/file-record';
import type { PublicShelfSource } from '@/services/upload/utils/storage-path-public-shelf';

/**
 * **Το `FileRecord` όσο το χρειάζεται η απόφαση** — και ούτε πεδίο παραπάνω.
 *
 * 🔑 Γράφεται ως `Pick` του **αληθινού** συμβολαίου και όχι ως ελεύθερο σχήμα: αν κάποια
 * μέρα το `classification` μετονομαστεί ή αλλάξει τύπο, αυτό εδώ **σπάει** αντί να
 * συνεχίσει να διαβάζει πεδίο που δεν υπάρχει πια — που είναι ακριβώς ο τρόπος με τον
 * οποίο ένα προαιρετικό πεδίο γίνεται σιωπηλά μόνιμο `undefined`.
 */
export type AgencyMediaCandidate = Pick<
  FileRecord,
  | 'id'
  | 'entityType'
  | 'storagePath'
  | 'category'
  | 'classification'
  | 'contentType'
  | 'status'
  | 'createdAt'
  | 'lifecycleState'
  | 'isDeleted'
>;

/**
 * Οι μορφές που ο καθαριστής του ραφιού μπορεί να **αποκωδικοποιήσει**.
 *
 * 🔑 **Δανεικές από το SSoT των ανεβασμάτων** (`FILE_TYPE_CONFIG.image`) και όχι
 * γραμμένες ξανά εδώ: μια δεύτερη λίστα θα σήμαινε ότι κάτι που **επιτρέπεται** να
 * ανέβει μπορεί να **μη** δημοσιεύεται ποτέ, χωρίς να το λέει κανείς.
 */
const DECODABLE_IMAGE_TYPES: readonly string[] = FILE_TYPE_CONFIG.image.mimeTypes;

/**
 * **Επιτρέπεται αυτό το αρχείο να φύγει από την εταιρεία;** — ο φρουρός #1.
 *
 * ⚠️ **`=== 'public'`, ποτέ «όχι εμπιστευτικό»**: το πεδίο είναι **προαιρετικό** και η
 * προεπιλογή του είναι `internal`. Ό,τι δεν είναι **ρητά** `public` *(απόν, `undefined`,
 * `internal`, `confidential`)* σημαίνει **ιδιωτικό**. Ένας έλεγχος «δεν είναι
 * `confidential`» θα δημοσίευε **κάθε αρχείο που κανείς δεν ταξινόμησε ποτέ** — δηλαδή,
 * σήμερα, **όλα τους**.
 */
export function isPubliclyClassified(file: AgencyMediaCandidate): boolean {
  return file.classification === FILE_CLASSIFICATIONS.PUBLIC;
}

/**
 * **Είναι αυτό φωτογραφία του ακινήτου, έτοιμη και ζωντανή;** — ο φρουρός #2.
 *
 * ⚠️ Το `lifecycleState` και το `isDeleted` είναι **δύο** πεδία για μία κατάσταση *(η
 * ζωντανή βάση έχει και τα δύο σε κάθε έγγραφο)*. Ελέγχονται **αμφότερα**: το ένα να
 * λείπει σε παλιό έγγραφο δεν επιτρέπεται να σημαίνει «δημοσίευσέ το».
 */
export function isPublishableShape(file: AgencyMediaCandidate): boolean {
  if (file.entityType !== 'property') return false;
  if (file.category !== FILE_CATEGORIES.PHOTOS) return false;
  if (file.status !== FILE_STATUS.READY) return false;
  if (file.isDeleted === true) return false;
  if (
    file.lifecycleState !== undefined &&
    file.lifecycleState !== FILE_LIFECYCLE_STATES.ACTIVE
  ) {
    return false;
  }
  if (!DECODABLE_IMAGE_TYPES.includes(file.contentType)) return false;
  return typeof file.storagePath === 'string' && file.storagePath.trim() !== '';
}

/**
 * **Και οι δύο φρουροί.** Η σύζευξη γράφεται **μία** φορά, εδώ.
 */
export function isPublishableAgencyPhoto(file: AgencyMediaCandidate): boolean {
  return isPubliclyClassified(file) && isPublishableShape(file);
}

/**
 * **Η σειρά — ΝΤΕΤΕΡΜΙΝΙΣΤΙΚΗ, και ρητά ΟΧΙ επιλογή ανθρώπου** (Α14.3).
 *
 * 🔴 **Το γραφείο ΔΕΝ έχει πράξη σειράς.** Ο ιδιώτης έχει *(Α2.1: ο πίνακάς του **είναι**
 * η σειρά)*· τα `FileRecord` είναι **σύνολο**, χωρίς κανένα πεδίο σειράς πουθενά. Άρα η
 * σειρά **πρέπει** να αποφασιστεί, και κάθε επιλογή είναι απόφαση κάποιου. ⇒ **Ο-16**:
 * η ουρά δεν είναι «διόρθωσε τη σειρά», είναι **«δώσε στο γραφείο την πράξη»**.
 *
 * ⚠️ **Η Α6.2 απέρριψε τον χρόνο ως κριτήριο σειράς** και **ισχύει ακόμη** — αλλά εκεί
 * υπήρχε **εναλλακτική**. Εδώ οι υποψήφιες ήταν *«χρόνος»* ή *«αλφαβητικά»*, **αμφότερες**
 * ανθρώπινα αυθαίρετες. ⛔ Και **δεν** διαλέχτηκε το `purpose` *(`'exterior'`/`'interior'`)*,
 * παρότι η RESO προτιμά εξωτερική όψη ως πρωτεύουσα: οι τιμές του ζουν στο μητρώο
 * **σημείων εισόδου** και **όχι** στο `PHOTO_PURPOSES` ⇒ κατάταξη με βάση τους θα
 * **εφεύρισκε λεξιλόγιο τομέα** (CHECK 3.73).
 *
 * 🔑 **Ο ντετερμινισμός ΔΕΝ είναι καλλωπισμός**: το ράφι συμφιλιώνεται σε **κάθε**
 * επανασύνθεση. Ασταθής σειρά ⇒ άλλο `gallery` κάθε πέρασμα ⇒ **δημόσια bytes που
 * αναβοσβήνουν** χωρίς να έχει αλλάξει τίποτα. Γι' αυτό υπάρχει και η **ισοπαλία στο
 * `id`**: δύο αρχεία ανεβασμένα στο ίδιο χιλιοστό του δευτερολέπτου δεν επιτρέπεται να
 * αφήνουν τη σειρά τους στην υλοποίηση του `sort`.
 */
export function compareAgencyMediaForPublication(
  a: AgencyMediaCandidate,
  b: AgencyMediaCandidate,
): number {
  const byInstant = compareInstantsAsc(a.createdAt, b.createdAt);
  if (byInstant !== 0) return byInstant;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * **Τα αρχεία που το γραφείο σήμανε δημόσια, σε σταθερή σειρά, κομμένα στο όριο.**
 *
 * 🔑 **Το όριο είναι ΤΟ ΙΔΙΟ με του ιδιώτη** (Α14.4): ο λόγος του είναι η **προσοχή του
 * επισκέπτη** *(Zillow 22–27)* — ιδιότητα εκείνου που **κοιτάζει**, όχι εκείνου που
 * ανέβασε. Δύο αριθμοί θα σήμαιναν ότι η ίδια βιτρίνα κουράζει διαφορετικά ανάλογα με
 * το ποιος δημοσίευσε.
 *
 * ⚠️ Ποτέ bytes και ποτέ URL — **μονοπάτι στον ιδιωτικό κάδο**, ίδιο συμβόλαιο με τον
 * ιδιώτη: ο γραφέας κατεβάζει το πρωτότυπο **ο ίδιος**, ώστε ο καθαρισμός EXIF/GPS να
 * μην μπορεί να παρακαμφθεί από τον καλούντα *(Α12.7)*.
 */
export function publishedAgencyMediaSources(
  files: readonly AgencyMediaCandidate[],
): readonly PublicShelfSource[] {
  return files
    .filter(isPublishableAgencyPhoto)
    .slice()
    .sort(compareAgencyMediaForPublication)
    .slice(0, PUBLISHED_MEDIA_LIMIT)
    .map((file) => ({ privateStoragePath: file.storagePath }));
}
