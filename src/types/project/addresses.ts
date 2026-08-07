/**
 * =============================================================================
 * 🏢 ENTERPRISE PROJECT ADDRESS SYSTEM
 * =============================================================================
 *
 * Multi-address support for construction projects
 * Supports buildings with multiple street sides
 *
 * Pattern: SAP Real Estate, Salesforce CPQ, Procore
 *
 * Features:
 * - Multiple addresses per project
 * - Primary/secondary classification
 * - Block side tracking (north, south, east, west)
 * - Address type taxonomy (site, entrance, delivery, legal)
 * - Greek cadastral code support (ΚΑΕΚ)
 * - Provenance + freshness metadata (ADR-332 §3.10 / Phase 8)
 *
 * @file addresses.ts
 * @created 2026-02-02
 */

import type {
  AddressSourceType,
  GeocodingAccuracy,
} from '@/lib/geocoding/geocoding-types';

// =============================================================================
// ADDRESS TYPES & ENUMS
// =============================================================================

/**
 * Block side directions for multi-sided buildings
 * Common in Greek urban construction (οικοδομικά τετράγωνα)
 */
export type BlockSideDirection =
  | 'north'      // Βόρεια πλευρά
  | 'south'      // Νότια πλευρά
  | 'east'       // Ανατολική πλευρά
  | 'west'       // Δυτική πλευρά
  | 'northeast'  // Βορειοανατολική
  | 'northwest'  // Βορειοδυτική
  | 'southeast'  // Νοτιοανατολική
  | 'southwest'  // Νοτιοδυτική
  | 'corner'     // Γωνιακή πλευρά
  | 'internal';  // Εσωτερική (χωρίς πρόσοψη)

/**
 * Runtime list of block side directions (SSoT for validation)
 */
export const BLOCK_SIDE_DIRECTIONS = [
  'north',
  'south',
  'east',
  'west',
  'northeast',
  'northwest',
  'southeast',
  'southwest',
  'corner',
  'internal'
] as const;
/**
 * Address type taxonomy for construction projects
 */
export type ProjectAddressType =
  | 'site'           // Γενική διεύθυνση εργοταξίου
  | 'entrance'       // Κύρια είσοδος
  | 'delivery'       // Παράδοση υλικών
  | 'legal'          // Νομική έδρα
  | 'postal'         // Ταχυδρομική διεύθυνση
  | 'billing'        // Διεύθυνση τιμολόγησης
  | 'correspondence' // Αλληλογραφία
  | 'frontage'       // Πρόσωπο οικοπέδου (ADR-167 Phase 2.5 / ADR-186)
  | 'other';         // Άλλο

/**
 * Runtime list of address types (SSoT for validation)
 */
export const PROJECT_ADDRESS_TYPES = [
  'site',
  'entrance',
  'delivery',
  'legal',
  'postal',
  'billing',
  'correspondence',
  'frontage',
  'other'
] as const;

// =============================================================================
// MAIN INTERFACES
// =============================================================================

/**
 * Project address with full metadata
 * Supports Greek construction industry requirements
 */
export interface ProjectAddress {
  /** Unique identifier */
  id: string;

  // 📍 Basic address fields
  /** Street name (e.g., "Σαμοθράκης") */
  street: string;
  /** Street number (e.g., "16") */
  number?: string;
  /** City (e.g., "Θεσσαλονίκη") */
  city: string;
  /** Postal code (e.g., "54621") */
  postalCode: string;
  /** Region / Περιφέρεια (e.g., "Κεντρική Μακεδονία") */
  region?: string;
  /** Regional Unit / Περιφερειακή Ενότητα (e.g., "Π.Ε. Θεσσαλονίκης") */
  regionalUnit?: string;
  /** Country (default: "Greece") */
  country: string;

  // 🏷️ Classification
  /** Address type */
  type: ProjectAddressType;
  /** Is this the primary address? */
  isPrimary: boolean;
  /** Optional label (e.g., "Κύρια Είσοδος") */
  label?: string;
  /** For type='frontage': 1-based index matching PlotFrontage.index (ADR-186 Phase 2.5) */
  frontageIndex?: number;

  // 🏗️ Construction-specific
  /** Which side of the building block */
  blockSide?: BlockSideDirection;
  /** Human-readable description (e.g., "Πρόσοψη επί Σαμοθράκης") */
  blockSideDescription?: string;

  // 🇬🇷 Greek cadastral system
  /** Κτηματολογικός Αναγνωριστικός Κωδικός (ΚΑΕΚ) */
  cadastralCode?: string;
  /** Municipality (e.g., "Δήμος Καλαμαριάς") */
  municipality?: string;
  /**
   * Municipal Unit / Δημοτική Ενότητα (e.g., "Δ.Ε. Ευόσμου") — Καλλικράτης level 6.
   *
   * 🔴 **ADR-759 Φ3 — δεν είναι νέα έννοια, είναι το μισό round-trip που έλειπε.** Ο επιλογέας
   * Δημοτικής Ενότητας ζωγραφίζεται ήδη στην καρτέλα τοποθεσιών του έργου
   * (`address-with-hierarchy-config.ts:116`, επίπεδο 6) και ο χρήστης τον συμπληρώνει — αλλά το
   * `fromHierarchyValue` **δεν τον χαρτογραφούσε πουθενά** και το `toHierarchyValue` επέστρεφε
   * σταθερά `''`. Δηλαδή η τιμή **χανόταν στην αποθήκευση, χωρίς μήνυμα**, και το πεδίο
   * ξαναφαινόταν άδειο στο επόμενο άνοιγμα.
   *
   * Ίδια λέξη με το domain επαφών (`address-info-builder.ts:82`) — **ένα** λεξιλόγιο διοικητικής
   * διαίρεσης, δύο δοχεία.
   */
  municipalUnit?: string;
  /**
   * Neighborhood (e.g., "Άνω Τούμπα").
   *
   * 🔴 **ADR-772 §5 — ΑΝΟΙΧΤΟ: εδώ αποθηκεύεται ΚΑΙ η Κοινότητα (επίπεδο 7).** Το
   * `LocationInlineForm` ζωγραφίζει αυτό το πεδίο ως «Περιοχή / Συνοικία»
   * (`showNeighborhoodRegion`), το δένει στο `communityName` της ιεραρχίας, και ο
   * γεωκωδικοποιητής το χρησιμοποιεί ως όρο αναζήτησης. Οι **επαφές** αντίθετα δηλώνουν
   * ρητά ότι το `neighborhood` είναι ελεύθερο κείμενο **εκτός** ιεραρχίας και έχουν
   * χωριστό `communityName` (`ContactFormTypes.ts`). Δύο τομείς, δύο σημασίες, ίδια λέξη.
   * ⛔ **ΜΗΝ το χωρίσεις σε δικό του `community` πεδίο χωρίς εντολή**: είναι αλλαγή
   * **ορατής συμπεριφοράς** (το πεδίο αδειάζει σε υπάρχουσες εγγραφές) και ερώτημα τομέα,
   * όχι τεχνική εκκρεμότητα. Γι' αυτό λείπει και το `communityId` παρακάτω.
   */
  neighborhood?: string;

  // 🇬🇷 Ανώτερα διοικητικά επίπεδα (Καλλικράτης 1-2) — ADR-772
  /**
   * Αποκεντρωμένη Διοίκηση (επίπεδο 2, π.χ. «Α.Δ. Μακεδονίας - Θράκης»).
   *
   * 🔴 Ο επιλογέας υπήρχε στην οθόνη· ο μετατροπέας επέστρεφε σταθερά `''` και δεν
   * χαρτογραφούσε πουθενά ⇒ η επιλογή **χανόταν στην αποθήκευση χωρίς μήνυμα**.
   */
  decentAdmin?: string;
  /** Γεωγραφική Ενότητα (επίπεδο 1, π.χ. «Βόρεια Ελλάδα») — ίδιο περιστατικό. */
  majorGeo?: string;

  // 🔗 Ταυτότητες διοικητικής ιεραρχίας (ΕΛΣΤΑΤ/Καλλικράτης) — ADR-772
  /**
   * Οι σταθερές ταυτότητες των επιπέδων. Η οθόνη τις παρήγαγε **και τις 8**· κανένα
   * δοχείο έργου δεν είχε πού να τις βάλει, οπότε πετιόνταν όλες.
   *
   * 🔑 **Γιατί δεν αρκούν τα ονόματα**: το όνομα είναι κείμενο που γερνάει (μετονομασίες
   * δήμων, ορθογραφία, τόνοι). Η ταυτότητα είναι το μόνο που επιτρέπει **επανεπίλυση** της
   * ιεραρχίας αν αλλάξει το σύνολο δεδομένων — χωρίς αυτή, μια εγγραφή του 2026 δεν μπορεί
   * ποτέ να ξαναδεθεί με βεβαιότητα στο δέντρο.
   *
   * ⚠️ Λείπει σκόπιμα το `communityId` — βλ. το ανοιχτό ερώτημα στο `neighborhood`.
   */
  settlementId?: string | null;
  municipalUnitId?: string | null;
  municipalityId?: string | null;
  regionalUnitId?: string | null;
  regionId?: string | null;
  decentAdminId?: string | null;
  majorGeoId?: string | null;

  // 🗺️ Geographic
  /** GPS coordinates for mapping */
  coordinates?: {
    lat: number;
    lng: number;
  };

  // 🔍 Provenance & verification (ADR-332 §3.10 / Phase 8)
  /**
   * How this address was acquired. Drives the `<AddressSourceLabel>` chip in
   * read-only views and source attribution in correction telemetry.
   * Optional — pre-Phase-8 records fall back to `'unknown'` at render time.
   */
  source?: AddressSourceType;
  /**
   * Unix-ms timestamp of the last successful geocoding / reverse-geocoding
   * cycle for this record. Drives `<AddressFreshnessIndicator>` (never /
   * fresh / recent / aging / stale).
   */
  verifiedAt?: number;
  /**
   * Frozen geocoding metadata captured at write time. Lets read-only surfaces
   * show confidence + accuracy + the engine variant that produced this hit
   * without re-querying Nominatim.
   */
  geocodingMetadata?: {
    confidence: number;
    accuracy: GeocodingAccuracy;
    variantUsed: number;
    osmType?: string;
  };

  // 📊 Ordering
  /** Sort order for display (lower = first) */
  sortOrder?: number;
}

/**
 * Building address reference - Inheritance pattern
 * Buildings can inherit from project or have custom address
 */
export interface BuildingAddressReference {
  /** Should inherit address from parent project? */
  inheritFromProject: boolean;
  /** If inheriting, which project address? */
  projectAddressId?: string;
  /** Override specific fields (e.g., different floor/unit number) */
  override?: Partial<ProjectAddress>;
}

// =============================================================================
// HELPER TYPES
// =============================================================================

/**
 * Partial address for forms (before full validation)
 * Note: street is optional — settlements/villages (οικισμοί/χωριά) may not have streets
 */
export type PartialProjectAddress = Partial<ProjectAddress> & {
  city: string;   // City/settlement is required
};

/**
 * Address update payload (excludes id)
 */
export type ProjectAddressUpdate = Partial<Omit<ProjectAddress, 'id'>>;


