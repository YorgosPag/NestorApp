/**
 * =============================================================================
 * Location Converters — ProjectAddress ↔ AddressWithHierarchyValue
 * =============================================================================
 *
 * 🔴 **ADR-772: αυτό το αρχείο δεν είναι πια μετατροπέας — είναι κλήση.**
 *
 * Ήταν ένα από **τέσσερα** ιδιωτικά ζεύγη `to/fromHierarchyValue`, καθένα με άλλο πλήθος
 * επιπέδων (μετρημένο ανά κατεύθυνση: 6/8 εδώ, 5/8 στο `BuildingAddressesEditor`). Η
 * αντιστοίχιση ζει πλέον **μία φορά**, στο `utils/address/administrative-hierarchy`.
 *
 * ⚠️ Τα ονόματα των εξαγωγών **μένουν** — υπάρχουν ζωντανοί καταναλωτές
 * (`useProjectLocations`, `FrontageAddressCreateDialog`). Αλλάζει το σώμα, όχι η διεπαφή.
 *
 * @module components/projects/tabs/locations/location-converters
 * @enterprise ADR-167, ADR-772
 */

import type { ProjectAddress, PartialProjectAddress } from '@/types/project/addresses';
import type { AddressWithHierarchyValue } from '@/components/shared/addresses/AddressWithHierarchy';
import { EMPTY_VALUE } from '@/components/shared/addresses/address-with-hierarchy-config';
import {
  projectAddressVocabulary,
  resolveCityFromHierarchy,
} from '@/utils/address/administrative-hierarchy';

/**
 * Κενή τιμή ιεραρχίας.
 *
 * ⚠️ Ήταν **αυτούσιο αντίγραφο** του `EMPTY_VALUE` (20 πεδία, γραμμή προς γραμμή). Ένα νέο
 * επίπεδο έπρεπε να προστεθεί και στα δύο, και η ξεχασμένη προσθήκη περνούσε αθόρυβα —
 * ακριβώς η κλάση του ADR-772. Πλέον επανεξαγωγή.
 */
export const EMPTY_HIERARCHY: AddressWithHierarchyValue = EMPTY_VALUE;

/** Convert ProjectAddress → AddressWithHierarchyValue for the centralized component */
export function toHierarchyValue(addr: Partial<ProjectAddress>): Partial<AddressWithHierarchyValue> {
  // Ο πίνακας γράφει μόνο ονόματα πεδίων του `AddressWithHierarchyValue`· τα ονόματα είναι
  // πάντα `string` και οι ταυτότητες `string | null` — ακριβώς οι τύποι του δοχείου.
  return projectAddressVocabulary(addr, 'projectAddress', 'form', {
    includePostal: true,
    // Ενημέρωση **υπάρχουσας** κατάστασης φόρμας: κενή ταυτότητα στην αποθήκευση σημαίνει
    // «καθάρισε τον επιλογέα», αλλιώς μένει μπαγιάτικη ταυτότητα δίπλα σε νέο όνομα.
    clearedIdsAsNull: true,
  }) as Partial<AddressWithHierarchyValue>;
}

/** Convert AddressWithHierarchyValue → partial ProjectAddress fields */
export function fromHierarchyValue(val: AddressWithHierarchyValue): Partial<ProjectAddress> {
  return {
    ...(projectAddressVocabulary(val, 'form', 'projectAddress', {
      includePostal: true,
      // Το αποτέλεσμα συγχωνεύεται σε **υπάρχουσα** διεύθυνση: σβησμένη επιλογή πρέπει να
      // σβήσει και την ταυτότητα.
      clearedIdsAsNull: true,
    }) as Partial<ProjectAddress>),
    // Τα τρία υποχρεωτικά πεδία του `ProjectAddress` γράφονται **πάντα**, ακόμη και κενά:
    // ο πίνακας παραλείπει τα κενά (σωστό για προαιρετικά), αλλά εδώ η παράλειψη θα άφηνε
    // μπαγιάτικη τιμή σε πεδίο που ο χρήστης μόλις καθάρισε.
    street: val.street || '',
    postalCode: val.postalCode || '',
    city: resolveCityFromHierarchy(val),
  };
}

/**
 * Πώς εφαρμόζεται ένα σύρσιμο πινέζας στην αποθηκευμένη διεύθυνση.
 * - `adopt-address`: η θέση **και** το κείμενο της αντίστροφης γεωκωδικοποίησης.
 * - `position-only`: μόνο η θέση — το κείμενο που δήλωσε ο άνθρωπος **μένει**.
 */
export type DragApplyMode = 'adopt-address' | 'position-only';

/**
 * Εφαρμόζει σύρσιμο πινέζας — **και το δηλώνει** (`source: 'dragged'`).
 *
 * 🔴 Η δήλωση είναι όλο το νόημα (2026-09-10 · ADR-777 · ADR-332): ο διακομιστής
 * (`lib/geocoding/address-position`, κανόνας 1) αναγνώριζε ανθρώπινη πινέζα **μόνο** αν
 * το κείμενο έμενε ίδιο. Το `adopt-address` όμως ξαναγράφει οδό/αριθμό ⇒ ο κανόνας 3
 * ξαναρωτούσε τη μηχανή και **έσβηνε** το σημείο του ανθρώπου. Σε δρόμο που το OSM ξέρει
 * χωρίς αριθμούς, η πινέζα δεν μπορούσε να διορθωθεί **με κανέναν τρόπο**.
 *
 * ⚠️ Τη **διατηρούμενη** προέλευση την αποφασίζει πάντα ο διακομιστής
 * (`applyAddressPosition`): εδώ είναι αίτημα, όχι ισχυρισμός.
 */
export function applyDraggedPin(
  addr: ProjectAddress,
  dragged: Partial<PartialProjectAddress>,
  mode: DragApplyMode,
): ProjectAddress {
  const pinned: ProjectAddress = {
    ...addr,
    coordinates: dragged.coordinates ?? addr.coordinates,
    source: 'dragged',
  };
  if (mode === 'position-only') return pinned;
  return {
    ...pinned,
    street: dragged.street ?? addr.street,
    // House number must always reflect the new pin location. Replace
    // unconditionally — if reverse geocoding returns no number for the
    // dragged spot, clear the stale value rather than keep the old one.
    number: dragged.number,
    city: dragged.city ?? addr.city,
    postalCode: dragged.postalCode ?? addr.postalCode,
    // Drag provides only reverse-geocoded coordinates — clear admin hierarchy
    region: dragged.region ?? '',
    regionalUnit: undefined,
    municipality: undefined,
    neighborhood: dragged.neighborhood ?? undefined,
  };
}
