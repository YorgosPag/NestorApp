// 🏢 ENTERPRISE: Project Address System
// ADR-167: Enterprise Multi-Address Projects with Building Inheritance
// Based on: SAP multi-address, Salesforce ContactPointAddress, Procore Locations

/**
 * Project address types - following enterprise ERP/CRM patterns
 * 🏢 ENTERPRISE: Single Source of Truth for address type validation
 * SAP: address usage roles
 * Salesforce: ContactPointAddress with usage classification
 */
export const PROJECT_ADDRESS_TYPES = [
  'site',           // Construction site / main location
  'entrance',       // Building entrance
  'delivery',       // Material delivery point
  'legal',          // Legal/administrative address
  'postal',         // Postal/mailing address
  'billing',        // Billing address
  'correspondence', // Correspondence address
  'other',          // Custom use case
] as const;

/**
 * Derive type from runtime array (SSoT pattern)
 */
export type ProjectAddressType = typeof PROJECT_ADDRESS_TYPES[number];

/**
 * Block side directions for buildings facing multiple streets
 * 🏢 ENTERPRISE: Single Source of Truth for block side validation
 * Based on: Google Maps Platform building entrances
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
  'internal',
] as const;

/**
 * Derive type from runtime array (SSoT pattern)
 */
export type BlockSideDirection = typeof BLOCK_SIDE_DIRECTIONS[number];

/**
 * Complete project address definition
 * Enterprise pattern: Primary + Secondary with type/role classification
 */
export interface ProjectAddress {
  /** Unique identifier */
  id: string;

  /** Street name */
  street: string;

  /** Street number (optional for entrances without clear numbering) */
  number?: string;

  /** City */
  city: string;

  /** Postal code */
  postalCode: string;

  /** Region/State (optional) */
  region?: string;

  /** Country */
  country: string;

  /** Address type/usage */
  type: ProjectAddressType;

  /** Primary address flag - exactly ONE per project (Zod invariant) */
  isPrimary: boolean;

  /** Human-readable label (e.g., "Είσοδος Α - Σαμοθράκης 16") */
  label?: string;

  /** Block side for multi-frontage buildings */
  blockSide?: BlockSideDirection;

  /** Block side description (e.g., "Νότια πλευρά, γωνία") */
  blockSideDescription?: string;

  /** ΚΑΕΚ (Κωδικός Αριθμός Εντοπισμού Κτημάτων) - Greek Cadastral Code */
  cadastralCode?: string;

  /** Municipality */
  municipality?: string;

  /** Neighborhood */
  neighborhood?: string;

  /** Geographic coordinates (GIS-ready) */
  coordinates?: {
    lat: number;
    lng: number;
  };

  /** Sort order for display (lower = higher priority) */
  sortOrder?: number;
}

/**
 * Building address configuration - INHERITANCE PATTERN
 * Buildings reference Project addresses instead of duplicating data
 *
 * Enterprise pattern: Reference + controlled overrides
 * Procore: Location hierarchy
 * Autodesk: Location Breakdown Structure (LBS)
 */
export interface BuildingAddressReference {
  /** Inherit from project addresses (default: true) */
  inheritFromProject: boolean;

  /**
   * Reference to ProjectAddress.id
   * REQUIRED when inheritFromProject=true (Zod invariant)
   */
  projectAddressId?: string;

  /**
   * Controlled overrides - only for permitted fields
   * Enterprise pattern: override only what's necessary (label, coordinates)
   * NOT full address duplication
   */
  override?: Partial<Pick<ProjectAddress, 'label' | 'coordinates' | 'blockSideDescription'>>;
}
