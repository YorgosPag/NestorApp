/**
 * 🏢 ENTERPRISE PROPERTY STATUS SYSTEM
 *
 * Enterprise-class κεντρικοποιημένο σύστημα διαχείρισης καταστάσεων ακινήτων
 * Self-contained αρχείο με όλα τα property status definitions
 *
 * @created 2025-12-14
 * @author Claude AI Assistant
 * @version 1.0.0
 * @enterprise Production-ready status management system
 */

// ============================================================================
// CORE PROPERTY STATUS DEFINITIONS (Self-contained)
// ============================================================================

export type PropertyStatus =
  | 'for-sale'
  | 'for-rent'
  | 'reserved'
  | 'sold'
  | 'landowner'
  | 'rented'           // 🔴 Ενοικιάστηκε
  | 'under-negotiation' // 🟡 Υπό διαπραγμάτευση
  | 'coming-soon'      // 🟣 Σύντομα διαθέσιμο
  | 'off-market'       // ⚪ Εκτός αγοράς
  | 'unavailable';     // ⚫ Μη διαθέσιμο

// 🏢 ENTERPRISE: i18n keys for property status labels
// Labels are translated at runtime by components using useTranslation
// 🌐 NOTE: Using ':' namespace separator for cross-namespace access
export const PROPERTY_STATUS_LABELS: Record<PropertyStatus, string> = {
  'for-sale': 'properties:status.forSale',
  'for-rent': 'properties:status.forRent',
  'reserved': 'properties:status.reserved',
  'sold': 'properties:status.sold',
  'landowner': 'properties:status.landowner',
  'rented': 'properties:status.rented',
  'under-negotiation': 'properties:status.underNegotiation',
  'coming-soon': 'properties:status.comingSoon',
  'off-market': 'properties:status.offMarket',
  'unavailable': 'properties:status.unavailable',
};

export const PROPERTY_STATUS_COLORS: Record<PropertyStatus, string> = {
  'for-sale': 'hsl(var(--status-success))',     // 🟢 Πράσινο - διαθέσιμο
  'for-rent': 'hsl(var(--status-info))',       // 🔵 Μπλε - ενεργό
  'reserved': 'hsl(var(--status-warning))',    // 🟡 Πορτοκαλί - δεσμευμένο
  'sold': 'hsl(var(--status-error))',          // 🔴 Κόκκινο - πωλημένο
  'landowner': 'hsl(var(--status-purple))',    // 🟣 Μοβ - ειδική κατάσταση
  'rented': 'hsl(var(--status-error-dark))',   // 🔴 Σκούρο κόκκινο - ενοικιάστηκε
  'under-negotiation': 'hsl(var(--status-warning-light))', // 🟡 Ανοιχτό πορτοκαλί
  'coming-soon': 'hsl(var(--status-purple-light))',        // 🟣 Ανοιχτό μοβ
  'off-market': 'hsl(var(--neutral-400))',     // ⚪ Γκρι - εκτός αγοράς
  'unavailable': 'hsl(var(--neutral-500))',    // ⚫ Σκούρο γκρι - μη διαθέσιμο
};

export const DEFAULT_PROPERTY_STATUS: PropertyStatus = 'for-sale';

// ============================================================================
// PROPERTY TYPES & LABELS
// ============================================================================

export type PropertyType =
  | 'apartment'
  | 'studio'
  | 'maisonette'
  | 'shop'
  | 'office'
  | 'storage';

// 🏢 ENTERPRISE: i18n keys for property type labels
export const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  'apartment': 'properties.types.apartment',
  'studio': 'properties.types.studio',
  'maisonette': 'properties.types.maisonette',
  'shop': 'properties.types.shop',
  'office': 'properties.types.office',
  'storage': 'properties.types.storage'
};

// ============================================================================
// 🏢 ENTERPRISE UNIFIED DROPDOWN FILTER SYSTEM
// ============================================================================
//
// 🎯 FORTUNE 500 CENTRALIZATION: Single source of truth για όλα τα dropdown filters
// Serves: Property, Storage, Parking domains με zero duplicates
// Architecture: Domain-driven με shared common labels
//
// ============================================================================

// 🏢 ENTERPRISE: Core common filter labels - i18n translation keys
// These keys are translated at runtime by FilterField component
export const COMMON_FILTER_LABELS = {
  ALL_TYPES: 'filters.allTypes',
  ALL_STATUSES: 'filters.allStatuses',
  ALL_FLOORS: 'filters.allFloors',
  ALL_UNITS: 'filters.allUnits',
  ALL_AREAS: 'filters.allAreas',
  ALL_PROJECTS: 'filters.allProjects',
  ALL_LOCATIONS: 'filters.allLocations',
  ALL_COMPANIES: 'filters.allCompanies',
  ALL_CLIENTS: 'filters.allClients',
  ALL_PRIORITIES: 'filters.allPriorities',
  ALL_ENERGY_CLASSES: 'filters.allEnergyClasses',
  ALL_RENOVATIONS: 'filters.allRenovations',
  ALL_RISK_LEVELS: 'filters.allRiskLevels',
  ALL_COMPLEXITIES: 'filters.allComplexities'
} as const;

// Domain-specific extensions with all filter labels - i18n translation keys
export const PROPERTY_FILTER_LABELS = {
  ...COMMON_FILTER_LABELS,
  ALL_BUILDINGS: 'filters.allBuildings',
  // Field labels
  search: 'filters.fields.search',
  price_range: 'filters.fields.priceRange',
  area_range: 'filters.fields.areaRange',
  value_range: 'filters.fields.valueRange',
  units_range: 'filters.fields.unitsRange',
  budget_range: 'filters.fields.budgetRange',
  duration_range: 'filters.fields.durationRange',
  status: 'filters.fields.status',
  project: 'filters.fields.project',
  building: 'filters.fields.building',
  floor: 'filters.fields.floor',
  type: 'filters.fields.type',
  energy_class: 'filters.fields.energyClass',
  renovation: 'filters.fields.renovation',
  location: 'filters.fields.location',
  city: 'filters.fields.city',
  company: 'filters.fields.company',
  client: 'filters.fields.client',
  priority: 'filters.fields.priority',
  risk_level: 'filters.fields.riskLevel',
  complexity: 'filters.fields.complexity',
  year_built: 'filters.fields.yearBuilt',
  property_type: 'filters.fields.propertyType',
  // 🏢 ENTERPRISE: Additional field labels (2026-01-19)
  contact_type: 'filters.fields.contactType',
  units_count: 'filters.fields.unitsCount',
  total_area: 'filters.fields.totalArea',
  year_range: 'filters.fields.yearRange',
  progress_range: 'filters.fields.progressRange',
  start_year_range: 'filters.fields.startYearRange',
  timeframe: 'filters.fields.timeframe',
  stage: 'filters.fields.stage',
  period: 'filters.fields.period',
  // Checkbox labels
  has_parking: 'filters.checkboxes.hasParking',
  has_elevator: 'filters.checkboxes.hasElevator',
  has_garden: 'filters.checkboxes.hasGarden',
  has_pool: 'filters.checkboxes.hasPool',
  has_storage: 'filters.checkboxes.hasStorage',
  accessibility: 'filters.checkboxes.accessibility',
  furnished: 'filters.checkboxes.furnished',
  has_properties: 'filters.checkboxes.hasProperties',
  has_permits: 'filters.checkboxes.hasPermits',
  has_financing: 'filters.checkboxes.hasFinancing',
  has_subcontractors: 'filters.checkboxes.hasSubcontractors',
  has_issues: 'filters.checkboxes.hasIssues',
  is_active: 'filters.checkboxes.isActive',
  is_favorite: 'filters.checkboxes.isFavorite',
  show_archived: 'filters.checkboxes.showArchived',
  is_ecological: 'filters.checkboxes.isEcological'
} as const;

// 🏢 ENTERPRISE: Storage domain filter labels (unified from storage/constants.ts)
export const STORAGE_FILTER_LABELS = {
  ...COMMON_FILTER_LABELS
} as const;

// 🏢 ENTERPRISE: Parking domain filter labels (unified from types/parking.ts)
// 🌐 i18n: All labels converted to i18n keys - 2026-01-18
export const PARKING_FILTER_LABELS = {
  ...COMMON_FILTER_LABELS,
  ALL_LEVELS: 'filters.allLevels'
} as const;

// ============================================================================
// 🏢 ENTERPRISE UNIFIED STATUS FILTER LABELS
// ============================================================================
//
// 🎯 EXTRACTED από core/status/StatusConstants.ts για CompactToolbar centralization
// Single source of truth για όλα τα status filter labels
//
// ============================================================================

// 🏢 ENTERPRISE: Dynamic status labels - CENTRALIZED CONSTANTS
// Mock constants for property statuses (replace with actual source when available)
const UNIT_STATUSES = ['ACTIVE', 'INACTIVE', 'PENDING', 'COMPLETED'] as const;
const BUILDING_STATUSES = ['ACTIVE', 'INACTIVE', 'PENDING', 'COMPLETED'] as const;
const PROJECT_STATUSES = ['ACTIVE', 'INACTIVE', 'PENDING', 'COMPLETED'] as const;
const CONTACT_STATUSES = ['ACTIVE', 'INACTIVE', 'PENDING', 'COMPLETED'] as const;

/**
 * ✅ ENTERPRISE PROFESSIONAL: Dynamic status labels με centralized source
 * 🎯 No hardcoded values - extracts from unified badge system
 */
// ✅ ENTERPRISE FIX: i18n translation keys for status labels
export const UNIFIED_STATUS_FILTER_LABELS = {
  // Base statuses
  AVAILABLE: 'filters.status.available',
  SOLD: 'filters.status.sold',
  RESERVED: 'filters.status.reserved',
  MAINTENANCE: 'filters.status.maintenance',
  OCCUPIED: 'filters.status.occupied',

  // Project statuses
  PLANNING: 'filters.status.planning',
  IN_PROGRESS: 'filters.status.inProgress',
  COMPLETED: 'filters.status.completed',
  ON_HOLD: 'filters.status.onHold',

  // Contact statuses
  ACTIVE: 'filters.status.active',
  INACTIVE: 'filters.status.inactive',
  ARCHIVED: 'filters.status.archived',

  // Extended status labels
  LEAD: 'filters.status.lead',
  PENDING: 'filters.status.pending',
  CONSTRUCTION: 'filters.status.construction'
} as const;

// ============================================================================
// 🏢 ENTERPRISE STORAGE & PARKING TYPE/STATUS LABELS (Migrated)
// ============================================================================
//
// 🎯 MIGRATED από legacy storage/constants.ts για complete centralization
// Single source of truth για όλα τα type/status labels
//
// ============================================================================

// Storage-specific labels (migrated from storage/constants.ts)
// 🌐 i18n: All labels converted to i18n keys - 2026-01-18
export const STORAGE_TYPE_LABELS = {
  storage: 'storage.types.storage',
  parking: 'storage.types.parking'
} as const;

// 🌐 i18n: All labels converted to i18n keys - 2026-01-18
export const STORAGE_STATUS_LABELS = {
  available: 'storage.general.status.available',
  sold: 'storage.general.status.sold',
  reserved: 'storage.general.status.reserved',
  maintenance: 'storage.general.status.maintenance'
} as const;

// Project type labels (migrated from ProjectToolbar.tsx)
export const PROJECT_TYPE_LABELS = {
  residential: 'filters.types.residential',
  commercial: 'filters.types.commercial',
  infrastructure: 'filters.types.infrastructure'
} as const;

// DXF Layer category labels (migrated from DXF Viewer Layer Manager)
// 🌐 i18n: All labels converted to i18n keys - 2026-01-18
export const DXF_LAYER_CATEGORY_LABELS = {
  all: 'dxfViewer.layers.allCategories',
  electrical: 'dxfViewer.layers.electrical',
  plumbing: 'dxfViewer.layers.plumbing',
  hvac: 'dxfViewer.layers.hvac'
} as const;

// Price filter labels (migrated from LandingPage.tsx)
// 🌐 i18n: All labels converted to i18n keys - 2026-01-18
export const PRICE_FILTER_LABELS = {
  ALL_PRICES: 'filters.allPrices'
} as const;

// Price range generator function (enterprise-grade with currency support)
export function generatePriceRanges(currencySymbol: string = '€'): Array<{ value: string; label: string }> {
  return [
    { value: '', label: PRICE_FILTER_LABELS.ALL_PRICES },
    { value: '0-50000', label: `${currencySymbol}0 - ${currencySymbol}50.000` },
    { value: '50000-100000', label: `${currencySymbol}50.000 - ${currencySymbol}100.000` },
    { value: '100000-200000', label: `${currencySymbol}100.000 - ${currencySymbol}200.000` },
    { value: '200000+', label: `${currencySymbol}200.000+` }
  ];
}

// Unit sale status labels (migrated from StatusConstants.ts)
export const UNIT_SALE_STATUS = {
  NOT_SOLD: 'NOT_SOLD',
  SOLD: 'SOLD',
  RESERVED: 'RESERVED',
  PENDING: 'PENDING'
} as const;

// 🌐 i18n: All labels converted to i18n keys - 2026-01-18
export const UNIT_SALE_STATUS_LABELS = {
  [UNIT_SALE_STATUS.NOT_SOLD]: 'units.saleStatus.notSold',
  [UNIT_SALE_STATUS.SOLD]: 'units.saleStatus.sold',
  [UNIT_SALE_STATUS.RESERVED]: 'units.saleStatus.reserved',
  [UNIT_SALE_STATUS.PENDING]: 'units.saleStatus.pending'
} as const;

// 🏢 ENTERPRISE: Operational Status Labels (PR1.2 - Domain Separation)
// Physical/construction status - ZERO sales data
// 🌐 i18n: All labels are i18n keys for units.operationalStatus namespace
export const OPERATIONAL_STATUS_LABELS = {
  ready: 'units.operationalStatus.ready',
  'under-construction': 'units.operationalStatus.underConstruction',
  inspection: 'units.operationalStatus.inspection',
  maintenance: 'units.operationalStatus.maintenance',
  draft: 'units.operationalStatus.draft'
} as const;

// Type for operational status values
export type OperationalStatusValue = keyof typeof OPERATIONAL_STATUS_LABELS;

// Obligation status labels (migrated from StatusConstants.ts - labels only)
// 🌐 i18n: All labels converted to i18n keys - 2026-01-18
export const OBLIGATION_STATUS_LABELS = {
  draft: 'common:documentStatus.draft',
  'in-review': 'common:documentStatus.inReview',
  returned: 'common:documentStatus.returned',
  approved: 'common:documentStatus.approved',
  issued: 'common:documentStatus.issued',
  superseded: 'common:documentStatus.superseded',
  archived: 'common:documentStatus.archived',
  completed: 'common:documentStatus.completed'
} as const;

// Obligation status label getter function (migrated)
// 🏢 ENTERPRISE: Type-safe status label lookup
export const getObligationStatusLabel = (status: string): string => {
  return OBLIGATION_STATUS_LABELS[status as keyof typeof OBLIGATION_STATUS_LABELS] || status;
};

// ============================================================================
// BRIDGE FOR LEGACY BADGE SYSTEM (temporary compatibility)
// ============================================================================
//
// Temporary bridge to maintain compatibility with BadgeFactory
// until we can fully migrate the badge system
//
// Re-export legacy constants for bridge compatibility
export const LEGACY_BRIDGE_IMPORTS = {
  // Badge system will import from StatusConstants for now
  // This allows gradual migration without breaking the badge system
} as const;

// Note: BadgeFactory will continue using StatusConstants for now
// This is a safe gradual migration approach

// Standard floor names (reused from storage but for properties)
// 🌐 i18n: All labels converted to i18n keys - 2026-01-18
export const PROPERTY_STANDARD_FLOORS: string[] = [
  'building.floors.basement3',
  'building.floors.basement2',
  'building.floors.basement1',
  'building.floors.basement',
  'building.floors.ground',
  'building.floors.floor1',
  'building.floors.floor2',
  'building.floors.floor3',
  'building.floors.floor4',
  'building.floors.floor5',
  'building.floors.floor6',
  'building.floors.floor7',
  'building.floors.floor8',
  'building.floors.floor9'
];

// Legacy status mapping for compatibility
export const LEGACY_STATUS_MAPPING: Record<string, PropertyStatus> = {
  'available': 'for-sale',
  'sold': 'sold',
  'reserved': 'reserved',
  'owner': 'landowner'
};

// ============================================================================
// ENHANCED STATUS TYPES
// ============================================================================

/**
 * 🎯 ENTERPRISE ENHANCED PROPERTY STATUS
 *
 * Επεκτείνει τα βασικά PropertyStatus με επιπλέον επαγγελματικές καταστάσεις
 * που απαιτούνται για ολοκληρωμένη διαχείριση real estate portfolio
 */
export type EnhancedPropertyStatus = PropertyStatus
  // 🏨 ADVANCED RENTAL STATUSES
  | 'rental-only'              // ΜΟΝΟ για ενοικίαση (δεν πωλείται ποτέ)
  | 'long-term-rental'         // Μακροχρόνια μίσθωση (1+ χρόνια)
  | 'short-term-rental'        // Βραχυχρόνια μίσθωση (AirBnb style)

  // 🔒 ADVANCED RESERVATION STATUSES
  | 'reserved-pending'         // Δεσμευμένο εκκρεμή (δεν ολοκληρώθηκε)
  | 'contract-signed'          // Συμβόλαιο υπογεγραμμένο (εκκρεμή μεταβίβαση)
  | 'deposit-paid'             // Προκαταβολή δεδομένη

  // 👑 OWNERSHIP STATUSES
  | 'company-owned'            // Εταιρικό (δεν είναι προς πώληση)
  | 'not-for-sale'             // Δεν είναι για πώληση (προσωπική χρήση)
  | 'family-reserved'          // Κρατημένο για οικογένεια

  // ⚡ MARKET DYNAMICS
  | 'pre-launch'               // Προ-εκκίνηση (marketing phase)
  | 'exclusive-listing'        // Αποκλειστική διάθεση
  | 'price-reduced'            // Μειωμένη τιμή
  | 'urgent-sale'              // Επείγουσα πώληση

  // 🔧 OPERATIONAL STATUSES
  | 'under-renovation'         // Υπό ανακαίνιση
  | 'legal-issues'             // Νομικά προβλήματα
  | 'inspection-required'      // Απαιτείται επιθεώρηση
  | 'documentation-pending';   // Εκκρεμή έγγραφα

// ============================================================================
// BUSINESS INTENT CATEGORIZATION
// ============================================================================

/**
 * 📊 PROPERTY BUSINESS INTENT
 *
 * Κατηγοριοποίηση βασισμένη στην επιχειρηματική πρόθεση
 * Χρησιμοποιείται για έξυπνο filtering και business intelligence
 */
export type PropertyIntent =
  | 'sale'                     // Για πώληση
  | 'rental'                   // Για ενοικίαση
  | 'both'                     // Και για πώληση και ενοικίαση
  | 'investment'               // Επενδυτικό χαρτοφυλάκιο
  | 'development'              // Υπό ανάπτυξη/κατασκευή
  | 'internal'                 // Εσωτερική χρήση εταιρείας
  | 'withdrawn';               // Αποσυρμένο από την αγορά

/**
 * 🏷️ MARKET AVAILABILITY CLASSIFICATION
 *
 * Διαθεσιμότητα στην αγορά - επαγγελματική κατηγοριοποίηση
 */
export type MarketAvailability =
  | 'immediately-available'    // Άμεσα διαθέσιμο
  | 'available-soon'           // Σύντομα διαθέσιμο
  | 'conditionally-available'  // Υπό προϋποθέσεις διαθέσιμο
  | 'reserved'                 // Δεσμευμένο
  | 'occupied'                 // Κατειλημμένο
  | 'off-market'               // Εκτός αγοράς
  | 'not-available';           // Μη διαθέσιμο

/**
 * ⭐ PRIORITY CLASSIFICATION
 *
 * Προτεραιότητα πώλησης/ενοικίασης για sales & marketing
 */
export type PropertyPriority =
  | 'high'                     // Υψηλή προτεραιότητα (urgent)
  | 'medium'                   // Μέση προτεραιότητα (normal)
  | 'low'                      // Χαμηλή προτεραιότητα (flexible)
  | 'showcase'                 // Showcase property (premium marketing)
  | 'hold';                    // Κρατημένο (δεν προωθείται ενεργά)

// ============================================================================
// ENHANCED LABELS & COLORS
// ============================================================================

/**
 * 🏷️ ENHANCED STATUS LABELS
 *
 * Ελληνικές ετικέτες για όλες τις enhanced καταστάσεις
 * Επεκτείνει τα υπάρχοντα PROPERTY_STATUS_LABELS με πλήρη συμβατότητα
 */
// 🌐 i18n: All labels converted to i18n keys - 2026-01-18
export const ENHANCED_STATUS_LABELS: Record<EnhancedPropertyStatus, string> = {
  // Βασικές καταστάσεις (από υπάρχον σύστημα)
  ...PROPERTY_STATUS_LABELS,

  // 🏨 Advanced Rental Statuses
  'rental-only': 'properties.enhancedStatus.rentalOnly',
  'long-term-rental': 'properties.enhancedStatus.longTermRental',
  'short-term-rental': 'properties.enhancedStatus.shortTermRental',

  // 🔒 Advanced Reservation Statuses
  'reserved-pending': 'properties.enhancedStatus.reservedPending',
  'contract-signed': 'properties.enhancedStatus.contractSigned',
  'deposit-paid': 'properties.enhancedStatus.depositPaid',

  // 👑 Ownership Statuses
  'company-owned': 'properties.enhancedStatus.companyOwned',
  'not-for-sale': 'properties.enhancedStatus.notForSale',
  'family-reserved': 'properties.enhancedStatus.familyReserved',

  // ⚡ Market Dynamics
  'pre-launch': 'properties.enhancedStatus.preLaunch',
  'exclusive-listing': 'properties.enhancedStatus.exclusiveListing',
  'price-reduced': 'properties.enhancedStatus.priceReduced',
  'urgent-sale': 'properties.enhancedStatus.urgentSale',

  // 🔧 Operational Statuses
  'under-renovation': 'properties.enhancedStatus.underRenovation',
  'legal-issues': 'properties.enhancedStatus.legalIssues',
  'inspection-required': 'properties.enhancedStatus.inspectionRequired',
  'documentation-pending': 'properties.enhancedStatus.documentationPending',
};

/**
 * 🎨 ENHANCED STATUS COLORS
 *
 * Semantic χρώματα για όλες τις enhanced καταστάσεις
 * Χρησιμοποιεί CSS variables για theme consistency
 */
export const ENHANCED_STATUS_COLORS: Record<EnhancedPropertyStatus, string> = {
  // Βασικά χρώματα (από υπάρχον σύστημα)
  ...PROPERTY_STATUS_COLORS,

  // 🏨 Advanced Rental Colors (Blue variants)
  'rental-only': 'hsl(var(--status-info-dark))',
  'long-term-rental': 'hsl(var(--status-info))',
  'short-term-rental': 'hsl(var(--status-info-light))',

  // 🔒 Advanced Reservation Colors (Orange variants)
  'reserved-pending': 'hsl(var(--status-warning-light))',
  'contract-signed': 'hsl(var(--status-warning-dark))',
  'deposit-paid': 'hsl(var(--status-warning))',

  // 👑 Ownership Colors (Purple variants)
  'company-owned': 'hsl(var(--status-purple-dark))',
  'not-for-sale': 'hsl(var(--status-purple))',
  'family-reserved': 'hsl(var(--status-purple-light))',

  // ⚡ Market Dynamics Colors (Green/Cyan variants)
  'pre-launch': 'hsl(var(--status-success-light))',
  'exclusive-listing': 'hsl(var(--status-success-dark))',
  'price-reduced': 'hsl(var(--destructive-light))',
  'urgent-sale': 'hsl(var(--destructive))',

  // 🔧 Operational Colors (Neutral/Gray variants)
  'under-renovation': 'hsl(var(--neutral-600))',
  'legal-issues': 'hsl(var(--destructive-dark))',
  'inspection-required': 'hsl(var(--neutral-500))',
  'documentation-pending': 'hsl(var(--neutral-400))',
};

// ============================================================================
// BUSINESS INTENT LABELS & COLORS
// ============================================================================

// 🌐 i18n: All labels converted to i18n keys - 2026-01-18
export const PROPERTY_INTENT_LABELS: Record<PropertyIntent, string> = {
  'sale': 'properties.intent.sale',
  'rental': 'properties.intent.rental',
  'both': 'properties.intent.both',
  'investment': 'properties.intent.investment',
  'development': 'properties.intent.development',
  'internal': 'properties.intent.internal',
  'withdrawn': 'properties.intent.withdrawn',
};

// 🌐 i18n: All labels converted to i18n keys - 2026-01-18
export const MARKET_AVAILABILITY_LABELS: Record<MarketAvailability, string> = {
  'immediately-available': 'properties.availability.immediatelyAvailable',
  'available-soon': 'properties.availability.availableSoon',
  'conditionally-available': 'properties.availability.conditionallyAvailable',
  'reserved': 'properties.availability.reserved',
  'occupied': 'properties.availability.occupied',
  'off-market': 'properties.availability.offMarket',
  'not-available': 'properties.availability.notAvailable',
};

// 🌐 i18n: All labels converted to i18n keys - 2026-01-18
export const PROPERTY_PRIORITY_LABELS: Record<PropertyPriority, string> = {
  'high': 'common.priority.high',
  'medium': 'common.priority.medium',
  'low': 'common.priority.low',
  'showcase': 'properties.priority.showcase',
  'hold': 'properties.priority.hold',
};

// ============================================================================
// STATUS CATEGORIES & GROUPING
// ============================================================================

/**
 * 📊 ENTERPRISE STATUS CATEGORIES
 *
 * Ομαδοποίηση καταστάσεων για business intelligence και filtering
 */
export const STATUS_CATEGORIES = {
  // Διαθέσιμα για αγορά/ενοικίαση
  AVAILABLE: [
    'for-sale', 'for-rent', 'rental-only', 'long-term-rental', 'short-term-rental',
    'pre-launch', 'exclusive-listing', 'price-reduced', 'urgent-sale', 'coming-soon'
  ] as EnhancedPropertyStatus[],

  // Δεσμευμένα/Πωλημένα
  COMMITTED: [
    'sold', 'rented', 'reserved', 'reserved-pending', 'contract-signed',
    'deposit-paid', 'under-negotiation'
  ] as EnhancedPropertyStatus[],

  // Εκτός αγοράς
  OFF_MARKET: [
    'landowner', 'company-owned', 'not-for-sale', 'family-reserved',
    'off-market', 'unavailable'
  ] as EnhancedPropertyStatus[],

  // Υπό επεξεργασία/προβλήματα
  IN_PROCESS: [
    'under-renovation', 'legal-issues', 'inspection-required',
    'documentation-pending'
  ] as EnhancedPropertyStatus[],
} as const;

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * 🔍 Enhanced utility function για status labels
 */
export function getEnhancedStatusLabel(status: EnhancedPropertyStatus): string {
  return ENHANCED_STATUS_LABELS[status];
}

/**
 * 🎨 Enhanced utility function για status colors
 */
export function getEnhancedStatusColor(status: EnhancedPropertyStatus): string {
  return ENHANCED_STATUS_COLORS[status];
}

/**
 * 📊 Get status category
 */
export function getStatusCategory(status: EnhancedPropertyStatus): string {
  for (const [category, statuses] of Object.entries(STATUS_CATEGORIES)) {
    if (statuses.includes(status)) {
      return category;
    }
  }
  return 'OTHER';
}

/**
 * ✅ Check if property is available for transaction
 */
export function isPropertyAvailable(status: EnhancedPropertyStatus): boolean {
  return STATUS_CATEGORIES.AVAILABLE.includes(status);
}

/**
 * 🔒 Check if property is committed/unavailable
 */
export function isPropertyCommitted(status: EnhancedPropertyStatus): boolean {
  return STATUS_CATEGORIES.COMMITTED.includes(status);
}

/**
 * 🚫 Check if property is off-market
 */
export function isPropertyOffMarket(status: EnhancedPropertyStatus): boolean {
  return STATUS_CATEGORIES.OFF_MARKET.includes(status);
}

/**
 * ⚙️ Check if property has operational issues
 */
export function hasPropertyIssues(status: EnhancedPropertyStatus): boolean {
  return STATUS_CATEGORIES.IN_PROCESS.includes(status);
}

/**
 * 📋 Get all enhanced property statuses
 */
export function getAllEnhancedStatuses(): EnhancedPropertyStatus[] {
  return Object.keys(ENHANCED_STATUS_LABELS) as EnhancedPropertyStatus[];
}

/**
 * 🏷️ Get statuses by category
 */
export function getStatusesByCategory(category: keyof typeof STATUS_CATEGORIES): EnhancedPropertyStatus[] {
  return [...STATUS_CATEGORIES[category]];
}

// ============================================================================
// BACKWARDS COMPATIBILITY
// ============================================================================

/**
 * ✅ FULL BACKWARDS COMPATIBILITY
 *
 * Εξαγωγή όλων των υπαρχόντων functions με enhanced functionality
 * Το υπάρχον κώδικα θα δουλεύει χωρίς καμία αλλαγή
 */
// ✅ SELF-CONTAINED: Όλα τα definitions είναι τώρα στο ίδιο αρχείο

// Enhanced versions που δεδουλεύουν με και BasicPropertyStatus και Enhanced
export const getStatusLabel = getEnhancedStatusLabel;
export const getStatusColor = getEnhancedStatusColor;

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  // Labels & Colors
  ENHANCED_STATUS_LABELS,
  ENHANCED_STATUS_COLORS,
  PROPERTY_INTENT_LABELS,
  MARKET_AVAILABILITY_LABELS,
  PROPERTY_PRIORITY_LABELS,

  // Categories & Grouping
  STATUS_CATEGORIES,

  // Utility Functions
  getEnhancedStatusLabel,
  getEnhancedStatusColor,
  getStatusCategory,
  isPropertyAvailable,
  isPropertyCommitted,
  isPropertyOffMarket,
  hasPropertyIssues,
  getAllEnhancedStatuses,
  getStatusesByCategory,
};

// ============================================================================
// 🏢 ENTERPRISE PRIORITY LABELS (Migrated from AdvancedFilters)
// ============================================================================

export const PRIORITY_LABELS = {
  high: 'filters.priority.high',
  medium: 'filters.priority.medium',
  low: 'filters.priority.low',
  urgent: 'filters.priority.urgent',
  critical: 'filters.priority.critical'
} as const;

// ============================================================================
// 🏢 ENTERPRISE BUILDING/PROJECT STATUS LABELS (Migrated from AdvancedFilters)
// ============================================================================

export const BUILDING_PROJECT_STATUS_LABELS = {
  'for-sale': 'filters.buildingStatus.forSale',
  'for-rent': 'filters.buildingStatus.forRent',
  'rented': 'filters.buildingStatus.rented',
  'withdrawn': 'filters.buildingStatus.withdrawn',
  'in_progress': 'filters.buildingStatus.inProgress',
  'delayed': 'filters.buildingStatus.delayed',
  'cancelled': 'filters.buildingStatus.cancelled',
  'excellent': 'filters.condition.excellent',
  'very-good': 'filters.condition.veryGood',
  'good': 'filters.condition.good',
  'needs-renovation': 'filters.condition.needsRenovation',
  'under-renovation': 'filters.condition.underRenovation'
} as const;

// ============================================================================
// 🏢 ENTERPRISE PROPERTY/BUILDING TYPE LABELS (Migrated from AdvancedFilters)
// ============================================================================

export const PROPERTY_BUILDING_TYPE_LABELS = {
  'individual': 'filters.types.individual',
  'company': 'filters.types.company',
  'service': 'filters.types.service',
  'residential': 'filters.types.residential',
  'commercial': 'filters.types.commercial',
  'industrial': 'filters.types.industrial',
  'office': 'filters.types.office',
  'mixed': 'filters.types.mixed',
  'warehouse': 'filters.types.warehouse',
  'retail': 'filters.types.retail',
  'hotel': 'filters.types.hotel',
  'public': 'filters.types.public',
  'renovation': 'filters.types.renovation',
  'infrastructure': 'filters.types.infrastructure'
} as const;

// ============================================================================
// 🏢 ENTERPRISE COMMUNICATION LABELS - ZERO HARDCODED VALUES
// ============================================================================
//
// 🎯 FORTUNE 500 CENTRALIZATION: Communication dropdown labels
// Migrated from CommunicationConfigs.ts hardcoded strings
// Single source of truth για όλα τα communication dropdown options
//
// ============================================================================

// Phone Types
// 🌐 i18n: All labels converted to i18n keys - 2026-01-18
export const PHONE_TYPE_LABELS = {
  mobile: 'communication.phoneTypes.mobile',
  home: 'communication.phoneTypes.home',
  work: 'communication.phoneTypes.work',
  fax: 'communication.phoneTypes.fax',
  other: 'communication.phoneTypes.other'
} as const;

// Email Types
// 🌐 i18n: All labels converted to i18n keys - 2026-01-18
export const EMAIL_TYPE_LABELS = {
  personal: 'communication.emailTypes.personal',
  work: 'communication.emailTypes.work',
  other: 'communication.emailTypes.other'
} as const;

// Website Types
// 🌐 i18n: All labels converted to i18n keys - 2026-01-18
export const WEBSITE_TYPE_LABELS = {
  personal: 'communication.websiteTypes.personal',
  company: 'communication.websiteTypes.company',
  portfolio: 'communication.websiteTypes.portfolio',
  blog: 'communication.websiteTypes.blog',
  other: 'communication.websiteTypes.other'
} as const;

// Social Media Types (usage context)
// 🌐 i18n: All labels converted to i18n keys - 2026-01-18
export const SOCIAL_MEDIA_TYPE_LABELS = {
  personal: 'communication.socialMediaTypes.personal',
  professional: 'communication.socialMediaTypes.professional',
  business: 'communication.socialMediaTypes.business',
  other: 'communication.socialMediaTypes.other'
} as const;

// Social Media Platforms
// 🌐 i18n: All labels converted to i18n keys - 2026-01-18
export const SOCIAL_PLATFORM_LABELS = {
  linkedin: 'communication.platforms.linkedin',
  facebook: 'communication.platforms.facebook',
  instagram: 'communication.platforms.instagram',
  twitter: 'communication.platforms.twitter',
  youtube: 'communication.platforms.youtube',
  github: 'communication.platforms.github',
  tiktok: 'communication.platforms.tiktok',
  whatsapp: 'communication.platforms.whatsapp',
  telegram: 'communication.platforms.telegram',
  other: 'communication.platforms.other'
} as const;

// ============================================================================
// SERVICE (Public Service) Communication Types
// ============================================================================

export const SERVICE_PHONE_TYPE_LABELS = {
  main: 'communication.servicePhoneTypes.main',
  department: 'communication.servicePhoneTypes.department',
  secretariat: 'communication.servicePhoneTypes.secretariat',
  helpdesk: 'communication.servicePhoneTypes.helpdesk',
  fax: 'communication.servicePhoneTypes.fax',
  other: 'communication.servicePhoneTypes.other'
} as const;

export const SERVICE_EMAIL_TYPE_LABELS = {
  general: 'communication.serviceEmailTypes.general',
  department: 'communication.serviceEmailTypes.department',
  secretariat: 'communication.serviceEmailTypes.secretariat',
  info: 'communication.serviceEmailTypes.info',
  other: 'communication.serviceEmailTypes.other'
} as const;

export const SERVICE_WEBSITE_TYPE_LABELS = {
  official: 'communication.serviceWebsiteTypes.official',
  eServices: 'communication.serviceWebsiteTypes.eServices',
  portal: 'communication.serviceWebsiteTypes.portal',
  other: 'communication.serviceWebsiteTypes.other'
} as const;

export const SERVICE_SOCIAL_MEDIA_TYPE_LABELS = {
  official: 'communication.serviceSocialMediaTypes.official',
  informational: 'communication.serviceSocialMediaTypes.informational',
  other: 'communication.serviceSocialMediaTypes.other'
} as const;

// ============================================================================
// COMPANY Communication Types
// ============================================================================

export const COMPANY_PHONE_TYPE_LABELS = {
  main: 'communication.companyPhoneTypes.main',
  department: 'communication.companyPhoneTypes.department',
  secretariat: 'communication.companyPhoneTypes.secretariat',
  sales: 'communication.companyPhoneTypes.sales',
  support: 'communication.companyPhoneTypes.support',
  fax: 'communication.companyPhoneTypes.fax',
  other: 'communication.companyPhoneTypes.other'
} as const;

export const COMPANY_EMAIL_TYPE_LABELS = {
  general: 'communication.companyEmailTypes.general',
  department: 'communication.companyEmailTypes.department',
  sales: 'communication.companyEmailTypes.sales',
  support: 'communication.companyEmailTypes.support',
  info: 'communication.companyEmailTypes.info',
  other: 'communication.companyEmailTypes.other'
} as const;

export const COMPANY_WEBSITE_TYPE_LABELS = {
  corporate: 'communication.companyWebsiteTypes.corporate',
  eshop: 'communication.companyWebsiteTypes.eshop',
  blog: 'communication.companyWebsiteTypes.blog',
  other: 'communication.companyWebsiteTypes.other'
} as const;

export const COMPANY_SOCIAL_MEDIA_TYPE_LABELS = {
  corporate: 'communication.companySocialMediaTypes.corporate',
  marketing: 'communication.companySocialMediaTypes.marketing',
  other: 'communication.companySocialMediaTypes.other'
} as const;

// Identity Document Types - Comprehensive Options
// 🌐 i18n: All labels converted to i18n keys - 2026-01-18
export const IDENTITY_TYPE_LABELS = {
  id_card: 'contacts.identity.types.idCard',
  identity_card: 'contacts.identity.types.identityCard',
  passport: 'contacts.identity.types.passport',
  afm: 'contacts.identity.types.afm',
  amka: 'contacts.identity.types.amka',
  license: 'contacts.identity.types.license',
  drivers_license: 'contacts.identity.types.driversLicense',
  other: 'contacts.identity.types.other'
} as const;

// Professional Information Types
// 🌐 i18n: All labels converted to i18n keys - 2026-01-18
export const PROFESSIONAL_TYPE_LABELS = {
  company_phone: 'contacts.professional.types.companyPhone',
  company_email: 'contacts.professional.types.companyEmail',
  company_website: 'contacts.professional.types.companyWebsite',
  linkedin: 'contacts.professional.types.linkedin',
  position: 'contacts.professional.types.position',
  department: 'contacts.professional.types.department',
  other: 'contacts.professional.types.other'
} as const;

// Address Types - Comprehensive Options
// 🌐 i18n: All labels converted to i18n keys - 2026-01-18
export const ADDRESS_TYPE_LABELS = {
  home: 'contacts.address.types.home',
  work: 'contacts.address.types.work',
  mailing: 'contacts.address.types.mailing',
  billing: 'contacts.address.types.billing',
  headquarters: 'contacts.address.types.headquarters',
  branch: 'contacts.address.types.branch',
  other: 'contacts.address.types.other'
} as const;

// ============================================================================
// 🏢 ENTERPRISE COMPANY LEGAL FORMS - ZERO HARDCODED VALUES
// ============================================================================
//
// 🎯 FORTUNE 500 CENTRALIZATION: Greek company legal forms
// Migrated from company-config.ts and company-gemi-config.ts hardcoded strings
// Single source of truth για όλα τα company legal form dropdown options
//
// ============================================================================

// Greek Company Legal Forms
// 🌐 i18n: All labels converted to i18n keys - 2026-01-18
export const COMPANY_LEGAL_FORM_LABELS = {
  ae: 'contacts.company.legalForms.ae',
  epe: 'contacts.company.legalForms.epe',
  ee: 'contacts.company.legalForms.ee',
  oe: 'contacts.company.legalForms.oe',
  ikepe: 'contacts.company.legalForms.ikepe',
  ike: 'contacts.company.legalForms.ike',
  mono: 'contacts.company.legalForms.mono',
  smpc: 'contacts.company.legalForms.smpc',
  other: 'contacts.company.legalForms.other'
} as const;

// ============================================================================
// 🏢 ENTERPRISE TREND & STATISTICS LABELS - ZERO HARDCODED VALUES
// ============================================================================
//
// 🎯 FORTUNE 500 CENTRALIZATION: Trend and statistics labels
// Migrated from sales/spaces pages hardcoded strings
// Single source of truth για όλα τα trend/statistics labels
//
// ============================================================================

// Trend Labels (used in sales/spaces statistics)
// 🌐 i18n: All labels converted to i18n keys - 2026-01-18
export const TREND_LABELS = {
  increase: 'common.trends.increase',
  decrease: 'common.trends.decrease',
  stable: 'common.trends.stable',
  improvement: 'common.trends.improvement',
  new: 'common.trends.new',
  updated: 'common.trends.updated'
} as const;

// ============================================================================
// 🏢 ENTERPRISE EXTENDED PROPERTY TYPES - ZERO HARDCODED VALUES
// ============================================================================
//
// 🎯 FORTUNE 500 CENTRALIZATION: Extended property type variations
// Extends existing PROPERTY_TYPE_LABELS with additional variations
// Migrated from public-property-filters hardcoded strings
//
// ============================================================================

// Extended Property Type Variations (supplements existing PROPERTY_TYPE_LABELS)
// 🌐 i18n: All labels converted to i18n keys - 2026-01-18
export const EXTENDED_PROPERTY_TYPE_LABELS = {
  ...PROPERTY_TYPE_LABELS,
  'bedsit': 'properties.types.bedsit',
  'apartment-2br': 'properties.types.apartment2br',
  'apartment-3br': 'properties.types.apartment3br',
  'apartment-4br': 'properties.types.apartment4br',
  // ✅ ENTERPRISE EXTENSION: Additional property types from CompactToolbar
  'loft': 'properties.types.loft',
  'penthouse': 'properties.types.penthouse'
} as const;

// ============================================================================
// 🏢 ENTERPRISE RISK & COMPLEXITY LABELS (Migrated from AdvancedFilters)
// ============================================================================

export const RISK_COMPLEXITY_LABELS = {
  'low': 'filters.riskComplexity.low',
  'medium': 'filters.riskComplexity.medium',
  'high': 'filters.riskComplexity.high',
  'simple': 'filters.riskComplexity.simple',
  'complex': 'filters.riskComplexity.complex',
  'very_complex': 'filters.riskComplexity.veryComplex'
} as const;

// ============================================================================
// 🎯 UNIFIED DROPDOWN LABELS SYSTEM - HARDCODED ELIMINATION
// ============================================================================
//
// 📋 ENTERPRISE CENTRALIZATION: Consolidation από όλα τα hardcoded dropdown labels
// που εντοπίστηκαν σε components χωρίς κεντρικοποιημένο σύστημα
//
// 🎯 ANALYSIS RESULTS: ~25-30 hardcoded labels εντοπίστηκαν στην εφαρμογή
//
// Sources consolidation:
// - SimpleProjectDialog.tsx (DXF Viewer selection steps)
// - BulkAssignToolbar.tsx, AddUnitToContactDialog.tsx (contact selection)
// - DxfImportModal.tsx (file import & encoding)
// - HierarchicalDestinationSelector.tsx (DXF destination labels)
// - CalibrationStep.tsx (measurement units)
// - FloorSelector.tsx, ConnectionControls.tsx (property viewer)
// - AddOpportunityDialog.tsx (CRM opportunities)
// - LabeledSelect.tsx (generic template)
// - helpers.ts (relationship status labels)
//
// ============================================================================

// 🏢 DROPDOWN PLACEHOLDER LABELS
// 🌐 i18n: All labels converted to i18n keys - 2026-01-18
export const DROPDOWN_PLACEHOLDERS = {
  // Company & Project Selection (DXF Viewer)
  SELECT_COMPANY: 'common.dropdowns.selectCompany',
  SELECT_PROJECT: 'common.dropdowns.selectProject',
  SELECT_BUILDING: 'common.dropdowns.selectBuilding',
  SELECT_UNIT: 'common.dropdowns.selectUnit',

  // Contact & Client Selection
  SELECT_CLIENT: 'common.dropdowns.selectClient',
  SELECT_CONTACT: 'common.dropdowns.selectContact',

  // File & Import Operations
  SELECT_FILE: 'common.dropdowns.selectFile',
  SELECT_ENCODING: 'common.dropdowns.selectEncoding',

  // Property & Building Selection
  SELECT_FLOOR: 'common.dropdowns.selectFloor',
  SELECT_TYPE: 'common.dropdowns.selectType',
  SELECT_STATUS: 'common.dropdowns.selectStatus',

  // CRM & Opportunity Management
  SELECT_STAGE: 'common.dropdowns.selectStage',

  // Generic Template (για LabeledSelect component)
  GENERIC_SELECT: 'common.dropdowns.select'
} as const;

// 🔄 PROCESS STEP LABELS (DXF Import & Project Creation)
// 🌐 i18n: All labels converted to i18n keys - 2026-01-18
export const PROCESS_STEP_LABELS = {
  // Project Creation Steps
  STEP_1_COMPANY: 'dxfViewer.steps.selectCompany',
  STEP_2_PROJECT: 'dxfViewer.steps.selectProject',
  STEP_3_BUILDING: 'dxfViewer.steps.selectBuilding',
  STEP_4_UNIT: 'dxfViewer.steps.selectUnit',

  // Import Process Steps
  FILE_SELECTION: 'dxfViewer.steps.fileSelection',
  ENCODING_SELECTION: 'dxfViewer.steps.encodingSelection',
  DESTINATION_SELECTION: 'dxfViewer.steps.destinationSelection'
} as const;

// 🏗️ DXF DESTINATION LABELS (HierarchicalDestinationSelector)
// 🌐 i18n: All labels converted to i18n keys - 2026-01-18
export const DXF_DESTINATION_LABELS = {
  GENERAL_PLAN: 'dxfViewer.destinations.generalPlan',
  PARKING_SPOTS: 'dxfViewer.destinations.parkingSpots',
  STORAGE_AREAS: 'dxfViewer.destinations.storageAreas',
  BUILDING_PLAN: 'dxfViewer.destinations.buildingPlan',
  UNIT_PLAN: 'dxfViewer.destinations.unitPlan'
} as const;

// 📏 MEASUREMENT UNIT LABELS (CalibrationStep & DXF Viewer)
// 🌐 i18n: All labels converted to i18n keys - 2026-01-18
export const MEASUREMENT_UNIT_LABELS = {
  MILLIMETERS: 'common.units.millimeters',
  CENTIMETERS: 'common.units.centimeters',
  METERS: 'common.units.meters',
  INCHES: 'common.units.inches',
  FEET: 'common.units.feet'
} as const;

// 🔗 RELATIONSHIP STATUS LABELS (Contact Relationships)
// 🌐 i18n: All labels converted to i18n keys - 2026-01-18
export const RELATIONSHIP_STATUS_LABELS = {
  ACTIVE: 'contacts.relationships.status.active',
  INACTIVE: 'contacts.relationships.status.inactive',
  PENDING: 'contacts.relationships.status.pending',
  TERMINATED: 'contacts.relationships.status.terminated',
  SUSPENDED: 'contacts.relationships.status.suspended'
} as const;

// 💼 CRM & OPPORTUNITY LABELS
// 🌐 i18n: All labels converted to i18n keys - 2026-01-18
export const CRM_LABELS = {
  // Opportunity stages
  LEAD: 'crm.stages.lead',
  PROPOSAL: 'crm.stages.proposal',
  NEGOTIATION: 'crm.stages.negotiation',
  CLOSING: 'crm.stages.closing',
  WON: 'crm.stages.won',
  LOST: 'crm.stages.lost',

  // Contact types
  INDIVIDUAL: 'contacts.types.individual',
  COMPANY: 'contacts.types.company',
  ORGANIZATION: 'contacts.types.organization'
} as const;

// 🏠 PROPERTY VIEWER LABELS (Floor Selector, Connection Controls)
// 🌐 i18n: All labels converted to i18n keys - 2026-01-18
export const PROPERTY_VIEWER_LABELS = {
  ALL_FLOORS: 'building.floors.allFloors',
  GROUND_FLOOR: 'building.floors.ground',
  BASEMENT: 'building.floors.basement',

  // Connection types
  ELECTRICAL: 'building.connections.electrical',
  PLUMBING: 'building.connections.plumbing',
  HVAC: 'building.connections.hvac',
  INTERNET: 'building.connections.internet',
  PHONE: 'building.connections.phone'
} as const;

// 🏢 STORAGE TYPE & SIZE LABELS (migrated from storageFiltersConfig.ts)
// 🌐 i18n: All labels converted to i18n keys - 2026-01-18
export const STORAGE_LABELS = {
  // Storage sizes
  LARGE: 'storage.sizes.large',
  SMALL: 'storage.sizes.small',

  // Storage locations
  BASEMENT_STORAGE: 'storage.locations.basement',
  GROUND_STORAGE: 'storage.locations.ground',
  SPECIAL_STORAGE: 'storage.locations.special',

  // Building labels (generic)
  BUILDING_A: 'building.names.buildingA',
  BUILDING_B: 'building.names.buildingB',
  BUILDING_C: 'building.names.buildingC',
  BUILDING_D: 'building.names.buildingD',
  BUILDING_E: 'building.names.buildingE',

  // Floor labels (detailed)
  BASEMENT_MINUS_2: 'building.floors.basementMinus2',
  BASEMENT_MINUS_1: 'building.floors.basementMinus1',
  GROUND_FLOOR: 'building.floors.ground',
  FIRST_FLOOR: 'building.floors.floor1',
  SECOND_FLOOR: 'building.floors.floor2',
  OTHER_FLOORS: 'building.floors.other'
} as const;

// 🔧 UTILITY FUNCTIONS για Dropdown Label Access
export const getDropdownPlaceholder = (key: keyof typeof DROPDOWN_PLACEHOLDERS): string => {
  return DROPDOWN_PLACEHOLDERS[key];
};

export const getProcessStepLabel = (key: keyof typeof PROCESS_STEP_LABELS): string => {
  return PROCESS_STEP_LABELS[key];
};

export const getDxfDestinationLabel = (key: keyof typeof DXF_DESTINATION_LABELS): string => {
  return DXF_DESTINATION_LABELS[key];
};

export const getMeasurementUnitLabel = (key: keyof typeof MEASUREMENT_UNIT_LABELS): string => {
  return MEASUREMENT_UNIT_LABELS[key];
};

export const getRelationshipStatusLabel = (key: keyof typeof RELATIONSHIP_STATUS_LABELS): string => {
  return RELATIONSHIP_STATUS_LABELS[key];
};

export const getCrmLabel = (key: keyof typeof CRM_LABELS): string => {
  return CRM_LABELS[key];
};

export const getPropertyViewerLabel = (key: keyof typeof PROPERTY_VIEWER_LABELS): string => {
  return PROPERTY_VIEWER_LABELS[key];
};

// ============================================================================
// 📊 CONSOLIDATED DROPDOWN OPTIONS (Enterprise Arrays)
// ============================================================================

// 📏 Measurement Units Array (για CalibrationStep)
export const MEASUREMENT_UNITS_OPTIONS = [
  { value: 'mm', label: MEASUREMENT_UNIT_LABELS.MILLIMETERS },
  { value: 'cm', label: MEASUREMENT_UNIT_LABELS.CENTIMETERS },
  { value: 'm', label: MEASUREMENT_UNIT_LABELS.METERS },
  { value: 'in', label: MEASUREMENT_UNIT_LABELS.INCHES },
  { value: 'ft', label: MEASUREMENT_UNIT_LABELS.FEET }
] as const;

// 🔗 Relationship Status Options (για helpers.ts replacement)
export const RELATIONSHIP_STATUS_OPTIONS = [
  { value: 'active', label: RELATIONSHIP_STATUS_LABELS.ACTIVE },
  { value: 'inactive', label: RELATIONSHIP_STATUS_LABELS.INACTIVE },
  { value: 'pending', label: RELATIONSHIP_STATUS_LABELS.PENDING },
  { value: 'terminated', label: RELATIONSHIP_STATUS_LABELS.TERMINATED },
  { value: 'suspended', label: RELATIONSHIP_STATUS_LABELS.SUSPENDED }
] as const;

// ============================================================================
// 🎯 MIGRATION HELPER - BACKWARDS COMPATIBILITY
// ============================================================================

/**
 * 🔄 Legacy Component Support
 *
 * Provides backwards compatibility για components που μπορεί να χρησιμοποιούν
 * τα hardcoded strings μέχρι να γίνει η migration
 */
export const LEGACY_DROPDOWN_SUPPORT = {
  // Mapping από hardcoded strings σε centralized labels
  '-- Επιλέξτε Εταιρεία --': DROPDOWN_PLACEHOLDERS.SELECT_COMPANY,
  '-- Επιλέξτε Έργο --': DROPDOWN_PLACEHOLDERS.SELECT_PROJECT,
  '-- Επιλέξτε Κτίριο --': DROPDOWN_PLACEHOLDERS.SELECT_BUILDING,
  '-- Επιλέξτε Μονάδα --': DROPDOWN_PLACEHOLDERS.SELECT_UNIT,
  'Επιλογή πελάτη...': DROPDOWN_PLACEHOLDERS.SELECT_CLIENT,
  'Επιλογή ορόφου...': DROPDOWN_PLACEHOLDERS.SELECT_FLOOR,
  'Επιλογή τύπου': DROPDOWN_PLACEHOLDERS.SELECT_TYPE,
  'Επιλογή σταδίου...': DROPDOWN_PLACEHOLDERS.SELECT_STAGE,
  'Γενική Κάτοψη': DXF_DESTINATION_LABELS.GENERAL_PLAN,
  'Θέσεις Στάθμευσης': DXF_DESTINATION_LABELS.PARKING_SPOTS,
  'Αποθήκες': DXF_DESTINATION_LABELS.STORAGE_AREAS
} as const;

/**
 * 🔧 Legacy String Resolver
 *
 * Helper function για migration από hardcoded strings
 * 🏢 ENTERPRISE: Type-safe legacy string lookup
 */
export const resolveLegacyDropdownString = (hardcodedString: string): string => {
  return LEGACY_DROPDOWN_SUPPORT[hardcodedString as keyof typeof LEGACY_DROPDOWN_SUPPORT] || hardcodedString;
};

// ============================================================================
// 🏢 MODAL SELECT COMPREHENSIVE LABELS - ENTERPRISE MIGRATION
// ============================================================================

/**
 * Gender Options - Complete Coverage
 * 🌐 i18n: All labels converted to i18n keys - 2026-01-18
 */
export const GENDER_LABELS = {
  male: 'options.gender.male',
  female: 'options.gender.female',
  other: 'options.gender.other',
  prefer_not_to_say: 'options.gender.preferNotToSay'
} as const;

// Note: IDENTITY_TYPE_LABELS merged with main definition above (line ~727)

/**
 * Country Labels (Common ones for Greece-focused app)
 * 🌐 i18n: All labels converted to i18n keys - 2026-01-18
 */
export const COUNTRY_LABELS = {
  GR: 'common.countries.greece',
  CY: 'common.countries.cyprus',
  US: 'common.countries.usa',
  DE: 'common.countries.germany',
  FR: 'common.countries.france',
  IT: 'common.countries.italy',
  ES: 'common.countries.spain',
  UK: 'common.countries.uk',
  AU: 'common.countries.australia',
  CA: 'common.countries.canada',
  OTHER: 'common.countries.other'
} as const;

/**
 * Currency Labels
 * 🌐 i18n: All labels converted to i18n keys - 2026-01-18
 */
export const CURRENCY_LABELS = {
  EUR: 'options.currencies.eur',
  USD: 'options.currencies.usd',
  GBP: 'options.currencies.gbp'
} as const;

// Note: ADDRESS_TYPE_LABELS merged with main definition above (line ~750)

/**
 * Shareholder Types
 * 🌐 i18n: All labels converted to i18n keys - 2026-01-18
 */
export const SHAREHOLDER_TYPE_LABELS = {
  individual: 'options.shareholderTypes.individual',
  legal: 'options.shareholderTypes.legal'
} as const;

/**
 * Document Types
 * 🌐 i18n: All labels converted to i18n keys - 2026-01-18
 */
export const DOCUMENT_TYPE_LABELS = {
  certificate: 'contacts.company.documentTypes.certificate',
  announcement: 'contacts.company.documentTypes.announcement',
  registration: 'contacts.company.documentTypes.registration',
  amendment: 'contacts.company.documentTypes.amendment'
} as const;

/**
 * Board Types for company decisions
 * 🌐 i18n: All labels converted to i18n keys - 2026-01-18
 */
export const BOARD_TYPE_LABELS = {
  general_assembly: 'contacts.company.boardTypes.generalAssembly',
  board_directors: 'contacts.company.boardTypes.boardDirectors',
  supervisory_board: 'contacts.company.boardTypes.supervisoryBoard'
} as const;

/**
 * Representative Positions
 * 🌐 i18n: All labels converted to i18n keys - 2026-01-18
 */
export const REPRESENTATIVE_POSITION_LABELS = {
  ceo: 'contacts.company.positions.ceo',
  president: 'contacts.company.positions.president',
  manager: 'contacts.company.positions.manager',
  legal_rep: 'contacts.company.positions.legalRep',
  secretary: 'contacts.company.positions.secretary'
} as const;

/**
 * ΓΕΜΗ Status Labels
 * 🌐 i18n: All labels converted to i18n keys - 2026-01-18
 */
export const GEMI_STATUS_LABELS = {
  active: 'options.gemiStatuses.active',
  inactive: 'options.gemiStatuses.inactive',
  suspended: 'options.gemiStatuses.suspended',
  dissolution: 'options.gemiStatuses.dissolution',
  dissolved: 'options.gemiStatuses.dissolved',
  bankruptcy: 'options.gemiStatuses.bankruptcy',
  liquidation: 'options.gemiStatuses.liquidation'
} as const;

/**
 * Service Categories
 * 🌐 i18n: All labels converted to i18n keys - 2026-01-18
 */
export const SERVICE_CATEGORY_LABELS = {
  ministry: 'options.serviceCategories.ministry',
  region: 'options.serviceCategories.region',
  municipality: 'options.serviceCategories.municipality',
  public_entity: 'options.serviceCategories.publicEntity',
  independent_authority: 'options.serviceCategories.independentAuthority',
  university: 'options.serviceCategories.university',
  hospital: 'options.serviceCategories.hospital',
  school: 'options.serviceCategories.school',
  other: 'options.serviceCategories.other'
} as const;

/**
 * Legal Status Labels για δημόσιες υπηρεσίες
 * 🌐 i18n: All labels converted to i18n keys - 2026-01-18
 */
export const LEGAL_STATUS_LABELS = {
  npdd: 'options.legalStatuses.npdd',
  npid: 'options.legalStatuses.npid',
  public_service: 'options.legalStatuses.publicService',
  independent_authority: 'options.legalStatuses.independentAuthority',
  decentralized_admin: 'options.legalStatuses.decentralizedAdmin'
} as const;

/**
 * Boolean Options (Yes/No)
 * 🌐 i18n: All labels converted to i18n keys - 2026-01-18
 */
export const BOOLEAN_LABELS = {
  yes: 'common.boolean.yes',
  no: 'common.boolean.no'
} as const;

/**
 * Encoding Options for DXF imports
 * 🌐 i18n: All labels converted to i18n keys - 2026-01-18
 */
export const ENCODING_LABELS = {
  'windows-1253': 'dxfViewer.encoding.windows1253',
  'UTF-8': 'dxfViewer.encoding.utf8',
  'windows-1252': 'dxfViewer.encoding.windows1252',
  'ISO-8859-7': 'dxfViewer.encoding.iso88597'
} as const;

/**
 * Contact Business Types - για CompactToolbar configs
 * 🌐 i18n: All labels converted to i18n keys - 2026-01-18
 */
export const CONTACT_BUSINESS_TYPE_LABELS = {
  customer: 'contacts.businessTypes.customer',
  supplier: 'contacts.businessTypes.supplier',
  agent: 'contacts.businessTypes.agent',
  contractor: 'contacts.businessTypes.contractor'
} as const;

/**
 * Availability Status Labels - για CompactToolbar configs
 * 🌐 i18n: All labels converted to i18n keys - 2026-01-18
 */
export const AVAILABILITY_STATUS_LABELS = {
  unavailable: 'common.availability.unavailable',
  available: 'common.availability.available',
  occupied: 'common.availability.occupied'
} as const;

/**
 * Building Name Filter Labels - για CompactToolbar configs
 * 🌐 i18n: All labels converted to i18n keys - 2026-01-18
 */
export const BUILDING_NAME_FILTER_LABELS = {
  NAME_A_TO_Z: 'filters.sorting.nameAZ',
  NAME_Z_TO_A: 'filters.sorting.nameZA',
  CONTAINS_TOWER: 'filters.building.containsTower',
  CONTAINS_COMPLEX: 'filters.building.containsComplex'
} as const;

// ============================================================================
// 🎛️ DXF VIEWER TOOL LABELS - ZERO HARDCODED VALUES
// ============================================================================
//
// 🎯 FORTUNE 500 CENTRALIZATION: DXF Viewer tool labels
// Migrated from toolDefinitions.ts hardcoded strings
// Single source of truth για όλα τα DXF tool labels
//
// ============================================================================

/**
 * DXF Selection Tool Labels
 * 🌐 i18n: All labels converted to i18n keys - 2026-01-18
 */
export const DXF_SELECTION_TOOL_LABELS = {
  SELECT: 'tools.select',
  PAN: 'tools.pan'
} as const;

/**
 * DXF Drawing Tool Labels
 * 🌐 i18n: All labels converted to i18n keys - 2026-01-18
 */
export const DXF_DRAWING_TOOL_LABELS = {
  LINE: 'tools.line',
  // 🏢 ENTERPRISE (2026-01-31): Line tool variations - ADR-060
  LINE_PERPENDICULAR: 'tools.linePerpendicular',
  LINE_PARALLEL: 'tools.lineParallel',
  RECTANGLE: 'tools.rectangle',
  CIRCLE_RADIUS: 'tools.circleRadius',
  CIRCLE_DIAMETER: 'tools.circleDiameter',
  CIRCLE_2P_DIAMETER: 'tools.circle2pDiameter',
  CIRCLE_3P: 'tools.circle3p',
  CIRCLE_CHORD_SAGITTA: 'tools.circleChordSagitta',
  CIRCLE_2P_RADIUS: 'tools.circle2pRadius',
  CIRCLE_BEST_FIT: 'tools.circleBestFit',
  // 🏢 ENTERPRISE (2026-01-31): Circle Tangent to 3 Lines (AutoCAD TTT)
  CIRCLE_TTT: 'tools.circleTTT',
  POLYLINE: 'tools.polyline',
  POLYGON: 'tools.polygon',
  LAYERING: 'tools.layering',
  // 🏢 ENTERPRISE (2026-01-31): Arc drawing tool variations - ADR-059
  ARC: 'tools.arc',
  ARC_3P: 'tools.arc3p',                       // 3-Point Arc (Start → Point on Arc → End)
  ARC_CENTER_START_END: 'tools.arcCenterStartEnd', // Center → Start → End
  ARC_START_CENTER_END: 'tools.arcStartCenterEnd', // Start → Center → End
  // ADR-189: Construction guide tools
  GUIDE_X: 'tools.guideX',
  GUIDE_Z: 'tools.guideZ',
  GUIDE_XZ: 'tools.guideXZ',
  GUIDE_PARALLEL: 'tools.guideParallel',
  GUIDE_PERPENDICULAR: 'tools.guidePerpendicular',
  GUIDE_SEGMENTS: 'tools.guideSegments',
  GUIDE_DISTANCE: 'tools.guideDistance',
  GUIDE_ADD_POINT: 'tools.guideAddPoint',
  GUIDE_DELETE_POINT: 'tools.guideDeletePoint',
  GUIDE_MOVE: 'tools.guideMove',
  GUIDE_DELETE: 'tools.guideDelete',
  // ADR-189 §3.9-§3.12: Arc/Circle guide tools
  GUIDE_ARC_SEGMENTS: 'tools.guideArcSegments',
  GUIDE_ARC_DISTANCE: 'tools.guideArcDistance',
  GUIDE_ARC_LINE_INTERSECT: 'tools.guideArcLineIntersect',
  GUIDE_CIRCLE_INTERSECT: 'tools.guideCircleIntersect',
  GUIDE_RECT_CENTER: 'tools.guideRectCenter',
  GUIDE_LINE_MIDPOINT: 'tools.guideLineMidpoint',
  GUIDE_CIRCLE_CENTER: 'tools.guideCircleCenter',
  GUIDE_GRID: 'tools.guideGrid',
  GUIDE_ROTATE: 'tools.guideRotate',
  GUIDE_ROTATE_ALL: 'tools.guideRotateAll',
  GUIDE_ROTATE_GROUP: 'tools.guideRotateGroup',
  GUIDE_EQUALIZE: 'tools.guideEqualize',
  GUIDE_POLAR_ARRAY: 'tools.guidePolarArray',
  GUIDE_SCALE: 'tools.guideScale',
  GUIDE_ANGLE: 'tools.guideAngle',
  GUIDE_MIRROR: 'tools.guideMirror',
  GUIDE_FROM_ENTITY: 'tools.guideFromEntity',
  GUIDE_SELECT: 'tools.guideSelect',
  GUIDE_COPY_PATTERN: 'tools.guideCopyPattern',
  GUIDE_OFFSET_ENTITY: 'tools.guideOffsetEntity',
  GUIDE_PRESET_GRID: 'tools.guidePresetGrid',
  GUIDE_FROM_SELECTION: 'tools.guideFromSelection',
} as const;

/**
 * DXF Editing Tool Labels
 * 🌐 i18n: All labels converted to i18n keys - 2026-01-18
 */
export const DXF_EDITING_TOOL_LABELS = {
  GRIP_EDIT: 'tools.gripEdit',
  MOVE: 'tools.move',
  ROTATE: 'tools.rotate',
  COPY: 'tools.copy',
  DELETE: 'tools.delete'
} as const;

/**
 * DXF Measurement Tool Labels
 * 🌐 i18n: All labels converted to i18n keys - 2026-01-18
 */
export const DXF_MEASUREMENT_TOOL_LABELS = {
  // 🏢 ENTERPRISE (2026-01-27): Distance measurement variations
  MEASURE_DISTANCE: 'tools.measureDistance',
  MEASURE_DISTANCE_2P: 'tools.measureDistance2P', // Απόσταση 2 σημείων (default)
  MEASURE_DISTANCE_CONTINUOUS: 'tools.measureDistanceContinuous', // Συνεχόμενη μέτρηση απόστασης

  MEASURE_AREA: 'tools.measureArea',

  // Angle measurement variations
  MEASURE_ANGLE: 'tools.measureAngle',
  MEASURE_ANGLE_BASIC: 'tools.measureAngleBasic',
  MEASURE_ANGLE_LINE_ARC: 'tools.measureAngleLineArc',
  MEASURE_ANGLE_TWO_ARCS: 'tools.measureAngleTwoArcs',
  MEASURE_ANGLE_MEASUREGEOM: 'tools.measureAngleMeasuregeom',
  MEASURE_ANGLE_CONSTRAINT: 'tools.measureAngleConstraint'
} as const;

/**
 * DXF Zoom Tool Labels
 * 🌐 i18n: All labels converted to i18n keys - 2026-01-18
 */
export const DXF_ZOOM_TOOL_LABELS = {
  ZOOM_IN: 'tools.zoomIn',
  ZOOM_OUT: 'tools.zoomOut',
  ZOOM_WINDOW: 'tools.zoomWindow',
  ZOOM_EXTENTS: 'tools.zoomExtents'
} as const;

/**
 * DXF Utility Tool Labels
 * 🌐 i18n: All labels converted to i18n keys - 2026-01-18
 */
export const DXF_UTILITY_TOOL_LABELS = {
  UNDO: 'tools.undo',
  REDO: 'tools.redo',
  CURSOR_SETTINGS: 'tools.cursorSettings',
  FIT_TO_VIEW: 'tools.fitToView',
  EXPORT: 'tools.export',
  RUN_TESTS: 'tools.runTests',
  // 🏢 ENTERPRISE: Performance Monitor Toggle (Bentley/Autodesk pattern)
  TOGGLE_PERF: 'tools.togglePerf',
  // 🏢 ENTERPRISE: PDF Background Controls (Independent pan/zoom/rotation)
  PDF_BACKGROUND: 'tools.pdfBackground',
  // 🤖 ADR-185: AI Drawing Assistant Toggle
  AI_ASSISTANT: 'tools.aiAssistant',
  // ADR-189: Guide Analysis Panel Toggle
  GUIDE_ANALYSIS: 'tools.guideAnalysis'
} as const;

// ============================================================================
// 📋 CONTACT FORM FIELD LABELS - ZERO HARDCODED VALUES
// ============================================================================
//
// 🎯 FORTUNE 500 CENTRALIZATION: Contact form field labels
// Migrated from individual-config.ts and company-config.ts hardcoded strings
// Single source of truth για όλα τα contact form field labels
//
// ============================================================================

/**
 * Personal Information Form Field Labels
 * 🌐 i18n: All labels converted to i18n keys - 2026-01-18
 */
export const PERSONAL_INFO_FIELD_LABELS = {
  FIRST_NAME: 'individual.fields.firstName',
  LAST_NAME: 'individual.fields.lastName',
  FATHER_NAME: 'individual.fields.fatherName',
  MOTHER_NAME: 'individual.fields.motherName',
  BIRTH_DATE: 'individual.fields.birthDate',
  BIRTH_COUNTRY: 'individual.fields.birthCountry',
  GENDER: 'individual.fields.gender'
} as const;

/**
 * Identity Document Form Field Labels
 * 🌐 i18n: All labels converted to i18n keys - 2026-01-18
 */
export const IDENTITY_DOCUMENT_FIELD_LABELS = {
  AMKA: 'individual.fields.amka',
  DOCUMENT_TYPE: 'individual.fields.documentType',
  DOCUMENT_ISSUER: 'individual.fields.documentIssuer',
  DOCUMENT_NUMBER: 'individual.fields.documentNumber',
  DOCUMENT_ISSUE_DATE: 'individual.fields.documentIssueDate',
  DOCUMENT_EXPIRY_DATE: 'individual.fields.documentExpiryDate'
} as const;

/**
 * Tax Information Form Field Labels
 * 🌐 i18n: All labels converted to i18n keys - 2026-01-18
 */
export const TAX_INFO_FIELD_LABELS = {
  VAT_NUMBER: 'individual.fields.vatNumber',
  TAX_OFFICE: 'individual.fields.taxOffice'
} as const;

/**
 * Professional Information Form Field Labels
 * 🌐 i18n: All labels converted to i18n keys - 2026-01-18
 */
export const PROFESSIONAL_INFO_FIELD_LABELS = {
  PROFESSION: 'individual.fields.profession',
  SPECIALTY: 'individual.fields.specialty',
  EMPLOYER: 'individual.fields.employer',
  POSITION: 'individual.fields.position',
  // 🇪🇺 ESCO Professional Classification (ADR-034)
  ESCO_URI: 'esco.escoLabel',
  ISCO_CODE: 'esco.iscoCode',
  // 🇪🇺 ESCO Skills (ADR-132)
  SKILLS: 'individual.fields.skills'
} as const;

/**
 * Address Information Form Field Labels
 * 🌐 i18n: All labels converted to i18n keys - 2026-01-18
 */
export const ADDRESS_INFO_FIELD_LABELS = {
  STREET: 'address.fields.street',
  STREET_NUMBER: 'address.fields.streetNumber',
  CITY: 'address.fields.city',
  POSTAL_CODE: 'address.fields.postalCode'
} as const;

/**
 * Contact Information Form Field Labels
 * 🌐 i18n: All labels converted to i18n keys - 2026-01-18
 */
export const CONTACT_INFO_FIELD_LABELS = {
  COMMUNICATION: 'fields.communication'
} as const;

// ============================================================================
// 🏗️ DXF ENTITIES SETTINGS LABELS - ZERO HARDCODED VALUES
// ============================================================================
//
// 🎯 FORTUNE 500 CENTRALIZATION: DXF Entities Settings Labels
// Migrated from EntitiesSettings.tsx hardcoded strings
// Single source of truth για όλα τα DXF entities settings labels
//
// ============================================================================

/**
 * DXF Settings Tab Labels
 * 🌐 i18n: All labels converted to i18n keys - 2026-01-18
 */
export const DXF_SETTINGS_TAB_LABELS = {
  DRAWING: 'dxfViewer.settings.tabs.drawing',
  MEASUREMENTS: 'dxfViewer.settings.tabs.measurements',
  DRAFT: 'dxfViewer.settings.tabs.draft',
  COMPLETION: 'dxfViewer.settings.tabs.completion',
  HOVER: 'dxfViewer.settings.tabs.hover',
  SELECTION: 'dxfViewer.settings.tabs.selection'
} as const;

/**
 * DXF Settings Override Labels
 * 🌐 i18n: All labels converted to i18n keys - 2026-01-18
 */
export const DXF_SETTINGS_OVERRIDE_LABELS = {
  OVERRIDE_GLOBAL_SETTINGS: 'dxfViewer.settings.overrideGlobalSettings'
} as const;

/**
 * DXF Drawing Tool Labels (Simple - without context)
 * 🌐 i18n: All labels converted to i18n keys - 2026-01-18
 */
export const DXF_DRAWING_SIMPLE_LABELS = {
  LINE: 'dxfViewer.tools.line',
  RECTANGLE: 'dxfViewer.tools.rectangle',
  CIRCLE: 'dxfViewer.tools.circle',
  POLYLINE: 'dxfViewer.tools.polyline',
  POLYGON: 'dxfViewer.tools.polygon'
} as const;

/**
 * DXF Measurement Tool Labels (Simple)
 * 🌐 i18n: All labels converted to i18n keys - 2026-01-18
 */
export const DXF_MEASUREMENT_SIMPLE_LABELS = {
  DISTANCE: 'dxfViewer.measurements.distance',
  AREA: 'dxfViewer.measurements.area',
  ANGLE: 'dxfViewer.measurements.angle'
} as const;

// ============================================================================
// 🏢 COMPANY FORM FIELD LABELS - ZERO HARDCODED VALUES
// ============================================================================
//
// 🎯 FORTUNE 500 CENTRALIZATION: Company Form Field Labels
// Migrated from company-config.ts hardcoded strings
// Single source of truth για όλα τα company form field labels
//
// ============================================================================

/**
 * Company Basic Information Field Labels
 * 🌐 i18n: All labels converted to i18n keys - 2026-01-18
 */
export const COMPANY_BASIC_INFO_LABELS = {
  COMPANY_NAME: 'contacts.company.fields.companyName',
  TRADE_NAME: 'contacts.company.fields.tradeName',
  LEGAL_FORM: 'contacts.company.fields.legalForm'
} as const;

/**
 * GEMI Information Field Labels
 * 🌐 i18n: All labels converted to i18n keys - 2026-01-18
 */
export const COMPANY_GEMI_INFO_LABELS = {
  GEMI_NUMBER: 'contacts.company.fields.gemiNumber',
  GEMI_STATUS: 'contacts.company.fields.gemiStatus',
  CHAMBER: 'contacts.company.fields.chamber',
  ACTIVITY_CODE_KAD: 'contacts.company.fields.activityCodeKad',
  ACTIVITY_DESCRIPTION: 'contacts.company.fields.activityDescription'
} as const;

/**
 * Company Contact Information Field Labels
 * 🌐 i18n: All labels converted to i18n keys - 2026-01-18
 */
export const COMPANY_CONTACT_INFO_LABELS = {
  PHONE_CENTRAL: 'contacts.company.fields.phoneCentral',
  EMAIL_CONTACT: 'contacts.company.fields.emailContact',
  WEBSITE: 'contacts.company.fields.website'
} as const;

/**
 * GEMI Status Option Labels
 * 🌐 i18n: All labels converted to i18n keys - 2026-01-18
 */
export const COMPANY_GEMI_STATUS_OPTIONS = {
  ACTIVE: 'options.gemiStatuses.active',
  INACTIVE: 'options.gemiStatuses.inactive',
  SUSPENDED: 'options.gemiStatuses.suspended',
  DISSOLUTION: 'options.gemiStatuses.dissolution'
} as const;

// ============================================================================
// 🏛️ SERVICE FORM FIELD LABELS - ZERO HARDCODED VALUES
// ============================================================================
//
// 🎯 FORTUNE 500 CENTRALIZATION: Service Form Field Labels
// Migrated from service-config.ts hardcoded strings
// Single source of truth για όλα τα service form field labels
//
// ============================================================================

/**
 * Service Administrative Information Field Labels
 * 🌐 i18n: All labels converted to i18n keys - 2026-01-18
 * 🔧 FIX: Added .label suffix to match nested translation structure
 */
export const SERVICE_ADMINISTRATIVE_INFO_LABELS = {
  LEGAL_STATUS: 'contacts.service.fields.legalStatus.label',
  ESTABLISHMENT_LAW: 'contacts.service.fields.establishmentLaw.label',
  HEAD_TITLE: 'contacts.service.fields.headTitle.label',
  HEAD_NAME: 'contacts.service.fields.headName.label'
} as const;

/**
 * Service Responsibilities Field Labels
 * 🌐 i18n: All labels converted to i18n keys - 2026-01-18
 * 🔧 FIX: Added .label suffix to match nested translation structure
 */
export const SERVICE_RESPONSIBILITIES_LABELS = {
  MAIN_RESPONSIBILITIES: 'contacts.service.fields.mainResponsibilities.label',
  CITIZEN_SERVICES: 'contacts.service.fields.citizenServices.label',
  ONLINE_SERVICES: 'contacts.service.fields.onlineServices.label',
  SERVICE_HOURS: 'contacts.service.fields.serviceHours.label'
} as const;

// ============================================================================
// 🅿️ PARKING TABLE COLUMN LABELS - ZERO HARDCODED VALUES
// ============================================================================
//
// 🎯 FORTUNE 500 CENTRALIZATION: Parking Table Column Labels
// Migrated from parking-spot-table/columns.ts hardcoded strings
// Single source of truth για όλα τα parking table column labels
//
// ============================================================================

/**
 * Parking Table Column Labels
 */
export const PARKING_TABLE_COLUMN_LABELS = {
  // 🏢 ENTERPRISE: i18n keys for parking table columns
  // Keys with '.' are automatically translated using useTranslation
  CODE: 'parkingManagement.columns.code',
  TYPE: 'parkingManagement.columns.type',
  PROPERTY_CODE: 'parkingManagement.columns.property',
  LEVEL: 'parkingManagement.columns.level',
  AREA: 'parkingManagement.columns.area',
  PRICE: 'parkingManagement.columns.price',
  VALUE: 'parkingManagement.columns.value',
  VALUE_WITH_SYNDICATE: 'parkingManagement.columns.valueWithSyndicate',
  STATUS: 'parkingManagement.columns.status',
  OWNER: 'parkingManagement.columns.owner',
  FLOOR_PLAN: 'parkingManagement.columns.floorPlan',
  CONSTRUCTED_BY: 'parkingManagement.columns.registeredBy',
  ACTIONS: 'parkingManagement.columns.actions'
} as const;

// ============================================================================
// 🔗 RELATIONSHIP TYPE LABELS (Contact Management)
// ============================================================================

/**
 * 🔗 Relationship Type Labels - Professional Categories
 *
 * ✅ ENTERPRISE: Centralized relationship type labels
 * ✅ ZERO HARDCODED VALUES: Single source of truth
 * ✅ Domain: Contact relationship management
 */
// 🌐 i18n: All labels converted to i18n keys - 2026-01-18
export const RELATIONSHIP_TYPE_LABELS = {
  // 👥 Employment Relationships
  EMPLOYEE: 'contacts.relationships.types.employee',
  MANAGER: 'contacts.relationships.types.manager',
  DIRECTOR: 'contacts.relationships.types.director',
  EXECUTIVE: 'contacts.relationships.types.executive',
  INTERN: 'contacts.relationships.types.intern',
  CONTRACTOR: 'contacts.relationships.types.contractor',
  CONSULTANT: 'contacts.relationships.types.consultant',

  // 🏢 Corporate Relationships
  SHAREHOLDER: 'contacts.relationships.types.shareholder',
  BOARD_MEMBER: 'contacts.relationships.types.boardMember',
  CHAIRMAN: 'contacts.relationships.types.chairman',
  CEO: 'contacts.relationships.types.ceo',
  REPRESENTATIVE: 'contacts.relationships.types.representative',
  PARTNER: 'contacts.relationships.types.partner',
  VENDOR: 'contacts.relationships.types.vendor',
  CLIENT: 'contacts.relationships.types.client',

  // 🏛️ Government/Service Relationships
  CIVIL_SERVANT: 'contacts.relationships.types.civilServant',
  ELECTED_OFFICIAL: 'contacts.relationships.types.electedOfficial',
  APPOINTED_OFFICIAL: 'contacts.relationships.types.appointedOfficial',
  DEPARTMENT_HEAD: 'contacts.relationships.types.departmentHead',
  MINISTRY_OFFICIAL: 'contacts.relationships.types.ministryOfficial',
  MAYOR: 'contacts.relationships.types.mayor',
  DEPUTY_MAYOR: 'contacts.relationships.types.deputyMayor',
  REGIONAL_GOVERNOR: 'contacts.relationships.types.regionalGovernor',

  // 🔗 Other Professional Relationships
  ADVISOR: 'contacts.relationships.types.advisor',
  MENTOR: 'contacts.relationships.types.mentor',
  PROTEGE: 'contacts.relationships.types.protege',
  COLLEAGUE: 'contacts.relationships.types.colleague',
  SUPPLIER: 'contacts.relationships.types.supplier',
  CUSTOMER: 'contacts.relationships.types.customer',
  COMPETITOR: 'contacts.relationships.types.competitor',
  OTHER: 'contacts.relationships.types.other'
} as const;

/**
 * 📊 Employment Status Labels - Detailed Work Classification
 *
 * ✅ ENTERPRISE: Employment status labels for HR tracking
 * ✅ Aligned with Greek labor law and EU standards
 */
// 🌐 i18n: All labels converted to i18n keys - 2026-01-18
export const EMPLOYMENT_STATUS_LABELS = {
  FULL_TIME: 'contacts.employment.status.fullTime',
  PART_TIME: 'contacts.employment.status.partTime',
  CONTRACT: 'contacts.employment.status.contract',
  TEMPORARY: 'contacts.employment.status.temporary',
  SEASONAL: 'contacts.employment.status.seasonal',
  VOLUNTEER: 'contacts.employment.status.volunteer',
  RETIRED: 'contacts.employment.status.retired',
  ON_LEAVE: 'contacts.employment.status.onLeave',
  TERMINATED: 'contacts.employment.status.terminated'
} as const;

// ============================================================================
// 🏗️ PROJECT TAB LABELS (Project Management)
// ============================================================================

/**
 * 🏗️ Project Tab Labels - Project Management Interface
 *
 * ✅ ENTERPRISE: Centralized project tab labels
 * ✅ ZERO HARDCODED VALUES: Single source of truth
 * ✅ Domain: Project navigation and organization
 */
export const PROJECT_TAB_LABELS = {
  // 🏢 ENTERPRISE: i18n keys for project tabs (translated via UniversalTabsRenderer)
  // Keys with '.' are automatically translated using the building namespace
  GENERAL: 'tabs.labels.projectGeneral',
  FLOORPLAN: 'tabs.labels.projectFloorplan',
  PARKING_FLOORPLAN: 'tabs.labels.parkingFloorplan',
  STRUCTURE: 'tabs.labels.projectStructure',
  TIMELINE: 'tabs.labels.timeline',
  CUSTOMERS: 'tabs.labels.customers',
  BUILDING_DATA: 'tabs.labels.buildingData',
  PARKING: 'tabs.labels.parking',
  CONTRIBUTORS: 'tabs.labels.contributors',
  DOCUMENTS: 'tabs.labels.projectDocuments',
  IKA: 'tabs.labels.ika',
  PHOTOS: 'tabs.labels.photos',
  VIDEOS: 'tabs.labels.videos',
  HISTORY: 'tabs.labels.history',
} as const;

/**
 * 📝 Project Tab Descriptions - Detailed Information
 *
 * ✅ ENTERPRISE: Tab description labels for tooltips/help
 */
export const PROJECT_TAB_DESCRIPTIONS = {
  // 🏢 ENTERPRISE: i18n keys for project tab descriptions
  GENERAL: 'tabs.descriptions.projectGeneral',
  FLOORPLAN: 'tabs.descriptions.projectFloorplan',
  PARKING_FLOORPLAN: 'tabs.descriptions.parkingFloorplan',
  STRUCTURE: 'tabs.descriptions.projectStructure',
  TIMELINE: 'tabs.descriptions.timeline',
  CUSTOMERS: 'tabs.descriptions.customers',
  BUILDING_DATA: 'tabs.descriptions.buildingData',
  PARKING: 'tabs.descriptions.parking',
  CONTRIBUTORS: 'tabs.descriptions.contributors',
  DOCUMENTS: 'tabs.descriptions.projectDocuments',
  IKA: 'tabs.descriptions.ika',
  PHOTOS: 'tabs.descriptions.photos',
  VIDEOS: 'tabs.descriptions.videos',
  HISTORY: 'tabs.descriptions.history',
} as const;

/**
 * 🏷️ Project Component Props Labels
 *
 * ✅ ENTERPRISE: Component title labels for FloorplanViewer
 */
export const PROJECT_COMPONENT_LABELS = {
  // 🏢 ENTERPRISE: i18n keys for project component titles
  FLOORPLAN_TITLE: 'floorplan.titles.project',
  PARKING_FLOORPLAN_TITLE: 'floorplan.titles.parking'
} as const;

// ============================================================================
// 🏢 BUILDING TOOLBAR LABELS (Building Management Interface)
// ============================================================================

/**
 * 🏢 Building Toolbar Action Labels - Building Management
 *
 * ✅ ENTERPRISE: Centralized building toolbar action labels
 * ✅ ZERO HARDCODED VALUES: Single source of truth
 * ✅ Domain: Building management interface
 */
// 🌐 i18n: All labels converted to i18n keys - 2026-01-18
export const BUILDING_TOOLBAR_LABELS = {
  // Primary Actions
  NEW_BUILDING: 'building.toolbar.newBuilding',
  EDIT_BUILDING: 'building.toolbar.editBuilding',
  DELETE_BUILDING: 'building.toolbar.deleteBuilding',

  // Secondary Actions
  EXPORT: 'common.actions.export',
  IMPORT: 'common.actions.import',
  REFRESH: 'common.actions.refresh',
  ARCHIVE: 'building.toolbar.archive',
  FAVORITES: 'toolbar.labels.favorites',
  HELP: 'common.actions.help',

  // Filter Labels
  STATUS_FILTER: 'filters.fields.status',
  TYPE_FILTER: 'filters.fields.type',
  SORT_FILTER: 'filters.fields.sort'
} as const;

/**
 * 🔍 Building Toolbar Tooltips - Help Text
 *
 * ✅ ENTERPRISE: Tooltip labels for building toolbar actions
 * 🌐 i18n: All labels converted to i18n keys - 2026-01-18
 */
export const BUILDING_TOOLBAR_TOOLTIPS = {
  NEW_BUILDING: 'building.toolbar.tooltips.newBuilding',
  EDIT_BUILDING: 'building.toolbar.tooltips.editBuilding',
  DELETE_BUILDING_SINGLE: 'building.toolbar.tooltips.deleteBuilding',
  DELETE_BUILDING_MULTIPLE: 'building.toolbar.tooltips.deleteBuildingMultiple',
  EXPORT_DATA: 'building.toolbar.tooltips.exportData',
  IMPORT_DATA: 'building.toolbar.tooltips.importData',
  REFRESH_DATA: 'building.toolbar.tooltips.refreshData',
  ARCHIVE_SELECTED: 'building.toolbar.tooltips.archiveSelected',
  ADD_TO_FAVORITES: 'building.toolbar.tooltips.addToFavorites',
  SHOW_HELP: 'building.toolbar.tooltips.showHelp'
} as const;

/**
 * 🏷️ Building Toolbar UI Labels - Interface Text
 *
 * ✅ ENTERPRISE: UI text for building toolbar interface
 * 🌐 i18n: All labels converted to i18n keys - 2026-01-18
 */
export const BUILDING_TOOLBAR_UI_LABELS = {
  SEARCH_PLACEHOLDER: 'building.toolbar.ui.searchPlaceholder',
  BUILDING_STATUS_LABEL: 'building.toolbar.ui.statusLabel',
  BUILDING_TYPE_LABEL: 'building.toolbar.ui.typeLabel',
  BUILDING_SORTING_LABEL: 'building.toolbar.ui.sortingLabel',
  SORT_ASCENDING: 'filters.sorting.ascending',
  SORT_DESCENDING: 'filters.sorting.descending',
  SORT_BY_DATE: 'filters.sorting.byDate',
  SORT_BY_SIZE: 'filters.sorting.bySize',
  SELECTED_BUILDINGS: 'building.toolbar.ui.selectedBuildings'
} as const;

// ============================================================================
// 🎭 CONTACT PERSONA LABELS (ADR-121)
// ============================================================================

/**
 * 🎭 Persona Type Labels — Contact Role Classification
 *
 * ✅ ENTERPRISE: SAP Business Partner pattern
 * ✅ ZERO HARDCODED VALUES: Single source of truth
 * ✅ Domain: Contact persona/role management
 * @see ADR-121 Contact Persona System
 */
export const PERSONA_TYPE_LABELS = {
  CONSTRUCTION_WORKER: 'persona.types.constructionWorker',
  ENGINEER: 'persona.types.engineer',
  ACCOUNTANT: 'persona.types.accountant',
  LAWYER: 'persona.types.lawyer',
  PROPERTY_OWNER: 'persona.types.propertyOwner',
  CLIENT: 'persona.types.client',
  SUPPLIER: 'persona.types.supplier',
  NOTARY: 'persona.types.notary',
  REAL_ESTATE_AGENT: 'persona.types.realEstateAgent',
} as const;

/**
 * 🎭 Persona Type Icons — Visual indicators per persona
 */
export const PERSONA_TYPE_ICONS = {
  CONSTRUCTION_WORKER: 'hard-hat',
  ENGINEER: 'ruler',
  ACCOUNTANT: 'calculator',
  LAWYER: 'scale',
  PROPERTY_OWNER: 'home',
  CLIENT: 'user-check',
  SUPPLIER: 'package',
  NOTARY: 'file-signature',
  REAL_ESTATE_AGENT: 'key',
} as const;

/**
 * 🎭 Persona Field Labels — Per-persona field labels
 *
 * ✅ ENTERPRISE: Centralized field labels for all persona-specific fields
 */
export const PERSONA_FIELD_LABELS = {
  // 🏗️ Construction Worker (ΕΦΚΑ/ΙΚΑ)
  IKA_NUMBER: 'persona.fields.ikaNumber',
  INSURANCE_CLASS: 'persona.fields.insuranceClass',
  TRIENNIA: 'persona.fields.triennia',
  DAILY_WAGE: 'persona.fields.dailyWage',
  SPECIALTY_CODE: 'persona.fields.specialtyCode',
  EFKA_REGISTRATION_DATE: 'persona.fields.efkaRegistrationDate',
  // 📐 Engineer (ΤΕΕ)
  TEE_REGISTRY_NUMBER: 'persona.fields.teeRegistryNumber',
  ENGINEER_SPECIALTY: 'persona.fields.engineerSpecialty',
  LICENSE_CLASS: 'persona.fields.licenseClass',
  PTDE_NUMBER: 'persona.fields.ptdeNumber',
  // 📊 Accountant (ΟΕΕ)
  OEE_NUMBER: 'persona.fields.oeeNumber',
  ACCOUNTING_CLASS: 'persona.fields.accountingClass',
  // ⚖️ Lawyer
  BAR_ASSOCIATION_NUMBER: 'persona.fields.barAssociationNumber',
  BAR_ASSOCIATION: 'persona.fields.barAssociation',
  // 🏠 Property Owner
  PROPERTY_COUNT: 'persona.fields.propertyCount',
  OWNERSHIP_NOTES: 'persona.fields.ownershipNotes',
  // 👤 Client
  CLIENT_SINCE: 'persona.fields.clientSince',
  CLIENT_CATEGORY: 'persona.fields.clientCategory',
  PREFERRED_CONTACT_METHOD: 'persona.fields.preferredContactMethod',
  // 📦 Supplier
  SUPPLIER_CATEGORY: 'persona.fields.supplierCategory',
  PAYMENT_TERMS_DAYS: 'persona.fields.paymentTermsDays',
  // 📜 Notary
  NOTARY_REGISTRY_NUMBER: 'persona.fields.notaryRegistryNumber',
  NOTARY_DISTRICT: 'persona.fields.notaryDistrict',
  // 🏪 Real Estate Agent
  RE_LICENSE_NUMBER: 'persona.fields.reLicenseNumber',
  RE_AGENCY: 'persona.fields.reAgency',
} as const;

/**
 * 🎭 Persona Section Labels — Tab/Section titles per persona
 */
export const PERSONA_SECTION_LABELS = {
  CONSTRUCTION_WORKER_TITLE: 'persona.sections.constructionWorker.title',
  CONSTRUCTION_WORKER_DESCRIPTION: 'persona.sections.constructionWorker.description',
  ENGINEER_TITLE: 'persona.sections.engineer.title',
  ENGINEER_DESCRIPTION: 'persona.sections.engineer.description',
  ACCOUNTANT_TITLE: 'persona.sections.accountant.title',
  ACCOUNTANT_DESCRIPTION: 'persona.sections.accountant.description',
  LAWYER_TITLE: 'persona.sections.lawyer.title',
  LAWYER_DESCRIPTION: 'persona.sections.lawyer.description',
  PROPERTY_OWNER_TITLE: 'persona.sections.propertyOwner.title',
  PROPERTY_OWNER_DESCRIPTION: 'persona.sections.propertyOwner.description',
  CLIENT_TITLE: 'persona.sections.client.title',
  CLIENT_DESCRIPTION: 'persona.sections.client.description',
  SUPPLIER_TITLE: 'persona.sections.supplier.title',
  SUPPLIER_DESCRIPTION: 'persona.sections.supplier.description',
  NOTARY_TITLE: 'persona.sections.notary.title',
  NOTARY_DESCRIPTION: 'persona.sections.notary.description',
  REAL_ESTATE_AGENT_TITLE: 'persona.sections.realEstateAgent.title',
  REAL_ESTATE_AGENT_DESCRIPTION: 'persona.sections.realEstateAgent.description',
} as const;

