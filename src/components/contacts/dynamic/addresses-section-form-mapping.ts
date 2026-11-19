/**
 * =============================================================================
 * ADDRESSES SECTION — editor ⇄ εγγραφή διεύθυνσης επαφής (ADR-332)
 * =============================================================================
 *
 * Καθαρές συναρτήσεις, χωρίς React. Όλες δουλεύουν πάνω σε **μία** εγγραφή `CompanyAddress`
 * — την έδρα (θέση 0) ή υποκατάστημα: από τη Φάση 2 του §D30 είναι η **ίδια** μορφή, άρα και ο
 * **ίδιος** μετασχηματισμός. Τα επίπεδα πεδία της φόρμας (`street`, `streetNumber`,
 * `settlement`, `hqAddressCountry`, …) δεν υπάρχουν πια· η έδρα γράφεται **μόνο** μέσα από το
 * `commitHq` (`contact-hq-state`).
 *
 * @module components/contacts/dynamic/addresses-section-form-mapping
 * @see ADR-332 §D30 — ό,τι βλέπεις είναι ό,τι αποθηκεύεται
 */

import type { ResolvedAddressFields } from '@/components/shared/addresses/editor';
import type { CompanyAddress, ContactFormData } from '@/types/ContactFormTypes';
import { formatContactAddressLine } from '@/utils/address/address-line';
import { toStoredCountryCode } from '@/utils/address/country-codes';
import { storedAddressToResolved } from '@/utils/address/administrative-hierarchy';
import { commitHq } from './contact-hq-state';

/**
 * Η διοικητική ιεραρχία **μιας εγγραφής της λίστας**, καθαρισμένη.
 *
 * Τη χρειάζονται δύο πράξεις: ο «Καθαρισμός» της έδρας (`useClearCompanyHqAddress`) και το
 * σύρσιμο με «Ναι, ενημέρωσε» (ADR-332 D27 Β-ΙΙ): νέα οδός από τη μηχανή με την παλιά ταυτότητα
 * δήμου δίπλα της θα έδειχνε όνομα μιας περιοχής με ταυτότητα άλλης (ADR-277).
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

/** Η εγγραφή όπως τη ζωγραφίζει ο `AddressEditor` — ίδιος πίνακας (ADR-772) για έδρα και υποκατάστημα. */
export function contactAddressToResolvedFields(address: CompanyAddress): ResolvedAddressFields {
  return storedAddressToResolved(address, 'companyAddress');
}

/** Η γραμμή «Οδός Αριθμός, Πόλη, Τ.Κ.» της εγγραφής. */
export function formatContactAddressStreetLine(address: CompanyAddress): string {
  return formatContactAddressLine(address);
}

/**
 * Ο editor διόρθωσε **κείμενο** μιας εγγραφής (συμφιλίωση / πρόταση / πληκτρολόγηση) — η
 * ιεραρχία **μένει**. Ο βασικός μετασχηματισμός, κοινός για έδρα και υποκαταστήματα.
 */
export function applyResolvedToContactAddress(
  resolved: ResolvedAddressFields,
  existing: CompanyAddress,
): CompanyAddress {
  return {
    ...existing,
    street: resolved.street ?? existing.street,
    number: resolved.number ?? existing.number,
    postalCode: resolved.postalCode ?? existing.postalCode,
    city: resolved.city ?? existing.city,
    // Χωρίς αυτό, η «Περιοχή / Συνοικία» χανόταν σιωπηλά στον πρώτο κύκλο onChange.
    neighborhood: resolved.neighborhood ?? existing.neighborhood,
  };
}

/**
 * Ο editor της **έδρας** — ο βασικός μετασχηματισμός, συν ό,τι ο editor της έδρας γράφει και ο
 * editor υποκαταστήματος όχι (σήμερα): χώρα, περιοχή, και συνέπεια ταυτότητας οικισμού.
 *
 * - **Οικισμός**: όνομα που άλλαξε από πηγή εκτός ιεραρχίας ⇒ το `settlementId` δεν αντιστοιχεί
 *   πλέον στο εμφανιζόμενο όνομα και καθαρίζει. Ταυτότητα και ετικέτα δεν αποκλίνουν (ADR-277).
 * - **Περιοχή**: ο editor δείχνει `regionName ‖ region` (ADR-772)· η διόρθωση γράφεται στο
 *   **κανονικό** πεδίο του πίνακα (`regionName`) — αλλιώς ο αναγνώστης θα συνέχιζε να δείχνει το παλιό.
 * - **Χώρα**: `!== undefined` = «ο editor εφάρμοσε το πεδίο»· μέσα σε αυτό, κενό = «καθαρίστηκε» (Ζ4α).
 */
export function applyResolvedToContactHq(resolved: ResolvedAddressFields, hq: CompanyAddress): CompanyAddress {
  const settlementRenamed = resolved.city !== undefined && resolved.city !== hq.city;
  return {
    ...applyResolvedToContactAddress(resolved, hq),
    ...(resolved.region !== undefined ? { regionName: resolved.region } : {}),
    ...(settlementRenamed ? { settlementId: null } : {}),
    ...(resolved.country !== undefined ? { country: toStoredCountryCode(resolved.country) } : {}),
  };
}

/**
 * Η επόμενη κατάσταση της φόρμας μετά από διόρθωση στον editor της έδρας. Καθαρή συνάρτηση:
 * την καλεί το `useHqAddressMutations.handleHqChange` και την εκτελεί αυτούσια ο φρουρός round-trip.
 *
 * 🔴 **ADR-332 §D30** — εδώ η Φάση 1 κρατούσε **δύο** δοχεία σε κάτοπτρο (επίπεδα πεδία + θέση 0).
 * Η Φάση 2 έσβησε το πρώτο: δεν υπάρχει πια τίποτα να συγχρονιστεί.
 */
export function applyHqEditorChange(prev: ContactFormData, resolved: ResolvedAddressFields): ContactFormData {
  return commitHq(prev, (hq) => applyResolvedToContactHq(resolved, hq));
}
