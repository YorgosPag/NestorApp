/**
 * @fileoverview **Η ΟΨΗ ΘΕΣΗΣ ενός `AddressInfo`** — το παράγωγο κάτοπτρο στη γλώσσα του κριτή.
 * @module utils/contacts/address-info-position-view
 * @enterprise ADR-332 D27 **Ζ8** · ADR-772 (ένα λεξιλόγιο)
 *
 * 🔑 **Γιατί υπάρχει — και γιατί ΔΕΝ είναι δίδυμο του `contactAddressPositionView`.**
 * Η ίδια αποθηκευμένη διεύθυνση ζει σε **τρεις** διαλέκτους: `CompanyAddress` (η αυθεντική),
 * `AddressInfo` (το παράγωγο `contacts/<id>.addresses[]`) και `ProjectAddress` (η γλώσσα του
 * γραφέα θέσης). Το `contactAddressPositionView` μεταφράζει την **πρώτη**· αυτό εδώ τη **δεύτερη**.
 * Χωρίς αυτό, κάθε οθόνη που κρατά `AddressInfo` ρωτούσε τον κριτή σε **λάθος γλώσσα**.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΕΥΡΗΜΑ ΠΟΥ ΤΟ ΓΕΝΝΗΣΕ — μετρημένο ζωντανά (2026-09-13), ΔΥΟ πεδία
 * ────────────────────────────────────────────────────────────────────────────
 * Στην **ίδια οθόνη**, η ίδια έδρα της ALFA έδειχνε 🔺«Παλιά» στην κάρτα λίστας και
 * 🔄«Σχετικά πρόσφατη» στην καρτέλα διευθύνσεων. Η μέτρηση των δύο κατόπτρων:
 *
 *     field: "neighborhood"   κάτοπτρο: «Κέντρο»   γραφέας: «Δημοτική Κοινότητα Τριανδρίας»
 *     field: "country"        κάτοπτρο: «GR»       γραφέας: «»
 *
 * Το **`neighborhood`** είναι το σοβαρό: δεν είναι «απουσία vs προεπιλογή», είναι **δύο
 * διαφορετικές στήλες πηγής** της ίδιας εγγραφής. Ο πίνακας του ADR-772 στέλνει το επίπεδο
 * **L7 «Κοινότητα»** σε `neighborhood` στα έργα αλλά σε `community` στο `AddressInfo`, ενώ το
 * ελεύθερο ταχυδρομικό `neighborhood` υπάρχει **μόνο** στο `AddressInfo`. Δύο έννοιες, ένα όνομα.
 *
 * ⚠️ **Ο πίνακας ΔΕΝ είναι λάθος** — είναι σωστός για **προβολή**. Λάθος ήταν να περνά ωμό
 * `AddressInfo` σε κριτή **ταυτότητας**. Γι' αυτό η διόρθωση είναι εδώ, στον καλούντα, και
 * **όχι** στο κοινό λεξιλόγιο (που το μοιράζονται τα έργα και η φόρμα ιεραρχίας, πύλη 3.44).
 *
 * 🔑 **Μηδέν νέα αντιστοίχιση**: η μετάφραση περνά από τον **ίδιο** `projectAddressVocabulary`
 * με το `contactAddressPositionView`. Χειρόγραφος χάρτης εδώ θα ήταν τέταρτη διάλεκτος.
 */

import {
  ADDRESS_IDENTITY_FIELDS,
  type AddressIdentityField,
} from '@/lib/geocoding/address-position';
import type { StoredAddressPosition } from '@/types/address-position';
import type { AddressInfo } from '@/types/contacts';
import { projectAddressVocabulary } from '@/utils/address/administrative-hierarchy';
import { pickStoredAddressPosition } from '@/utils/address/stored-address-position';

type IdentityText = { [K in AddressIdentityField]?: string };

/** Ό,τι χρειάζεται ο κριτής: κείμενο ταυτότητας **στη γλώσσα του** + η αποθηκευμένη θέση. */
export type AddressInfoPositionView = StoredAddressPosition & IdentityText;

/**
 * Μεταφράζει ένα `AddressInfo` στη γλώσσα του γραφέα θέσης, ώστε το
 * `positionTextVerdict` να συγκρίνει **μήλα με μήλα** — το `geocodingMetadata.resolvedFor`
 * γεννιέται πάντα σε αυτή τη γλώσσα (`contactAddressPositionView` → `toQuery`).
 */
export function addressInfoPositionView(address: Readonly<AddressInfo>): AddressInfoPositionView {
  const bag = projectAddressVocabulary(
    address as Readonly<Record<string, unknown>>,
    'addressInfo',
    'projectAddress',
    { includePostal: true, clearedIdsAsNull: false },
  );
  const identity: IdentityText = {};
  for (const field of ADDRESS_IDENTITY_FIELDS) {
    const value = bag[field];
    if (typeof value === 'string' && value !== '') identity[field] = value;
  }
  return { ...identity, ...pickStoredAddressPosition(address) };
}
