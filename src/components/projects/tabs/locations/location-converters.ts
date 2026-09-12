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
  humanPlacedPatch,
  type DragApplyMode,
  type DraggedAddressText,
  type PinDrop,
} from '@/components/shared/addresses/pin-drop';
import { provedHierarchyValue } from '@/components/shared/addresses/address-hierarchy-field-ops';
import {
  overwriteAdminHierarchy,
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
// ADR-332 D27 Β-ΙΙ: ο τύπος ζει στο `pin-drop` (λεξιλόγιο του συρσίματος, όχι των έργων)·
// επανεξάγεται εδώ ώστε οι υπάρχοντες καταναλωτές να μην αλλάξουν εισαγωγή.
export type { DragApplyMode };

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
  dragged: DraggedAddressText,
  mode: DragApplyMode,
): ProjectAddress {
  const point = dragged.coordinates ?? addr.coordinates;
  // Η δήλωση γράφεται σε ΕΝΑ σημείο για όλους τους γραφείς του πελάτη (`humanPlacedPatch`).
  const pinned: ProjectAddress = point
    ? { ...addr, ...humanPlacedPatch(point) }
    : { ...addr, source: 'dragged' };
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
    // 🔴 **ADR-332 D27 Φάση Β′ — ΕΔΩ ΕΓΡΑΦΕ `regionalUnit: undefined, municipality: undefined`**
    //    με σχόλιο *«Drag provides only reverse-geocoded coordinates — clear admin hierarchy»*.
    //    Ήταν **σωστό όσο δεν είχαμε ταυτότητες**: όνομα μιας περιοχής με ταυτότητα άλλης
    //    είναι χειρότερο από κενό *(ADR-277)*. Τώρα ο διακομιστής **αποδεικνύει** τον δήμο
    //    από τη διοικητική αλυσίδα του Nominatim *(μετρημένο: 14/14)*, οπότε ο μηδενισμός
    //    γίνεται **υπό όρους**.
    //    🔑 Το `projectAddress` κρατά **επτά** ταυτότητες — πολύ πλουσιότερο δοχείο από το
    //    `companyAddress` (δύο). Ο πίνακας του ADR-772 δίνει σε **κάθε** δοχείο ό,τι μπορεί
    //    να κρατήσει: κανένα χειρόγραφο υποσύνολο, καμία σιωπηλή απώλεια.
    ...projectHierarchyPatch(dragged),
    region: dragged.region ?? '',
    neighborhood: dragged.neighborhood ?? undefined,
  };
}

/**
 * Η ιεραρχία μιας διεύθυνσης έργου μετά από σύρσιμο: **γράψε ό,τι αποδείχθηκε, καθάρισε ό,τι
 * ΔΕΝ αποδείχθηκε**.
 */
function projectHierarchyPatch(dragged: DraggedAddressText): Partial<ProjectAddress> {
  // ⚠️ **`?? []` — ίδια απόφαση με τις επαφές**: εδώ φτάνουμε μόνο σε `adopt-address`, δηλαδή
  //    όταν το κείμενο αντικαθίσταται. Καμία απόδειξη ⇒ **καθάρισμα**, ποτέ κληρονομιά της
  //    ταυτότητας της **προηγούμενης** διεύθυνσης (ADR-277).
  return overwriteAdminHierarchy(
    provedHierarchyValue(dragged.admin ?? []),
    'form',
    'projectAddress',
  ) as Partial<ProjectAddress>;
}

/**
 * Εφαρμόζει ένα **ολόκληρο** σύρσιμο (`PinDrop`) — και σύρσιμο **χωρίς** κείμενο (404 / timeout).
 *
 * 🔑 ADR-332 D27 Βήμα Β: χωρίς κείμενο η «υιοθέτηση διεύθυνσης» δεν έχει τι να υιοθετήσει ⇒
 * γίνεται **μόνο θέση**. Ο διάλογος δεν την προσφέρει καν· εδώ είναι η δεύτερη ζώνη ασφαλείας,
 * ώστε ένα λάθος στον καλούντα να μη σβήσει ποτέ τον αριθμό με κενό κείμενο.
 */
export function applyPinDrop(addr: ProjectAddress, drop: PinDrop, mode: DragApplyMode): ProjectAddress {
  if (mode === 'adopt-address' && drop.text.kind === 'resolved') {
    return applyDraggedPin(addr, drop.text.address, 'adopt-address');
  }
  return applyDraggedPin(addr, humanPlacedPatch(drop.point), 'position-only');
}
