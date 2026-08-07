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
import type { ContactFormData } from '@/types/ContactFormTypes';
import { formatContactAddressLine } from '@/utils/address/address-line';
import { storedAddressToResolved } from '@/utils/address/administrative-hierarchy';

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
