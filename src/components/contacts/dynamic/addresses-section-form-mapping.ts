/**
 * =============================================================================
 * ADDRESSES SECTION — form ⇄ editor field mapping (ADR-332)
 * =============================================================================
 *
 * Εξήχθη από το `AddressesSectionWithFullscreen.tsx` (N.7.1: το component
 * ξεπέρασε τις 500 γραμμές). Καθαρές συναρτήσεις πάνω στο `ContactFormData` —
 * καμία εξάρτηση από React.
 *
 * @module components/contacts/dynamic/addresses-section-form-mapping
 * @see ADR-332 — Enterprise Address Editor System
 */

import type { ResolvedAddressFields } from '@/components/shared/addresses/editor';
import type { CompanyAddress, ContactFormData } from '@/types/ContactFormTypes';
import { getPrimaryAddressType } from '@/types/contacts/address-types';
import { formatContactAddressLine } from '@/utils/address/address-line';
import { DEFAULT_STORED_COUNTRY_CODE, toStoredCountryCode } from '@/utils/address/country-codes';
import { projectAddressVocabulary, storedAddressToResolved } from '@/utils/address/administrative-hierarchy';

/**
 * Η διοικητική ιεραρχία **μιας εγγραφής της λίστας**, καθαρισμένη — το αντίστοιχο του
 * `DRAG_RESOLVED_HIERARCHY_RESET` στο λεξιλόγιο `companyAddress`.
 *
 * Τη χρειάζονται δύο πράξεις: ο «Καθαρισμός» της έδρας (`useClearCompanyHqAddress`, όπου ήταν
 * γραμμένη inline) και το σύρσιμο με «Ναι, ενημέρωσε» (ADR-332 D27 Β-ΙΙ): νέα οδός από τη
 * μηχανή με την παλιά ταυτότητα δήμου δίπλα της θα έδειχνε όνομα μιας περιοχής με ταυτότητα
 * άλλης (ADR-277).
 */
export const COMPANY_ADDRESS_HIERARCHY_CLEARED = {
  settlementId: null,
  communityName: '',
  municipalUnitName: '',
  municipalityName: '',
  municipalityId: null,
  regionalUnitName: '',
  regionName: '',
  decentAdminName: '',
  majorGeoName: '',
} as const satisfies Partial<CompanyAddress>;

/**
 * Η έδρα των **επίπεδων πεδίων** ως εγγραφή της λίστας.
 *
 * 🔑 **Μία συνάρτηση, δύο χρήσεις** (ADR-332 D27 Β-ΙΙ): η συνθετική γραμμή έδρας της οθόνης
 * (D20) **και** η υλοποίηση της λίστας όταν άνθρωπος τοποθετεί πρώτη φορά θέση σε επαφή που
 * έχει μόνο επίπεδα πεδία. Η ιεραρχία περνά από τον πίνακα (ADR-772) — αλλιώς η πρώτη θέση θα
 * έσβηνε τον δήμο της έδρας, αφού το παράγωγο `addresses[]` χτίζεται πλέον από τη λίστα.
 */
export function hqEntryFromFlatFields(formData: ContactFormData): CompanyAddress {
  const hierarchy = projectAddressVocabulary(
    formData as Readonly<Record<string, unknown>>,
    'contactFlat',
    'companyAddress',
    { includePostal: true, clearedIdsAsNull: false },
  ) as Partial<CompanyAddress>;
  return {
    ...hierarchy,
    type: formData.primaryAddressType ?? getPrimaryAddressType(formData.type),
    ...(formData.primaryAddressCustomLabel ? { customLabel: formData.primaryAddressCustomLabel } : {}),
    street: formData.street ?? '',
    number: formData.streetNumber ?? '',
    postalCode: formData.postalCode ?? '',
    city: formData.city ?? '',
    // 🔴 **Ζ4δ** (ADR-332 D27 Φάση Α): εδώ το πεδίο **παραλειπόταν** όταν η φόρμα δεν δήλωνε
    // χώρα, ενώ το **παράγωγο** `addresses[]` έγραφε `'GR'` (`address-info-builder:185`) —
    // δύο αποφάσεις για την κενή χώρα, σε δύο αρχεία, μέσα στο **ίδιο** έγγραφο. Μετρημένο
    // ζωντανά στο Λ6. Η απόφαση ζει πλέον **μία φορά**, στο λεξιλόγιο χώρας.
    country: toStoredCountryCode(formData.hqAddressCountry) ?? DEFAULT_STORED_COUNTRY_CODE,
  };
}

export function formatHqStreetLine(formData: ContactFormData): string {
  return formatContactAddressLine({
    street: formData.street,
    number: formData.streetNumber, // flat: `streetNumber` — array: `number`
    city: formData.city,
    postalCode: formData.postalCode,
    country: formData.hqAddressCountry,
  });
}

/**
 * Μηδενισμός της διοικητικής ιεραρχίας μετά από επίλυση θέσης στον χάρτη (ADR-277).
 *
 * Το reverse-geocoding επιστρέφει **ονόματα**, όχι ταυτότητες ΕΛΣΤΑΤ. Αν κρατούσαμε
 * τα παλιά ids, θα εμφανιζόταν το όνομα μιας περιοχής με την ταυτότητα μιας άλλης.
 * Κοινό και για τους δύο κλάδους του `applyDragResolve` — ένας ορισμός, ώστε να μη
 * μπορούν να αποκλίνουν.
 */
export const DRAG_RESOLVED_HIERARCHY_RESET = {
  settlementId: null,
  community: '',
  municipalUnit: '',
  municipality: '',
  municipalityId: null,
  regionalUnit: '',
  region: '',
  decentAdmin: '',
  majorGeo: '',
} as const;

/**
 * ADR-772 — ήταν το **τέταρτο** δίδυμο, και το πιο ύπουλο: διέφερε από τα άλλα τρία σε
 * **δύο** σημεία (`streetNumber` αντί `number`, `settlement || city` αντί σκέτο `city`),
 * δηλαδή έμοιαζε με «διαφορετική συνάρτηση» ενώ ήταν το ίδιο ερώτημα σε **άλλο λεξιλόγιο**.
 *
 * ⚠️ **Η προειδοποίηση που ήταν εδώ σε σχόλιο είναι πλέον ΔΟΜΗ**: η προτεραιότητα
 * «`settlement` πριν `city`» δηλώνεται μία φορά στον πίνακα
 * (`ADMIN_LEVEL_VOCABULARY.settlement.contactFlat`) και ισχύει αυτόματα παντού. Όσο ήταν
 * σχόλιο, η απόκλιση ήταν θέμα προσοχής· τώρα είναι αδύνατη. *(Το γιατί μετρά: όταν
 * αποκλίνει, ο πίνακας «Συμφωνία Πεδίων» συγκρίνει **άλλη** τιμή από αυτή που βλέπει ο
 * χρήστης και το «Διόρθωση» φαίνεται να μην κάνει τίποτα.)*
 */
export function formDataToResolvedFields(fd: ContactFormData): ResolvedAddressFields {
  return storedAddressToResolved(fd as Readonly<Record<string, unknown>>, 'contactFlat');
}
