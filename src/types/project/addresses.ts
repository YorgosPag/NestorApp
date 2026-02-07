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
 *
 * @file addresses.ts
 * @created 2026-02-02
 */

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
  /** Region (e.g., "Κεντρική Μακεδονία") */
  region?: string;
  /** Country (default: "Greece") */
  country: string;

  // 🏷️ Classification
  /** Address type */
  type: ProjectAddressType;
  /** Is this the primary address? */
  isPrimary: boolean;
  /** Optional label (e.g., "Κύρια Είσοδος") */
  label?: string;

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
  /** Neighborhood (e.g., "Άνω Τούμπα") */
  neighborhood?: string;

  // 🗺️ Geographic
  /** GPS coordinates for mapping */
  coordinates?: {
    lat: number;
    lng: number;
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
 */
export type PartialProjectAddress = Partial<ProjectAddress> & {
  street: string; // Street is required
  city: string;   // City is required
};

/**
 * Address update payload (excludes id)
 */
export type ProjectAddressUpdate = Partial<Omit<ProjectAddress, 'id'>>;
