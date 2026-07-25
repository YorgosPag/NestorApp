/**
 * =============================================================================
 * ΓΡΑΜΜΗ ΔΙΕΥΘΥΝΣΗΣ ΕΠΑΦΗΣ — μία μορφή, ένα σημείο
 * =============================================================================
 *
 * ΓΙΑΤΙ ΥΠΑΡΧΕΙ
 * Το «Οδός, Αριθμός, Πόλη, Τ.Κ.» ήταν γραμμένο **τέσσερις φορές**:
 *   - `addresses-section-form-mapping.formatHqStreetLine` (έδρα, flat πεδία)
 *   - `AddressesSectionWithFullscreen` (inline, μέσα στο JSX του υποκαταστήματος)
 *   - `CompanyAddressesSection.formatBranchStreetLine`
 *   - `AddressCard` (τοπικό δίδυμο του κεντρικού `formatAddressLine`)
 * Καμία δεν μορφοποιούσε τον Τ.Κ. Μετά την κανονικοποίηση (ADR-332 D16) η
 * διόρθωση θα έπρεπε να γίνει σε τέσσερα σημεία — και μια ξεχασμένη θα έδειχνε
 * «54624» δίπλα σε «546 24» στην ίδια οθόνη.
 *
 * ΔΕΝ ΕΝΟΠΟΙΕΙΤΑΙ με το `formatAddressLine` του `types/project/address-helpers`:
 * εκείνο γράφει «Οδός Αριθμός, Πόλη, Τ.Κ.» (οδός και αριθμός μαζί) για έργα.
 * Διαφορετική έξοδος = διαφορετική συνάρτηση· η ενοποίηση θα ήταν αλλαγή UI, όχι
 * κεντρικοποίηση.
 *
 * @module utils/address/address-line
 * @see ADR-332 D16 — κανονικός Τ.Κ. στη βάση, μορφοποίηση στο render
 */

import { isGreekAddressCountry } from './country-codes';
import { formatGreekPostalCode } from './postal-code';

export interface ContactAddressLineParts {
  street?: string;
  number?: string;
  city?: string;
  postalCode?: string;
  country?: string;
}

/**
 * «Οδός, Αριθμός, Πόλη, Τ.Κ.» — τα κενά παραλείπονται.
 *
 * Ο Τ.Κ. μορφοποιείται στην επίσημη ελληνική γραφή (ΕΛΤΑ) μόνο για ελληνική
 * διεύθυνση· ξένος Τ.Κ. εμφανίζεται αυτούσιος.
 */
export function formatContactAddressLine(parts: ContactAddressLineParts): string {
  const postalCode = isGreekAddressCountry(parts.country)
    ? formatGreekPostalCode(parts.postalCode)
    : parts.postalCode;

  return [parts.street, parts.number, parts.city, postalCode].filter(Boolean).join(', ');
}
