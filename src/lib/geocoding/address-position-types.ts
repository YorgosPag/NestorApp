/**
 * @fileoverview Οι **τύποι** του ενός γραφέα θέσης — `lib/geocoding/address-position`.
 * @module lib/geocoding/address-position-types
 *
 * Εξήχθησαν **αυτούσιοι** από το `address-position.ts` (499/500 γρ., N.7.1) — ADR-332 D27 Βήμα Β.
 * ⚠️ Οι καταναλωτές εισάγουν **πάντα** από το `address-position`, που τα επανεξάγει όλα: αυτό το
 * αρχείο είναι οργάνωση, όχι νέα δημόσια επιφάνεια.
 */

import type { GeocodingAccuracy, GeocodingVariant } from './geocoding-types';
import type { GeoBoundingBox } from '@/types/geo/coordinates';

// ============================================================================
// ΕΙΣΟΔΟΙ — δομικές, ΟΧΙ δεμένες σε ονομασμένο τύπο
// ============================================================================

/**
 * Τα πεδία κειμένου που **ορίζουν** τη γεωγραφική ταυτότητα μιας διεύθυνσης.
 *
 * 🔑 **Η ΜΟΝΗ λίστα.** Ως τις 2026-09-10 ζούσε δίδυμη στον πελάτη (`ADDRESS_GEOCODING_FIELDS`,
 * `address-map-config.tsx`) και ένα test κρατούσε τις δύο ίσες. Εκείνη τροφοδοτούσε τον ανιχνευτή
 * «Παλιές συντεταγμένες» του χάρτη — **δεύτερο κριτή θέσης** πάνω σε διευθύνσεις που αυτό το
 * module είχε ήδη κρίνει (ADR-332 D27 Β10). Ο ανιχνευτής και η λίστα του αφαιρέθηκαν μαζί.
 */
export const ADDRESS_IDENTITY_FIELDS = [
  'street',
  'number',
  'city',
  'neighborhood',
  'postalCode',
  'municipality',
  'region',
  'regionalUnit',
  'country',
] as const;

export type AddressIdentityField = (typeof ADDRESS_IDENTITY_FIELDS)[number];

/**
 * Η διεύθυνση όπως τη βλέπει ο γραφέας — **δομικός** τύπος.
 *
 * Ίδιο ιδίωμα με το `ProjectableProperty`, και ο λόγος είναι ο ίδιος: την ίδια ερώτηση
 * τη ρωτούν το `ProjectAddress`, το `ContactAddress` και τα ωμά δεδομένα Firestore του
 * διακομιστή. Ένας ονομασμένος τύπος θα ανάγκαζε `as` σε κάθε καλούντα — δηλαδή θα
 * μετέτρεπε μια πραγματική ασυμφωνία σχημάτων σε cast.
 */
export type AddressLike = {
  readonly [K in AddressIdentityField]?: string | null;
} & {
  readonly coordinates?: { readonly lat?: number | null; readonly lng?: number | null } | null;
  readonly geocodingMetadata?: AddressGeocodingMetadata | null;
  /** Η **δήλωση** του πελάτη — `'dragged'` = «το σημείο το έβαλε άνθρωπος» (κανόνας 1). */
  readonly source?: string | null;
  /**
   * Πότε επιβεβαιώθηκε η θέση (unix-ms). Δηλωμένο εδώ ώστε μια αποθήκευση που **δεν** αγγίζει
   * τη θέση να το **κρατά** — ως τις 2026-09-10 σβηνόταν σε κάθε τέτοια αποθήκευση (άγκυρα Ζ).
   */
  readonly verifiedAt?: number | null;
};

/** Τα παγωμένα μεταδεδομένα ποιότητας — **το σχήμα του `ProjectAddress`, αυτούσιο**. */
export interface AddressGeocodingMetadata {
  readonly confidence: number;
  readonly accuracy: GeocodingAccuracy;
  readonly variantUsed: number;
  readonly osmType?: string;
}

/** Ό,τι χρειάζεται ο γραφέας από μια απάντηση γεωκωδικοποίησης. */
export interface GeocodeHit {
  readonly lat: number;
  readonly lng: number;
  readonly accuracy: GeocodingAccuracy;
  readonly confidence: number;
  readonly variantUsed?: GeocodingVariant;
  readonly osmType?: string;
  /**
   * Η **μετρημένη** έκταση του αποτελέσματος (ο Nominatim τη δίνει ως `boundingbox`). Ο γραφέας
   * δεν την αποθηκεύει — τη χρειάζεται για να μετρήσει **πόσο αβέβαιη** είναι η μηχανή (Φ2β).
   */
  readonly extent?: GeoBoundingBox;
}

/**
 * Ο γεωκωδικοποιητής, **ενθυλακωμένος**.
 *
 * 🔑 **Παράμετρος και όχι εισαγωγή, για δύο μετρημένους λόγους:**
 *
 * 1. Η πραγματική `geocode()` ζει στο `app/api/geocoding/geocoding-engine.ts`. Το
 *    `services/places/place-source-verification.ts` την εισάγει από εκεί και **δηλώνει
 *    το χρέος στρωμάτωσης στο ίδιο του το σχόλιο**. Ένα δεύτερο αρχείο με το ίδιο χρέος
 *    δεν είναι επανάληψη κώδικα — είναι επανάληψη **λάθους**.
 * 2. Η απόφαση του γραφέα είναι **λογική**, όχι δίκτυο. Ενθυλακωμένη, ελέγχεται
 *    εξαντλητικά **χωρίς καμία κλήση δικτύου** — και ο έλεγχος είναι που κάνει τις
 *    καταστάσεις πραγματικές αντί για δηλωμένες.
 *
 * ⚠️ **Το συμβόλαιο έχει ΤΡΕΙΣ εκβάσεις, όχι δύο.** `null` = *«ρώτησα, δεν υπάρχει»*·
 * **εξαίρεση** = *«δεν μπόρεσα να ρωτήσω»*. Δες {@link AddressPositionOutcome}.
 */
export type AddressGeocoder = (query: GeocoderQuery) => Promise<GeocodeHit | null>;

/** Το ερώτημα προς τον γεωκωδικοποιητή — τα πεδία ταυτότητας, καθαρισμένα. */
export type GeocoderQuery = {
  readonly [K in AddressIdentityField]?: string;
};

// ============================================================================
// ΕΞΟΔΟΣ — κλειστή ένωση καταστάσεων, καμία σιωπή
// ============================================================================

/**
 * **Τι έγινε**, ονομαστικά. Επτά καταστάσεις, καμία `default`.
 *
 * 🔴 **Ο λόγος που δεν είναι δύο** είναι ότι αρκετές οδηγούν σε **αντίθετες** πράξεις πάνω στα
 * ίδια αποθηκευμένα δεδομένα:
 *
 * - `unresolved` ⇒ **σβήνει** τη θέση. Η διεύθυνση άλλαξε και δεν λύνεται· κρατώντας
 *   την παλιά συντεταγμένη θα δείχναμε το **προηγούμενο** κτίριο για τη **νέα**
 *   διεύθυνση. Η Α5 απαιτεί να λέμε *ό,τι ξέρουμε*, όχι το ασφαλέστερο.
 * - `geocoder-unavailable` ⇒ **κρατά** τη θέση αμετάβλητη. Δεν μάθαμε τίποτα· μια
 *   διακοπή δικτύου δεν είναι γνώση, και **δεν επιτρέπεται να σβήσει** σωστό σημείο.
 * - `unchanged` ⇒ **κρατά** τη θέση αυτούσια, **μαζί με την προέλευσή της**.
 * - `human-kept` ⇒ **κρατά** το σημείο του ανθρώπου παρά την αλλαγή κειμένου (Φ2β).
 *
 * ⚠️ Οι δύο πρώτες θα ήταν **ταυτόσημες** αν ο γεωκωδικοποιητής επέστρεφε `null` και
 * στις δύο περιπτώσεις — και η ζημιά θα ήταν **σιωπηλή απώλεια θέσεων σε κάθε διακοπή**.
 */
export type AddressPositionOutcome =
  /** Ο άνθρωπος έσυρε την πινέζα. Το σημείο **είναι** η απάντηση — καμία κλίμακα ακρίβειας. */
  | 'human-pinned'
  /**
   * Το κείμενο άλλαξε, η πινέζα του ανθρώπου **έμεινε** (ADR-332 D27 Βήμα Β, Φ2β). Πρακτική
   * Revit / Apple Maps / Salesforce Verified — με μετρημένη απόκλιση, που εκείνοι δεν δίνουν.
   */
  | 'human-kept'
  /** Η μηχανή έλυσε το κείμενο, και η ακρίβεια ταξιδεύει μαζί. */
  | 'geocoded'
  /** Τίποτα σχετικό δεν άλλαξε — η αποθηκευμένη θέση μένει **αυτούσια**. */
  | 'unchanged'
  /** Ρωτήθηκε και **δεν υπάρχει**. Η θέση σβήνεται. */
  | 'unresolved'
  /** **Δεν μπόρεσε να ρωτηθεί.** Η αποθηκευμένη θέση μένει άθικτη. */
  | 'geocoder-unavailable'
  /** Δεν υπάρχει αρκετό κείμενο για να τεθεί ερώτημα (ούτε οδός ούτε πόλη). */
  | 'insufficient-address';

/**
 * Οι προελεύσεις που παράγει ο γραφέας — **πίνακας χρόνου εκτέλεσης**, ώστε ένα σύνορο (η
 * διαδρομή θέσης των επαφών, ADR-332 D27 Β-ΙΙ) να στενεύει την είσοδο με `z.enum` αντί για cast.
 * Ο τύπος **παράγεται** από τον πίνακα· δεν ξαναγράφεται.
 */
export const WRITTEN_ADDRESS_SOURCES = ['geocoded', 'dragged', 'manual'] as const;

/** Η προέλευση όπως αποθηκεύεται — υποσύνολο του `AddressSourceType`, τα τρία που παράγει ο γραφέας. */
export type WrittenAddressSource = (typeof WRITTEN_ADDRESS_SOURCES)[number];

/**
 * Ό,τι πρέπει να γραφτεί στη διεύθυνση, **ολόκληρο**.
 *
 * 🔴 **Τα τέσσερα πεδία ταξιδεύουν ΜΑΖΙ, και εκεί είναι όλο το νόημα.** Ένας τύπος που
 * επέστρεφε μόνο `{ lat, lng }` είναι ακριβώς αυτό που **έκανε** το
 * `geocodePrimaryAddress` των κτιρίων — και γι' αυτό η ακρίβεια **χανόταν** εκεί
 * *(διαγράφηκε 2026-08-25· ο μόνος τρόπος να μην επανέλθει είναι να μη γίνεται να
 * εκφραστεί)*. Ο καλών **δεν μπορεί** να γράψει σημείο χωρίς να πει από πού ήρθε και πόσο
 * καλό είναι: δεν υπάρχει τιμή που να το εκφράζει.
 *
 * ⚠️ **`null` σημαίνει «σβήσε το», `undefined` δεν υπάρχει εδώ.** Η διάκριση είναι
 * σκόπιμη: ο καλών γράφει Firestore, όπου το «λείπει το κλειδί» και το «η τιμή είναι
 * κενή» είναι **διαφορετικές** πράξεις. Δες `applyAddressPosition`.
 */
export interface AddressPosition {
  readonly coordinates: { readonly lat: number; readonly lng: number } | null;
  readonly geocodingMetadata: AddressGeocodingMetadata | null;
  readonly source: WrittenAddressSource | null;
  /** Unix-ms — πότε επιβεβαιώθηκε αυτή η θέση. `null` όταν δεν υπάρχει θέση. */
  readonly verifiedAt: number | null;
}

/**
 * Η πινέζα του ανθρώπου **έμεινε**, αλλά η νέα διεύθυνση λύνεται **μακριά** της (Φ2β).
 * `toleranceMetres` = `max(ακτίνα αβεβαιότητας της μηχανής, HUMAN_PIN_DRIFT_FLOOR_METRES)`.
 */
export interface PositionDrift {
  readonly distanceMetres: number;
  readonly toleranceMetres: number;
}

/** Η απόκλιση μιας **συγκεκριμένης** διεύθυνσης — ταξιδεύει ως τον άνθρωπο με την ταυτότητά της. */
export interface AddressPositionDrift extends PositionDrift {
  readonly addressId: string;
}

/**
 * Ρητή δήλωση του ανθρώπου για **αυτή** την αποθήκευση — ποτέ αποθηκευμένη.
 * `relocate` = «μετακίνησε την πινέζα στη θέση της διεύθυνσης» (απάντηση στη συμβουλή απόκλισης).
 */
export interface AddressPositionIntent {
  readonly relocate?: boolean;
}

/** Η πλήρης απάντηση: **τι** να γραφτεί, **γιατί** — και, όταν υπάρχει, **πόσο αποκλίνει**. */
export interface AddressPositionResolution {
  readonly outcome: AddressPositionOutcome;
  readonly position: AddressPosition;
  readonly drift?: PositionDrift;
}

/** Πλήθος ανά έκβαση. Κάθε κάδος υπάρχει **ακόμη και στο μηδέν**. */
export type AddressPositionTally = Readonly<Record<AddressPositionOutcome, number>>;

/** Οι ρητές δηλώσεις μιας αποθήκευσης **εγγράφου** — ανά ταυτότητα διεύθυνσης, ποτέ ανά δείκτη. */
export interface ResolveAddressPositionsOptions {
  readonly relocateIds?: ReadonlySet<string>;
}

/** Το αποτέλεσμα για ολόκληρο έγγραφο: οι νέες διευθύνσεις, η λογιστική, οι αποκλίσεις. */
export interface ResolvedAddressPositions<T> {
  readonly addresses: readonly T[];
  readonly tally: AddressPositionTally;
  readonly drifts: readonly AddressPositionDrift[];
}
