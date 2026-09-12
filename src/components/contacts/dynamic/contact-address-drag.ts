/**
 * @fileoverview Εφαρμογή ενός **επιβεβαιωμένου** συρσίματος στη λίστα διευθύνσεων επαφής.
 * @module components/contacts/dynamic/contact-address-drag
 * @enterprise ADR-332 D27 Βήμα Β-ΙΙ · ADR-319 (θέση 0 = έδρα) · ADR-277 (ιεραρχία μετά από σύρσιμο)
 *
 * Καθαρές συναρτήσεις — ο **ιδιοκτήτης** τους είναι το `use-hq-address-mutations`.
 *
 * 🔴 **Τι διορθώνει (μετρημένο στον κώδικα, 2026-09-11):** το παλιό `applyDragToBranch`
 * (α) μηδένιζε τη διοικητική ιεραρχία **της έδρας** και της έγραφε τη συνοικία του
 * **υποκαταστήματος** σε **κάθε** σύρσιμο υποκαταστήματος, ενώ (β) **δεν** μηδένιζε την ιεραρχία
 * του ίδιου του υποκαταστήματος — μπαγιάτικος δήμος δίπλα σε νέα οδό. Εδώ κάθε εγγραφή
 * καθαρίζει **τη δική της** ιεραρχία, και τα επίπεδα πεδία της έδρας αλλάζουν **μόνο** όταν
 * σύρθηκε η έδρα.
 */

import type { GeoPoint } from '@/types/geo/coordinates';
import type { CompanyAddress, ContactFormData } from '@/types/ContactFormTypes';
import { humanPlacedPatch } from '@/components/shared/addresses/pin-drop';
import { provedHierarchyValue } from '@/components/shared/addresses/address-hierarchy-field-ops';
import { applyContactAddressPosition } from '@/utils/contacts/contact-address-position-view';
import { overwriteAdminHierarchy } from '@/utils/address/administrative-hierarchy';
import { toStoredCountryCode } from '@/utils/address/country-codes';
import type { DragResolvedAddress } from '@/components/contacts/details/contact-pin-drop';
import { hqEntryFromFlatFields } from './addresses-section-form-mapping';

/**
 * Σημείο που επιβεβαίωσε άνθρωπος → η εγγραφή το **δηλώνει** (`source: 'dragged'`) και χάνει τα
 * μπαγιάτικα μεταδεδομένα της μηχανής. Την αποθηκευμένη προέλευση την αποφασίζει ο διακομιστής.
 */
export function withHumanPoint(address: CompanyAddress, point: GeoPoint): CompanyAddress {
  return applyContactAddressPosition(address, humanPlacedPatch(point));
}

/**
 * «Ναι, ενημέρωσε» — το κείμενο της μηχανής **και** το σημείο, σε **μία** εγγραφή. Η ιεραρχία
 * της εγγραφής καθαρίζεται: η μηχανή δίνει ονόματα, όχι ταυτότητες ΕΛΣΤΑΤ.
 *
 * 🔴 **Η χώρα περνά από το σύνορο ταυτότητας** (ADR-332 D27 **Ζ4α**, μετρημένο ζωντανά
 * 2026-09-12): ως σήμερα γραφόταν **ωμή** η ετικέτα του Nominatim ⇒ το υποκατάστημα κρατούσε
 * `country: 'Ελλάδα'` ενώ **όλες** οι άλλες εγγραφές του εγγράφου είχαν `'GR'`. Η σύγκριση
 * περνούσε ήδη από το ίδιο SSoT (`diffAddressFields.comparable`)· **μόνο η γραφή δεν περνούσε**.
 * Άγνωστη χώρα μένει αυτούσια — δες `toStoredCountryCode`.
 *
 * ⚠️ **Η αναφορά «ADR-277» έφυγε επίτηδες**: το ADR-277 είναι *impact guard* και καταγράφει τον
 * μηδενισμό ως **ελάττωμα προς προειδοποίηση** («Map drag μηδενίζει διοικητική ιεραρχία
 * σιωπηλά», §1 #3) — **δεν** τον θεσπίζει. Η φράση είχε αντιγραφεί σε τρία σχόλια και σε κάθε
 * αντιγραφή αποκτούσε κύρος ADR που ποτέ δεν είχε.
 */
export function applyDraggedToContactAddress(
  address: CompanyAddress,
  dragged: DragResolvedAddress,
  point: GeoPoint | null,
): CompanyAddress {
  const pinned = point ? withHumanPoint(address, point) : address;
  return {
    ...pinned,
    ...contactHierarchyPatch(dragged),
    street: dragged.street,
    number: dragged.number,
    postalCode: dragged.postalCode,
    neighborhood: dragged.neighborhood,
    // 🔴 **Ζ4β — Ο ΕΝΑΣ ΙΔΙΟΚΤΗΤΗΣ ΑΝΑ ΠΕΔΙΟ.** Το `region` είναι το **ελεύθερο ταχυδρομικό**
    //    πεδίο και γράφεται **πάντα**, ακόμη κενό: έτσι δεν μπορεί να μείνει μπαγιάτικο από
    //    προηγούμενη τοποθεσία. Το **αποδεδειγμένο** όνομα πάει στο `regionName`, που είναι
    //    το **κανονικό** (πρώτο της αλυσίδας `['regionName','region']`, ADR-772) και γι' αυτό
    //    **νικά στην ανάγνωση**. Ως τη Φάση Β′ γραφόταν η ωμή ετικέτα εδώ **δίπλα σε κενό
    //    `regionName`**, οπότε η ετικέτα της μηχανής **νικούσε σιωπηλά**.
    region: dragged.region,
    country: toStoredCountryCode(dragged.country) ?? toStoredCountryCode(address.country),
  };
}

/**
 * **Η ιεραρχία της εγγραφής: γράψε ό,τι αποδείχθηκε, καθάρισε ό,τι ΔΕΝ αποδείχθηκε.**
 *
 * ═════════════════════════════════════════════════════════════════════════════
 * 🔴 **Ζ4γ** — ως τη Φάση Β′ εδώ εφαρμοζόταν το `COMPANY_ADDRESS_HIERARCHY_CLEARED`
 * **άνευ όρων**, και το αποτέλεσμα ήταν το μετρημένο *«το υποκατάστημα χάνει δήμο»*: νέα οδός
 * από τη μηχανή, **κενή** ιεραρχία δίπλα της. Ο μηδενισμός ήταν **σωστός** όσο δεν είχαμε
 * ταυτότητες *(ADR-277: όνομα μιας περιοχής με ταυτότητα άλλης)* — τώρα **έχουμε**.
 *
 * 🔴 **ΤΟ `?? []` ΕΙΝΑΙ ΑΠΟΦΑΣΗ, ΟΧΙ ΑΜΥΝΤΙΚΟΣ ΘΟΡΥΒΟΣ.** Αυτή η συνάρτηση καλείται **μόνο**
 * όταν ο άνθρωπος επέλεξε «**Ναι, ενημέρωσε**», δηλαδή όταν το κείμενο **αντικαθίσταται**.
 * Εκεί «δεν ρωτήθηκε» *(η ιεραρχία δεν διαβάστηκε)* και «ρωτήθηκα και δεν έμαθα» καταλήγουν
 * στο **ίδιο**: δεν έχουμε απόδειξη για τη **νέα** διεύθυνση ⇒ καθαρίζουμε. Το να
 * κληρονομούσαμε την παλιά ταυτότητα δίπλα σε **νέα οδό** είναι ακριβώς το ελάττωμα του
 * **ADR-277**, και είναι **αόρατο** σε κάθε οθόνη. *(Το «Μόνο η θέση» **δεν** περνά από εδώ
 * — δες `confirmedDragState`: χωρίς `dragged` γράφεται μόνο σημείο.)*
 *
 * 🔑 **Η προβολή γίνεται από τον πίνακα, όχι με το χέρι** *(ADR-772)*: ό,τι το
 * `companyAddress` δεν κρατά *(έξι από τα οκτώ `*Id`)* το πετά **το λεξιλόγιο**.
 * ═════════════════════════════════════════════════════════════════════════════
 */
function contactHierarchyPatch(dragged: DragResolvedAddress): Partial<CompanyAddress> {
  const form = provedHierarchyValue(dragged.admin ?? []);
  const projected = overwriteAdminHierarchy(form, 'form', 'companyAddress') as Partial<CompanyAddress>;

  // 🔴 **Η «Πόλη» ΕΙΝΑΙ το όνομα του οικισμού σε αυτό το δοχείο** — ένα πεδίο, δύο ρόλοι
  //    *(`ADMIN_LEVEL_VOCABULARY.settlement.companyAddress.name = ['city']`)*. Άρα: οικισμός
  //    αποδεδειγμένος ⇒ **όνομα μητρώου**· αλλιώς ⇒ **μένει το κείμενο της μηχανής** και
  //    καθαρίζει **μόνο** το `settlementId`. Άγνοια δικαιολογεί σβήσιμο **ταυτότητας**,
  //    ποτέ σβήσιμο **κειμένου** που είναι ό,τι μόνο έχουμε.
  return { ...projected, city: form.settlementName || dragged.city };
}

/**
 * Η λίστα που γράφει η φόρμα. Επαφή με **μόνο** επίπεδα πεδία υλοποιεί εδώ τη θέση 0 — η θέση
 * χρειάζεται εγγραφή να ζήσει, και τα επίπεδα πεδία δεν έχουν χώρο γι' αυτήν.
 */
export function contactAddressList(formData: ContactFormData): CompanyAddress[] {
  const list = formData.companyAddresses ?? [];
  return list.length > 0 ? [...list] : [hqEntryFromFlatFields(formData)];
}

/** Αντικαθιστά την εγγραφή `index` και ξανασυγχρονίζει τα επίπεδα πεδία από τη θέση 0 (ADR-319). */
export function withContactAddressAt(
  formData: ContactFormData,
  index: number,
  next: CompanyAddress,
): ContactFormData {
  const list = contactAddressList(formData);
  if (index < 0 || index >= list.length) return formData;
  list[index] = next;
  const hq = list[0];
  return {
    ...formData,
    companyAddresses: list,
    street: hq.street,
    streetNumber: hq.number,
    postalCode: hq.postalCode,
    city: hq.city,
  };
}
