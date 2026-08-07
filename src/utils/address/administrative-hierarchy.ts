/**
 * =============================================================================
 * Ο ΕΝΑΣ ΜΕΤΑΤΡΟΠΕΑΣ ΔΙΕΥΘΥΝΣΗΣ ↔ ΙΕΡΑΡΧΙΑΣ (ADR-772)
 * =============================================================================
 *
 * Μία συνάρτηση, **όλες** οι κατευθύνσεις: `projectAddressVocabulary(πηγή, από, προς)`.
 * Ο εμπρός και ο αντίστροφος δρόμος ζουν **πάνω στον ίδιο πίνακα**, οπότε ένα νέο
 * διοικητικό επίπεδο προστίθεται σε **μία** γραμμή και ισχύει και στις δύο κατευθύνσεις.
 *
 * 🔑 **Γιατί μία γενική συνάρτηση αντί για ζεύγη `to/from` ανά δοχείο**: τα ζεύγη ήταν
 * ακριβώς το πρόβλημα — τέσσερα ιδιωτικά αντίγραφα, καθένα με άλλο πλήθος επιπέδων, και
 * ένα χειρόγραφο αντίστροφο είναι sibling clone **αόρατος** στο `ssot:discover` (name-based)
 * και συχνά και στο `jscpd` (min-tokens 50). Βλ. ADR-584 / N.18.
 *
 * ⚠️ **Δεν αποφασίζει «αν»** — μόνο «πώς». Ο καλών ελέγχει αν υπάρχει καθόλου δεδομένο.
 *
 * @module utils/address/administrative-hierarchy
 * @see ADR-772
 */

import type { AddressWithHierarchyValue } from '@/components/shared/addresses/address-with-hierarchy-config';
import type { ResolvedAddressFields } from '@/lib/geocoding/geocoding-types';
import {
  ADMIN_LEVEL_VOCABULARY,
  POSTAL_FIELD_VOCABULARY,
  HIERARCHY_ADJACENT_VOCABULARY,
  NOT_STORED,
  type AddressVocabulary,
  type AdminLevelKey,
  type PostalFieldKey,
  type HierarchyAdjacentFieldKey,
} from './administrative-hierarchy-vocabulary';

/**
 * Ό,τι παράγει ο μετατροπέας: ονόματα πεδίων του **δοχείου-στόχου** με τιμές.
 *
 * `null` σε ταυτότητα σημαίνει «καθαρίστηκε ρητά» — διαφορετικό από «απών», γι' αυτό
 * γράφεται. Ένα παραλειπόμενο `null` θα άφηνε **μπαγιάτικη ταυτότητα** δίπλα σε νέο όνομα.
 */
export type AddressFieldBag = Record<string, string | null>;

/**
 * ⚠️ **Και τα δύο πεδία είναι ΥΠΟΧΡΕΩΤΙΚΑ, χωρίς προεπιλογή** — σκόπιμα.
 *
 * Μια προεπιλογή εδώ θα ήταν μαντεψιά για λογαριασμό του καλούντα, δηλαδή ακριβώς ο
 * μηχανισμός που κόστισε τα δεδομένα. Έξι σημεία κλήσης· καθένα **λέει** τι εννοεί.
 */
interface ProjectionOptions {
  /**
   * Να μεταφερθούν και τα ταχυδρομικά πεδία (`street`/`number`/`postalCode`/`country`).
   *
   * Οι κατασκευαστές των επαφών (`address-info-builder`) τα θέτουν με δικούς τους κανόνες
   * (προεπιλεγμένη χώρα, `city` πάντα παρόν) και περνούν `false`.
   * ⚠️ Το `neighborhood` **δεν** ελέγχεται από εδώ — ταξιδεύει πάντα.
   */
  readonly includePostal: boolean;

  /**
   * Κενή ταυτότητα ⇒ να γραφτεί `null` στον στόχο (αντί να παραλειφθεί).
   *
   * - `true` όταν ο στόχος είναι **υπάρχουσα εγγραφή που ενημερώνεται**: ο χρήστης
   *   καθάρισε την επιλογή και η παλιά ταυτότητα **πρέπει** να σβήσει, αλλιώς μένει
   *   μπαγιάτικη δίπλα σε νέο όνομα.
   * - `false` όταν ο στόχος **κατασκευάζεται από την αρχή**: δεν υπάρχει τι να σβηστεί,
   *   και το `null` θα ήταν σκουπίδι στο Firestore. Δοκιμασμένο συμβόλαιο των επαφών
   *   («παραλείπει τα κενά αντί να γράφει κενά strings»).
   */
  readonly clearedIdsAsNull: boolean;
}

// Τα κλειδιά προκύπτουν από τους ΙΔΙΟΥΣ τους πίνακες — καμία δεύτερη χειρόγραφη λίστα
// (το σχήμα των δύο λιστών namespace του CHECK 3.34).
const ADMIN_LEVEL_KEYS = Object.keys(ADMIN_LEVEL_VOCABULARY) as readonly AdminLevelKey[];
const POSTAL_FIELD_KEYS = Object.keys(POSTAL_FIELD_VOCABULARY) as readonly PostalFieldKey[];
const ADJACENT_FIELD_KEYS = Object.keys(
  HIERARCHY_ADJACENT_VOCABULARY,
) as readonly HierarchyAdjacentFieldKey[];

type Slot = readonly string[] | typeof NOT_STORED;

/** Πρώτη μη-κενή τιμή της αλυσίδας — `undefined` όταν καμία δεν έχει περιεχόμενο. */
function readName(source: Readonly<Record<string, unknown>>, slot: Slot): string | undefined {
  if (slot === NOT_STORED) return undefined;
  for (const key of slot) {
    const value = source[key];
    if (typeof value === 'string' && value !== '') return value;
  }
  return undefined;
}

/**
 * Ταυτότητα: πρώτη μη-κενή· αλλιώς `null` ή παράλειψη, κατά την εντολή του καλούντα.
 *
 * Η διάκριση είναι ουσιώδης: «η πηγή δεν κρατά ταυτότητες» (⇒ μην αγγίξεις τον στόχο)
 * είναι άλλο από «η πηγή κρατά ταυτότητα και είναι κενή» (⇒ ο καλών αποφασίζει).
 */
function readId(
  source: Readonly<Record<string, unknown>>,
  slot: Slot,
  clearedIdsAsNull: boolean,
): string | null | undefined {
  if (slot === NOT_STORED) return undefined;
  for (const key of slot) {
    const value = source[key];
    if (typeof value === 'string' && value !== '') return value;
  }
  return clearedIdsAsNull ? null : undefined;
}

/** Γράφει στο **κανονικό** όνομα του στόχου (πρώτο της αλυσίδας). */
function write(bag: AddressFieldBag, slot: Slot, value: string | null | undefined): void {
  if (slot === NOT_STORED || value === undefined) return;
  bag[slot[0]] = value;
}

/**
 * Προβάλλει τη διεύθυνση από ένα λεξιλόγιο σε άλλο.
 *
 * @example
 *   projectAddressVocabulary(addr, 'projectAddress', 'form')   // αποθήκευση → οθόνη
 *   projectAddressVocabulary(val,  'form', 'projectAddress')   // οθόνη → αποθήκευση
 */
export function projectAddressVocabulary(
  source: Readonly<Record<string, unknown>>,
  from: AddressVocabulary,
  to: AddressVocabulary,
  options: ProjectionOptions,
): AddressFieldBag {
  const bag: AddressFieldBag = {};

  for (const level of ADMIN_LEVEL_KEYS) {
    const binding = ADMIN_LEVEL_VOCABULARY[level];
    write(bag, binding[to].name, readName(source, binding[from].name));
    write(bag, binding[to].id, readId(source, binding[from].id, options.clearedIdsAsNull));
  }

  // Ταξιδεύουν πάντα — η «Περιοχή / Συνοικία» δεν είναι ταχυδρομικό πεδίο.
  for (const field of ADJACENT_FIELD_KEYS) {
    const binding = HIERARCHY_ADJACENT_VOCABULARY[field];
    write(bag, binding[to], readName(source, binding[from]));
  }

  if (options.includePostal) {
    for (const field of POSTAL_FIELD_KEYS) {
      const binding = POSTAL_FIELD_VOCABULARY[field];
      write(bag, binding[to], readName(source, binding[from]));
    }
  }

  return bag;
}

/**
 * Η «πόλη» μιας διεύθυνσης, από τα πεδία της φόρμας.
 *
 * 🔑 **Ο κανόνας ήταν αντιγραμμένος σε επτά σημεία** (`location-converters`,
 * `CompanyAddressesSection`, `BuildingAddressesEditor` ×2, `FrontageAddressCreateDialog`,
 * `AddressesSectionWithFullscreen` ×2, `demo/addresses`). Είναι **κανόνας τομέα**, όχι
 * ευκολία: ένας οικισμός/χωριό μπορεί να μην έχει δικό του όνομα στα δεδομένα, οπότε η
 * πόλη είναι ο **Δήμος**. Επτά αντίγραφα ⇒ την ημέρα που αλλάξει η σειρά προτίμησης,
 * έξι οθόνες θα διαφωνήσουν σιωπηλά.
 */
export function resolveCityFromHierarchy(
  value: Partial<AddressWithHierarchyValue>,
): string {
  return value.settlementName || value.municipalityName || '';
}

/**
 * Τιμή ιεραρχίας ➜ τα πεδία που τρώει ο γεωκωδικοποιητής (`AddressEditor`).
 *
 * 🔴 **Ήταν δύο αντίγραφα που είχαν ΗΔΗ αποκλίνει** (ADR-584 / N.18):
 * το `BuildingAddressesEditor` έπεφτε στον **Δήμο** όταν έλειπε ο οικισμός, το
 * `LocationInlineForm` **όχι** — δηλαδή ένα χωριό χωρίς καταχωρημένο όνομα οικισμού
 * έστελνε στον γεωκωδικοποιητή διεύθυνση **χωρίς πόλη** από τη μία οθόνη και **με** πόλη
 * από την άλλη. Κανένα gate ονομάτων δεν το έβλεπε: ίδιο όνομα συνάρτησης, άλλο αρχείο.
 * Κρατήθηκε η εκδοχή **με** το fallback — είναι ο ίδιος κανόνας που ήδη γράφει το `city`
 * στην αποθήκευση (`resolveCityFromHierarchy`), οπότε οι δύο συμφωνούν πλέον εξ ορισμού.
 */
/**
 * **Αποθηκευμένη** διεύθυνση ➜ τα πεδία που τρώει ο γεωκωδικοποιητής.
 *
 * 🔴 Ήταν **τέσσερις** συναρτήσεις με τέσσερα ονόματα και ένα σχήμα: `toResolvedFromAddr`
 * (κτίρια) · `branchToResolvedFields` (επαφές) · `toResolvedFields` (καρτέλα τοποθεσιών) ·
 * `formDataToResolvedFields` (φόρμα επαφής). Διέφεραν ακριβώς σε ό,τι ξέρει ο πίνακας: οι
 * επαφές προτιμούν `regionName` πριν το ελεύθερο `region` και κουβαλούν `country`· η φόρμα
 * επαφής προτιμά `settlement` πριν το `city` και λέει το `number` **`streetNumber`**.
 *
 * ⚠️ **Τα δύο πρώτα τα έπιασε η CHECK 3.28· τα δύο τελευταία ΟΧΙ** — και ο λόγος αξίζει:
 * το `jscpd --diff` βλέπει **μόνο τα αρχεία του diff**, και εκείνα τα δύο δεν τα είχα
 * αγγίξει. **Μια πύλη diff δεν είναι απογραφή**· ό,τι δεν στέλνεις, δεν κοιτάζεται.
 *
 * ⚠️ Το `neighborhood` διαβάζεται **κυριολεκτικά**, με το όνομά του, και είναι σκόπιμο: το
 * πεδίο «Περιοχή / Συνοικία» του `AddressEditor` είναι δεμένο σε αυτό το όνομα σε **κάθε**
 * δοχείο. Το *τι σημαίνει* ανά τομέα είναι το ανοιχτό ερώτημα του ADR-772 §5 και **δεν**
 * λύνεται σιωπηλά εδώ — αυτή η συνάρτηση μεταφέρει, δεν αποφασίζει.
 */
export function storedAddressToResolved(
  source: Readonly<Record<string, unknown>>,
  vocabulary: 'projectAddress' | 'companyAddress' | 'contactFlat',
): ResolvedAddressFields {
  const projected = projectAddressVocabulary(source, vocabulary, 'addressInfo', {
    includePostal: true,
    clearedIdsAsNull: false,
  });
  const text = (value: string | null | undefined): string | undefined =>
    typeof value === 'string' && value !== '' ? value : undefined;

  return {
    street: text(projected.street),
    number: text(projected.number),
    postalCode: text(projected.postalCode),
    // Ο οικισμός είναι η «πόλη» σε κάθε δοχείο — ο πίνακας το δηλώνει, δεν το μαντεύουμε.
    city: text(projected.settlement),
    neighborhood: text(source.neighborhood as string | undefined),
    region: text(projected.region),
    country: text(projected.country),
  };
}

export function hierarchyToResolvedAddress(
  value: Partial<AddressWithHierarchyValue>,
): ResolvedAddressFields {
  return {
    street: value.street || undefined,
    number: value.number || undefined,
    postalCode: value.postalCode || undefined,
    city: resolveCityFromHierarchy(value) || undefined,
    neighborhood: value.communityName || undefined,
    region: value.regionName || undefined,
  };
}
