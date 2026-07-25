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

export function formDataToResolvedFields(fd: ContactFormData): ResolvedAddressFields {
  return {
    street: (fd.street as string) || undefined,
    number: (fd.streetNumber as string) || undefined,
    postalCode: (fd.postalCode as string) || undefined,
    // ⚠️ Η προτεραιότητα ΠΡΕΠΕΙ να ταυτίζεται με αυτή που αποδίδει το combobox
    // «Οικισμός / Πόλη» (`settlement || city`). Όταν αποκλίνει, ο πίνακας
    // «Συμφωνία Πεδίων» συγκρίνει ΑΛΛΗ τιμή από αυτή που βλέπει ο χρήστης και
    // το «Διόρθωση» φαίνεται να μην κάνει τίποτα.
    city: (fd.settlement as string) || (fd.city as string) || undefined,
    neighborhood: (fd.neighborhood as string) || undefined,
    region: (fd.region as string) || undefined,
  };
}
