/**
 * =============================================================================
 * ΚΕΝΗ ΔΙΕΥΘΥΝΣΗ ΕΠΑΦΗΣ — ένα κατηγόρημα, ένας κανόνας κλαδέματος (ADR-332 D20)
 * =============================================================================
 *
 * ΤΙ ΔΙΟΡΘΩΝΕΙ
 *  Η «ALFA ΚΑΤΑΣΚΕΥΑΣΤΙΚΗ Α.Ε.» (δοκιμαστική εγγραφή)
 * βρέθηκε στη βάση με ολότελα κενή έδρα, σε **δύο** σημεία ταυτόχρονα:
 *
 * ```
 * addresses[0]                     = {street:"", number:"", city:"", postalCode:"",
 *                                     country:"GR", type:"work", label:"headquarters"}
 * customFields.companyAddresses[0] = {type:"headquarters", street:"", number:"",
 *                                     city:"", postalCode:""}
 * ```
 *
 * **Δεν την πρόσθεσε χρήστης — τη συνθέτει ο κώδικας και τη γράφει αυτούσια.**
 * Τρεις παραγωγοί εντοπίστηκαν (ADR-332 D20):
 *   A. «Νέα Διεύθυνση» έβαζε **αμέσως** κενό αντικείμενο στο `formData`.
 *   B. Η συνθετική κενή έδρα του `AddressesSectionWithFullscreen` (placeholder
 *      για το render) **έρρεε** στο `onChange` και γραφόταν.
 *   C. Παλαιά ήδη μολυσμένα έγγραφα.
 *
 * Το A και το B κλείνουν στην πηγή τους· αυτό το module είναι η **δικλείδα** για
 * το C — και το ασφαλιστικό για κάθε μελλοντικό τέταρτο παραγωγό.
 *
 * ΠΟΥ ΕΦΑΡΜΟΖΕΤΑΙ
 * Στο **form→domain** όριο (`EnterpriseContactSaver.convertToEnterpriseStructure`),
 * όπου η αυθεντική λίστα και το παράγωγο `addresses[]` γεννιούνται από την **ίδια**
 * πηγή ⇒ ένα κλάδεμα καθαρίζει **και τους δύο** πίνακες. Κλάδεμα μόνο στο παράγωγο
 * θα άφηνε την κενή γραμμή στη φόρμα, να ξαναγράφεται στο επόμενο save.
 *
 * ⛔ **ΟΧΙ** στους `sanitizeContactData` / `sanitizeContactForUpdate`
 * (`utils/contactForm/utils/data-cleaning.ts`) — είναι η διόρθωση D18.1 και το
 * αρχείο φέρει ρητές προειδοποιήσεις «ΜΗ ΑΓΓΙΖΕΙΣ».
 *
 * ΤΙ **ΔΕΝ** ΚΑΝΕΙ
 * Δεν μπλοκάρει κανένα save και δεν εμφανίζει σφάλμα. **Μερικώς** συμπληρωμένες
 * διευθύνσεις είναι θεμιτά δεδομένα — ο κόσμος έχει ελλιπή στοιχεία.
 *
 * @module utils/contacts/contact-address-blankness
 * @see ADR-332 D20 — κενές διευθύνσεις δεν φτάνουν στη βάση
 * @see ADR-319 — θετική αναλλοίωτη: η έδρα ζει πάντα στη θέση 0
 */

import type { AddressInfo } from '@/types/contacts';
import type { CompanyAddress } from '@/types/ContactFormTypes';

/**
 * Κάθε μορφή διεύθυνσης επαφής που μπορεί να ρωτηθεί «είσαι κενή;».
 *
 * ⚠️ Είναι **δύο** σχήματα με **δύο** λεξιλόγια για την ίδια ιεραρχία
 * (`CompanyAddress.municipalityName` ↔ `AddressInfo.municipality`, βλ. τον πίνακα
 * προβολής στο `address-info-builder`). Το **ερώτημα** όμως είναι ΕΝΑ — γι' αυτό
 * υπάρχει ένα κατηγόρημα και όχι δύο. Δύο συναρτήσεις θα διαφωνούσαν σιωπηλά για
 * το τι μετράει ως περιεχόμενο, ακριβώς η κατηγορία ADR-584 που βλέπει μόνο το jscpd.
 */
export type ContactAddressLike = CompanyAddress | AddressInfo;

/**
 * Τα πεδία που μετρούν ως **περιεχόμενο** διεύθυνσης — ένωση και των δύο λεξιλογίων.
 *
 * ⚠️ `type`, `customLabel`, `label`, `isPrimary` και `country` **δεν**
 * περιλαμβάνονται σκόπιμα: είναι ταξινόμηση και ετικέτα, όχι τοποθεσία. Η κενή
 * εγγραφή που βρέθηκε στη βάση έφερε `country:"GR"` και `type:"work"` — αν
 * μετρούσαν, θα περνούσε ως «γεμάτη» και η δικλείδα θα ήταν διακοσμητική.
 *
 * Τα `settlementId` / `municipalityId` **περιλαμβάνονται**: ταυτότητα διοικητικής
 * ιεραρχίας είναι πραγματική γεωγραφική πληροφορία, ακόμη κι όταν το αντίστοιχο
 * όνομα λείπει. Το κλάδεμα δεν επιτρέπεται να πετάξει δεδομένο που δεν κατάλαβε.
 */
const ADDRESS_CONTENT_FIELDS = [
  // Κοινά και στα δύο σχήματα
  'street',
  'number',
  'postalCode',
  'city',
  'region',
  'neighborhood',
  'settlementId',
  'municipalityId',
  // Λεξιλόγιο `CompanyAddress` (φόρμα)
  'communityName',
  'municipalUnitName',
  'municipalityName',
  'regionalUnitName',
  'regionName',
  'decentAdminName',
  'majorGeoName',
  // Λεξιλόγιο `AddressInfo` (αποθηκευμένο παράγωγο)
  'settlement',
  'community',
  'municipalUnit',
  'municipality',
  'regionalUnit',
  'decentAdmin',
  'majorGeo',
] as const satisfies readonly (keyof CompanyAddress | keyof AddressInfo)[];

/**
 * Είναι η διεύθυνση **ολότελα** κενή;
 *
 * «Κενή» = καμία τιμή σε **κανένα** πεδίο περιεχομένου. Ένα και μόνο γεμάτο πεδίο
 * αρκεί για να θεωρηθεί υπαρκτή — μερικώς συμπληρωμένες διευθύνσεις επιβιώνουν.
 *
 * Δέχεται **και τα δύο** σχήματα (φόρμα και αποθηκευμένο παράγωγο): πεδία που δεν
 * υπάρχουν στο ένα λεξιλόγιο είναι απλώς `undefined` εκεί.
 *
 * @param address - Η εγγραφή προς έλεγχο.
 * @returns `true` μόνο όταν δεν υπάρχει καμία απολύτως τοποθεσιακή πληροφορία.
 */
export function isBlankContactAddress(address: ContactAddressLike): boolean {
  const record = address as Record<string, unknown>;

  return ADDRESS_CONTENT_FIELDS.every(field => {
    const value = record[field];
    if (value === null || value === undefined) return true;
    return typeof value === 'string' ? value.trim().length === 0 : false;
  });
}

/**
 * Κλαδεύει τις κενές εγγραφές, **σεβόμενο τη θετική αναλλοίωτη του ADR-319**.
 *
 * Ο κανόνας δεν είναι «πέτα ό,τι είναι κενό»:
 * - **Υποκαταστήματα** (θέσεις ≥ 1): κάθε κενό φεύγει.
 * - **Έδρα** (θέση 0): φεύγει **μόνο** αν δεν απομένει κανένα υποκατάστημα.
 *
 * Ο λόγος για τη δεύτερη γραμμή: η φόρμα διαβάζει τη θέση 0 **ως έδρα** και τη
 * συγχρονίζει με τα flat πεδία. Αν πετούσαμε μια κενή έδρα ενώ υπάρχει
 * υποκατάστημα, το υποκατάστημα θα ανέβαινε στη θέση 0 και θα εμφανιζόταν ως
 * έδρα στο επόμενο άνοιγμα — παλινδρόμηση χειρότερη από την κενή γραμμή.
 *
 * Ιδεμποτεντικό: δεύτερη κλήση στο αποτέλεσμα επιστρέφει το ίδιο αποτέλεσμα.
 *
 * @param addresses - Η αυθεντική λίστα της φόρμας.
 * @returns Νέα λίστα χωρίς κενές εγγραφές — ή κενή λίστα όταν δεν έμεινε τίποτα.
 */
export function pruneBlankContactAddresses(
  addresses: readonly CompanyAddress[],
): CompanyAddress[] {
  if (addresses.length === 0) return [];

  const [headquarters, ...branches] = addresses;
  const keptBranches = branches.filter(branch => !isBlankContactAddress(branch));

  if (isBlankContactAddress(headquarters) && keptBranches.length === 0) {
    return [];
  }

  return [headquarters, ...keptBranches];
}
