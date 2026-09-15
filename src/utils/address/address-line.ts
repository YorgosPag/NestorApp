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
import { stripGreekAdminPrefix } from './place-name';
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

  // ADR-332 D27 Βήμα Β (Β7): τα κενά στα άκρα κόβονται ΕΔΩ — αποθηκευμένη οδός «Σαμοθράκης »
  // έβγαζε «Σαμοθράκης , 16». Η γραφή καθαρίζεται πλέον και στο σύνορο εγγραφής, αλλά τα ήδη
  // αποθηκευμένα δεδομένα διαβάζονται σωστά από τώρα, χωρίς μετάπτωση.
  return [parts.street, parts.number, parts.city, postalCode]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(', ');
}

/** Ό,τι **βρήκε** ο γεωκωδικοποιητής — δομικά συμβατό με το `ResolvedAddressFields`. */
export interface ResolvedAddressLineParts {
  street?: string;
  number?: string;
  neighborhood?: string;
  city?: string;
  postalCode?: string;
  country?: string;
}

/**
 * **«Οδός Αριθμός, Περιοχή, Τ.Κ.» — η σύντομη μορφή ΤΗΣ ΑΠΑΝΤΗΣΗΣ του παρόχου** (ADR-332 D28).
 *
 * 🔴 **Γιατί υπάρχει**: το πλαίσιο επιβεβαίωσης τόπου έδειχνε το `display_name` του Nominatim αυτούσιο —
 * μετρημένο στη βιτρίνα 2026-09-15: *«Σαμοθράκης, Ελευθέριο, Ελευθέρια, Ελευθέριο-Κορδελιό, Κοινότητα …,
 * Δημοτική Ενότητα …, Δήμος …, Μητροπολιτική Ενότητα …, Περιφέρεια …, Αποκεντρωμένη Διοίκηση …, 563 34,
 * Ελλάδα»* — **δώδεκα** κομμάτια για να επαληθεύσει ο άνθρωπος **τρία**.
 *
 * ⚠️ **ΔΕΝ ενοποιείται** με τα δύο αδέλφια, για δύο **διαφορετικές** αποφάσεις:
 * - η **περιοχή** είναι η **στενότερη** που ξέρει ο πάροχος (γειτονιά πριν από πόλη) — αυτή ξεχωρίζει
 *   ανάμεσα σε τέσσερις ομώνυμες οδούς·
 * - ο πάροχος γράφει την περιοχή **με πρόθεμα βαθμίδας** («Δημοτική Ενότητα Ελευθερίου - Κορδελιού») ⇒
 *   περνά από το `stripGreekAdminPrefix`. ⛔ **Όχι** `cleanPlaceName`: εκείνο αναδιπλώνει και την παύλα
 *   (δίπλωμα **σύγκρισης**), και το «Ελευθέριο-Κορδελιό» θα εμφανιζόταν «Ελευθέριο Κορδελιό» — αλλαγή
 *   επίσημου ονόματος στην οθόνη που υπάρχει για να το **επαληθεύσει** ο άνθρωπος.
 *
 * ⚠️ **Ο αριθμός είναι ΜΟΝΟ του παρόχου**: δηλωμένος αριθμός που δεν επιβεβαιώθηκε **δεν** μπαίνει εδώ — η
 * στάση του λέγεται χωριστά (`house-number-standing`). Αλλιώς η γραμμή θα έδειχνε «επιβεβαίωση» που δεν έγινε.
 *
 * @returns `''` όταν δεν υπάρχει ούτε οδός ούτε περιοχή — ο καλών κρατά τότε το πλήρες κείμενο.
 */
export function formatResolvedAddressLine(parts: ResolvedAddressLineParts): string {
  const streetLine = [parts.street, parts.number].map((part) => part?.trim()).filter(Boolean).join(' ');
  const rawLocality = parts.neighborhood?.trim() || parts.city?.trim() || '';
  const locality = rawLocality === '' ? '' : stripGreekAdminPrefix(rawLocality);
  if (streetLine === '' && locality === '') return '';

  const postalCode = isGreekAddressCountry(parts.country)
    ? formatGreekPostalCode(parts.postalCode)
    : parts.postalCode?.trim();
  return [streetLine, locality, postalCode].filter(Boolean).join(', ');
}
