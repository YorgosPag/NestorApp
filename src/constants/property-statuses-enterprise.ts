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

export const PROPERTY_STATUS_LABELS: Record<PropertyStatus, string> = {
  'for-sale': 'Προς Πώληση',
  'for-rent': 'Προς Ενοικίαση',
  'reserved': 'Δεσμευμένο',
  'sold': 'Πουλημένο',
  'landowner': 'Οικοπεδούχου',
  'rented': 'Ενοικιάστηκε',
  'under-negotiation': 'Υπό Διαπραγμάτευση',
  'coming-soon': 'Σύντομα Διαθέσιμο',
  'off-market': 'Εκτός Αγοράς',
  'unavailable': 'Μη Διαθέσιμο',
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

export const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  'apartment': 'Διαμέρισμα',
  'studio': 'Στούντιο',
  'maisonette': 'Μεζονέτα',
  'shop': 'Κατάστημα',
  'office': 'Γραφείο',
  'storage': 'Αποθήκη'
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

// Core common filter labels που χρησιμοποιούνται σε όλους τους domains
export const COMMON_FILTER_LABELS = {
  ALL_TYPES: 'Όλοι οι τύποι',
  ALL_STATUSES: 'Όλες οι καταστάσεις',
  ALL_FLOORS: 'Όλοι οι όροφοι',
  ALL_UNITS: 'Όλες οι μονάδες',
  ALL_AREAS: 'Όλα τα εμβαδά'
} as const;

// Domain-specific extensions
export const PROPERTY_FILTER_LABELS = {
  ...COMMON_FILTER_LABELS,
  ALL_BUILDINGS: 'Όλα τα κτίρια',
  ALL_PROJECTS: 'Όλα τα έργα'
} as const;

// 🏢 ENTERPRISE: Storage domain filter labels (unified from storage/constants.ts)
export const STORAGE_FILTER_LABELS = {
  ...COMMON_FILTER_LABELS
} as const;

// 🏢 ENTERPRISE: Parking domain filter labels (unified from types/parking.ts)
export const PARKING_FILTER_LABELS = {
  ...COMMON_FILTER_LABELS,
  ALL_LEVELS: 'Όλα τα επίπεδα'
} as const;

// ============================================================================
// 🏢 ENTERPRISE UNIFIED STATUS FILTER LABELS
// ============================================================================
//
// 🎯 EXTRACTED από core/status/StatusConstants.ts για CompactToolbar centralization
// Single source of truth για όλα τα status filter labels
//
// ============================================================================

// Core status labels extracted from UNIFIED_BADGE_SYSTEM
export const UNIFIED_STATUS_FILTER_LABELS = {
  // Βασικές καταστάσεις - shared across all domains
  AVAILABLE: 'Διαθέσιμες',           // from UNIT_STATUSES.available.label (plural)
  SOLD: 'Πωλημένες',                 // from UNIT_STATUSES.sold.label (plural)
  RESERVED: 'Κρατημένες',            // from UNIT_STATUSES.reserved.label (plural)
  MAINTENANCE: 'Συντήρηση',          // from UNIT_STATUSES.maintenance.label
  OCCUPIED: 'Κατειλημμένες',         // from UNIT_STATUSES.occupied.label (plural)

  // Project statuses
  PLANNING: 'Σχεδιασμένα',           // from PROJECT_STATUSES.planning.label (plural)
  IN_PROGRESS: 'Σε εξέλιξη',        // from PROJECT_STATUSES.in_progress.label
  COMPLETED: 'Ολοκληρωμένα',        // from PROJECT_STATUSES.completed.label (plural)
  ON_HOLD: 'Σε αναμονή',            // from PROJECT_STATUSES.on_hold.label

  // Contact statuses
  ACTIVE: 'Ενεργές',                // from CONTACT_STATUSES.active.label (plural)
  INACTIVE: 'Ανενεργές',            // from CONTACT_STATUSES.inactive.label (plural)
  ARCHIVED: 'Αρχειοθετημένες',      // from CONTACT_STATUSES.archived.label (plural)

  // Extended status labels (migrated from AdvancedFilters)
  LEAD: 'Προοπτική',                // from contact filters
  PENDING: 'Εκκρεμεί',              // from various filters
  CONSTRUCTION: 'Υπό κατασκευή'     // from building filters
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
export const STORAGE_TYPE_LABELS = {
  storage: 'Αποθήκη',
  parking: 'Θέση Στάθμευσης'
} as const;

export const STORAGE_STATUS_LABELS = {
  available: 'Διαθέσιμο',
  sold: 'Πωλήθηκε',
  reserved: 'Κρατημένο',
  maintenance: 'Συντήρηση'
} as const;

// Project type labels (migrated from ProjectToolbar.tsx)
export const PROJECT_TYPE_LABELS = {
  residential: 'Οικιστικό',
  commercial: 'Επαγγελματικό',
  infrastructure: 'Υποδομές'
} as const;

// DXF Layer category labels (migrated from DXF Viewer Layer Manager)
export const DXF_LAYER_CATEGORY_LABELS = {
  all: 'Όλες οι κατηγορίες',
  electrical: 'Ηλεκτρολογικά',
  plumbing: 'Υδραυλικά',
  hvac: 'HVAC'
} as const;

// Price filter labels (migrated from LandingPage.tsx)
export const PRICE_FILTER_LABELS = {
  ALL_PRICES: 'Όλες οι τιμές'
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

export const UNIT_SALE_STATUS_LABELS = {
  [UNIT_SALE_STATUS.NOT_SOLD]: 'Δεν έχει πωληθεί',
  [UNIT_SALE_STATUS.SOLD]: 'Πωλήθηκε',
  [UNIT_SALE_STATUS.RESERVED]: 'Κρατημένη',
  [UNIT_SALE_STATUS.PENDING]: 'Εκκρεμεί'
} as const;

// Obligation status labels (migrated from StatusConstants.ts - labels only)
export const OBLIGATION_STATUS_LABELS = {
  draft: 'Προσχέδιο',
  completed: 'Ολοκληρωμένο',
  approved: 'Εγκεκριμένο'
} as const;

// Obligation status label getter function (migrated)
export const getObligationStatusLabel = (status: string): string => {
  return (OBLIGATION_STATUS_LABELS as any)[status] || status;
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
export const PROPERTY_STANDARD_FLOORS: string[] = [
  'Υπόγειο 3',
  'Υπόγειο 2',
  'Υπόγειο 1',
  'Υπόγειο',
  'Ισόγειο',
  '1ος Όροφος',
  '2ος Όροφος',
  '3ος Όροφος',
  '4ος Όροφος',
  '5ος Όροφος',
  '6ος Όροφος',
  '7ος Όροφος',
  '8ος Όροφος',
  '9ος Όροφος'
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
export const ENHANCED_STATUS_LABELS: Record<EnhancedPropertyStatus, string> = {
  // Βασικές καταστάσεις (από υπάρχον σύστημα)
  ...PROPERTY_STATUS_LABELS,

  // 🏨 Advanced Rental Statuses
  'rental-only': 'Μόνο Ενοικίαση',
  'long-term-rental': 'Μακροχρόνια Μίσθωση',
  'short-term-rental': 'Βραχυχρόνια Μίσθωση',

  // 🔒 Advanced Reservation Statuses
  'reserved-pending': 'Δεσμευμένο Εκκρεμές',
  'contract-signed': 'Συμβόλαιο Υπογεγραμμένο',
  'deposit-paid': 'Προκαταβολή Δεδομένη',

  // 👑 Ownership Statuses
  'company-owned': 'Εταιρικό',
  'not-for-sale': 'Δεν Πωλείται',
  'family-reserved': 'Οικογενειακό',

  // ⚡ Market Dynamics
  'pre-launch': 'Προ-εκκίνηση',
  'exclusive-listing': 'Αποκλειστική Διάθεση',
  'price-reduced': 'Μειωμένη Τιμή',
  'urgent-sale': 'Επείγουσα Πώληση',

  // 🔧 Operational Statuses
  'under-renovation': 'Υπό Ανακαίνιση',
  'legal-issues': 'Νομικά Προβλήματα',
  'inspection-required': 'Απαιτείται Επιθεώρηση',
  'documentation-pending': 'Εκκρεμή Έγγραφα',
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

export const PROPERTY_INTENT_LABELS: Record<PropertyIntent, string> = {
  'sale': 'Προς Πώληση',
  'rental': 'Προς Ενοικίαση',
  'both': 'Πώληση & Ενοικίαση',
  'investment': 'Επενδυτικό',
  'development': 'Υπό Ανάπτυξη',
  'internal': 'Εσωτερική Χρήση',
  'withdrawn': 'Αποσυρμένο',
};

export const MARKET_AVAILABILITY_LABELS: Record<MarketAvailability, string> = {
  'immediately-available': 'Άμεσα Διαθέσιμο',
  'available-soon': 'Σύντομα Διαθέσιμο',
  'conditionally-available': 'Υπό Προϋποθέσεις',
  'reserved': 'Δεσμευμένο',
  'occupied': 'Κατειλημμένο',
  'off-market': 'Εκτός Αγοράς',
  'not-available': 'Μη Διαθέσιμο',
};

export const PROPERTY_PRIORITY_LABELS: Record<PropertyPriority, string> = {
  'high': 'Υψηλή Προτεραιότητα',
  'medium': 'Μέση Προτεραιότητα',
  'low': 'Χαμηλή Προτεραιότητα',
  'showcase': 'Showcase Property',
  'hold': 'Κρατημένο',
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
  high: 'Υψηλή',
  medium: 'Μέτρια',
  low: 'Χαμηλή',
  urgent: 'Επείγον',
  critical: 'Κρίσιμη'
} as const;

// ============================================================================
// 🏢 ENTERPRISE BUILDING/PROJECT STATUS LABELS (Migrated from AdvancedFilters)
// ============================================================================

export const BUILDING_PROJECT_STATUS_LABELS = {
  'for-sale': 'Προς Πώληση',
  'for-rent': 'Προς Ενοικίαση',
  'rented': 'Ενοικιασμένο',
  'withdrawn': 'Αποσύρθηκε',
  'in_progress': 'Σε εξέλιξη',
  'delayed': 'Καθυστέρηση',
  'cancelled': 'Ακυρώθηκε',
  'excellent': 'Άριστη',
  'very-good': 'Πολύ καλή',
  'good': 'Καλή',
  'needs-renovation': 'Χρειάζεται ανακαίνιση',
  'under-renovation': 'Υπό ανακαίνιση'
} as const;

// ============================================================================
// 🏢 ENTERPRISE PROPERTY/BUILDING TYPE LABELS (Migrated from AdvancedFilters)
// ============================================================================

export const PROPERTY_BUILDING_TYPE_LABELS = {
  'individual': 'Φυσικά Πρόσωπα',
  'company': 'Νομικά Πρόσωπα',
  'service': 'Υπηρεσίες',
  'residential': 'Οικιστικό',        // Building Toolbar format
  'commercial': 'Επαγγελματικό',     // Building Toolbar format
  'industrial': 'Βιομηχανικό',
  'office': 'Γραφεία',
  'mixed': 'Μεικτό',                 // Building Toolbar format
  'warehouse': 'Αποθήκη',
  'retail': 'Λιανικό',
  'hotel': 'Ξενοδοχείο',
  'public': 'Δημόσιο',
  'renovation': 'Ανακαίνιση',
  'infrastructure': 'Υποδομές'
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
export const PHONE_TYPE_LABELS = {
  mobile: 'Κινητό',
  home: 'Σπίτι',
  work: 'Εργασία',
  fax: 'Φαξ',
  other: 'Άλλο'
} as const;

// Email Types
export const EMAIL_TYPE_LABELS = {
  personal: 'Προσωπικό',
  work: 'Εργασία',
  other: 'Άλλο'
} as const;

// Website Types
export const WEBSITE_TYPE_LABELS = {
  personal: 'Προσωπική',
  company: 'Εταιρική',
  portfolio: 'Χαρτοφυλάκιο',
  blog: 'Blog',
  other: 'Άλλη'
} as const;

// Social Media Types (usage context)
export const SOCIAL_MEDIA_TYPE_LABELS = {
  personal: 'Προσωπικό',
  professional: 'Επαγγελματικό',
  business: 'Επιχειρησιακό',
  other: 'Άλλο'
} as const;

// Social Media Platforms
export const SOCIAL_PLATFORM_LABELS = {
  linkedin: 'LinkedIn',
  facebook: 'Facebook',
  instagram: 'Instagram',
  twitter: 'Twitter/X',
  youtube: 'YouTube',
  github: 'GitHub',
  tiktok: 'TikTok',
  whatsapp: 'WhatsApp',
  telegram: 'Telegram',
  other: 'Άλλη Πλατφόρμα'
} as const;

// Identity Document Types - Comprehensive Options
export const IDENTITY_TYPE_LABELS = {
  id_card: 'Δελτίο Ταυτότητας',
  identity_card: 'Δελτίο Ταυτότητας',
  passport: 'Διαβατήριο',
  afm: 'ΑΦΜ',
  amka: 'ΑΜΚΑ',
  license: 'Άδεια Οδήγησης',
  drivers_license: 'Άδεια Οδήγησης',
  other: 'Άλλο'
} as const;

// Professional Information Types
export const PROFESSIONAL_TYPE_LABELS = {
  company_phone: 'Τηλέφωνο Εταιρείας',
  company_email: 'Email Εταιρείας',
  company_website: 'Website Εταιρείας',
  linkedin: 'LinkedIn',
  position: 'Θέση Εργασίας',
  department: 'Τμήμα',
  other: 'Άλλο'
} as const;

// Address Types - Comprehensive Options
export const ADDRESS_TYPE_LABELS = {
  home: 'Κατοικία',
  work: 'Εργασία',
  mailing: 'Αλληλογραφία',
  billing: 'Χρέωση',
  headquarters: 'Έδρα',
  branch: 'Υποκατάστημα',
  other: 'Άλλο'
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
export const COMPANY_LEGAL_FORM_LABELS = {
  ae: 'Α.Ε. (Ανώνυμη Εταιρεία)',
  epe: 'Ε.Π.Ε. (Εταιρεία Περιορισμένης Ευθύνης)',
  ee: 'Ε.Ε. (Ετερόρρυθμη Εταιρεία)',
  oe: 'Ο.Ε. (Ομόρρυθμη Εταιρεία)',
  ikepe: 'Ι.Κ.Ε. (Ιδιωτική Κεφαλαιουχική Εταιρεία)',
  ike: 'Ι.Κ.Ε. (Ιδιωτική Κεφαλαιουχική Εταιρεία)',
  mono: 'Μονοπρόσωπη Ι.Κ.Ε.',
  smpc: 'Α.Ε.Β.Ε. (Ανώνυμη Εταιρεία Βιομηχανικής Ερευνας)',
  other: 'Άλλο'
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
export const TREND_LABELS = {
  increase: 'Αύξηση',
  decrease: 'Μείωση',
  stable: 'Σταθερό',
  improvement: 'Βελτίωση',
  new: 'Νέο',
  updated: 'Ενημερωμένο'
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
export const EXTENDED_PROPERTY_TYPE_LABELS = {
  ...PROPERTY_TYPE_LABELS,
  'bedsit': 'Γκαρσονιέρα',
  'apartment-2br': 'Διαμέρισμα 2Δ',
  'apartment-3br': 'Διαμέρισμα 3Δ',
  'apartment-4br': 'Διαμέρισμα 4Δ+',
  // ✅ ENTERPRISE EXTENSION: Additional property types from CompactToolbar
  'loft': 'Loft',
  'penthouse': 'Penthouse'
} as const;

// ============================================================================
// 🏢 ENTERPRISE RISK & COMPLEXITY LABELS (Migrated from AdvancedFilters)
// ============================================================================

export const RISK_COMPLEXITY_LABELS = {
  'low': 'Χαμηλός',
  'medium': 'Μέτριος',
  'high': 'Υψηλός',
  'simple': 'Απλή',
  'complex': 'Πολύπλοκη',
  'very_complex': 'Πολύ πολύπλοκη'
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
export const DROPDOWN_PLACEHOLDERS = {
  // Company & Project Selection (DXF Viewer)
  SELECT_COMPANY: '-- Επιλέξτε Εταιρεία --',
  SELECT_PROJECT: '-- Επιλέξτε Έργο --',
  SELECT_BUILDING: '-- Επιλέξτε Κτίριο --',
  SELECT_UNIT: '-- Επιλέξτε Μονάδα --',

  // Contact & Client Selection
  SELECT_CLIENT: 'Επιλογή πελάτη...',
  SELECT_CONTACT: 'Επιλογή επαφής...',

  // File & Import Operations
  SELECT_FILE: 'Επιλογή αρχείου',
  SELECT_ENCODING: 'Επιλέξτε κωδικοποίηση',

  // Property & Building Selection
  SELECT_FLOOR: 'Επιλογή ορόφου...',
  SELECT_TYPE: 'Επιλογή τύπου',

  // CRM & Opportunity Management
  SELECT_STAGE: 'Επιλογή σταδίου...',

  // Generic Template (για LabeledSelect component)
  GENERIC_SELECT: 'Επιλέξτε'  // Χρησιμοποιείται ως: `${GENERIC_SELECT} ${label.toLowerCase()}`
} as const;

// 🔄 PROCESS STEP LABELS (DXF Import & Project Creation)
export const PROCESS_STEP_LABELS = {
  // Project Creation Steps
  STEP_1_COMPANY: 'Βήμα 1: Επιλογή Εταιρείας',
  STEP_2_PROJECT: 'Βήμα 2: Επιλογή Έργου',
  STEP_3_BUILDING: 'Βήμα 3: Επιλογή Κτιρίου',
  STEP_4_UNIT: 'Βήμα 4: Επιλογή Μονάδας',

  // Import Process Steps
  FILE_SELECTION: 'Επιλογή Αρχείου',
  ENCODING_SELECTION: 'Επιλογή Κωδικοποίησης',
  DESTINATION_SELECTION: 'Επιλογή Προορισμού'
} as const;

// 🏗️ DXF DESTINATION LABELS (HierarchicalDestinationSelector)
export const DXF_DESTINATION_LABELS = {
  GENERAL_PLAN: 'Γενική Κάτοψη',
  PARKING_SPOTS: 'Θέσεις Στάθμευσης',
  STORAGE_AREAS: 'Αποθήκες',
  BUILDING_PLAN: 'Κάτοψη Κτιρίου',
  UNIT_PLAN: 'Κάτοψη Μονάδας'
} as const;

// 📏 MEASUREMENT UNIT LABELS (CalibrationStep & DXF Viewer)
export const MEASUREMENT_UNIT_LABELS = {
  MILLIMETERS: 'χιλιοστά',
  CENTIMETERS: 'εκατοστά',
  METERS: 'μέτρα',
  INCHES: 'ίντσες',
  FEET: 'πόδια'
} as const;

// 🔗 RELATIONSHIP STATUS LABELS (Contact Relationships)
export const RELATIONSHIP_STATUS_LABELS = {
  ACTIVE: 'Ενεργή',
  INACTIVE: 'Αδρανής',
  PENDING: 'Εκκρεμής',
  TERMINATED: 'Τερματισμένη',
  SUSPENDED: 'Αναστολή'
} as const;

// 💼 CRM & OPPORTUNITY LABELS
export const CRM_LABELS = {
  // Opportunity stages
  LEAD: 'Προοπτική',
  PROPOSAL: 'Πρόταση',
  NEGOTIATION: 'Διαπραγμάτευση',
  CLOSING: 'Κλείσιμο',
  WON: 'Κέρδος',
  LOST: 'Απώλεια',

  // Contact types
  INDIVIDUAL: 'Φυσικό Πρόσωπο',
  COMPANY: 'Εταιρεία',
  ORGANIZATION: 'Οργανισμός'
} as const;

// 🏠 PROPERTY VIEWER LABELS (Floor Selector, Connection Controls)
export const PROPERTY_VIEWER_LABELS = {
  ALL_FLOORS: 'Όλοι οι όροφοι',
  GROUND_FLOOR: 'Ισόγειο',
  BASEMENT: 'Υπόγειο',

  // Connection types
  ELECTRICAL: 'Ηλεκτρολογικά',
  PLUMBING: 'Υδραυλικά',
  HVAC: 'Κλιματισμός',
  INTERNET: 'Διαδίκτυο',
  PHONE: 'Τηλέφωνο'
} as const;

// 🏢 STORAGE TYPE & SIZE LABELS (migrated from storageFiltersConfig.ts)
export const STORAGE_LABELS = {
  // Storage sizes
  LARGE: 'Μεγάλες',
  SMALL: 'Μικρές',

  // Storage locations
  BASEMENT_STORAGE: 'Υπόγειες',
  GROUND_STORAGE: 'Ισόγειες',
  SPECIAL_STORAGE: 'Ειδικές',

  // Building labels (generic)
  BUILDING_A: 'Κτίριο Α',
  BUILDING_B: 'Κτίριο Β',
  BUILDING_C: 'Κτίριο Γ',
  BUILDING_D: 'Κτίριο Δ',
  BUILDING_E: 'Κτίριο Ε',

  // Floor labels (detailed)
  BASEMENT_MINUS_2: 'Υπόγειο -2',
  BASEMENT_MINUS_1: 'Υπόγειο -1',
  GROUND_FLOOR: 'Ισόγειο',
  FIRST_FLOOR: '1ος Όροφος',
  SECOND_FLOOR: '2ος Όροφος',
  OTHER_FLOORS: 'Λοιπά'
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
 */
export const resolveLegacyDropdownString = (hardcodedString: string): string => {
  return (LEGACY_DROPDOWN_SUPPORT as any)[hardcodedString] || hardcodedString;
};

// ============================================================================
// 🏢 MODAL SELECT COMPREHENSIVE LABELS - ENTERPRISE MIGRATION
// ============================================================================

/**
 * Gender Options - Complete Coverage
 */
export const GENDER_LABELS = {
  male: 'Άντρας',
  female: 'Γυναίκα',
  other: 'Άλλο',
  prefer_not_to_say: 'Προτιμώ να μη το δηλώσω'
} as const;

// Note: IDENTITY_TYPE_LABELS merged with main definition above (line ~727)

/**
 * Country Labels (Common ones for Greece-focused app)
 */
export const COUNTRY_LABELS = {
  GR: 'Ελλάδα',
  CY: 'Κύπρος',
  US: 'ΗΠΑ',
  DE: 'Γερμανία',
  FR: 'Γαλλία',
  IT: 'Ιταλία',
  ES: 'Ισπανία',
  UK: 'Ηνωμένο Βασίλειο',
  AU: 'Αυστραλία',
  CA: 'Καναδάς',
  OTHER: 'Άλλη χώρα'
} as const;

/**
 * Currency Labels
 */
export const CURRENCY_LABELS = {
  EUR: 'EUR (Ευρώ)',
  USD: 'USD (Δολάρια ΗΠΑ)',
  GBP: 'GBP (Λίρες Στερλίνες)'
} as const;

// Note: ADDRESS_TYPE_LABELS merged with main definition above (line ~750)

/**
 * Shareholder Types
 */
export const SHAREHOLDER_TYPE_LABELS = {
  individual: 'Φυσικό Πρόσωπο',
  legal: 'Νομικό Πρόσωπο'
} as const;

/**
 * Document Types
 */
export const DOCUMENT_TYPE_LABELS = {
  certificate: 'Πιστοποιητικό',
  announcement: 'Ανακοίνωση',
  registration: 'Έγγραφο Σύστασης',
  amendment: 'Τροποποίηση Καταστατικού'
} as const;

/**
 * Board Types for company decisions
 */
export const BOARD_TYPE_LABELS = {
  general_assembly: 'Γενική Συνέλευση',
  board_directors: 'Διοικητικό Συμβούλιο',
  supervisory_board: 'Εποπτικό Συμβούλιο'
} as const;

/**
 * Representative Positions
 */
export const REPRESENTATIVE_POSITION_LABELS = {
  ceo: 'Διευθύνων Σύμβουλος',
  president: 'Πρόεδρος Δ.Σ.',
  manager: 'Διαχειριστής',
  legal_rep: 'Νόμιμος Εκπρόσωπος',
  secretary: 'Γραμματέας'
} as const;

/**
 * ΓΕΜΗ Status Labels
 */
export const GEMI_STATUS_LABELS = {
  active: 'Ενεργή',
  inactive: 'Ανενεργή',
  suspended: 'Αναστολή Λειτουργίας',
  dissolution: 'Σε Διαδικασία Λύσης',
  dissolved: 'Λυθείσα',
  bankruptcy: 'Σε Πτώχευση',
  liquidation: 'Υπό Εκκαθάριση'
} as const;

/**
 * Service Categories
 */
export const SERVICE_CATEGORY_LABELS = {
  ministry: 'Υπουργείο',
  region: 'Περιφέρεια',
  municipality: 'Δήμος',
  public_entity: 'Δημόσιος Οργανισμός',
  independent_authority: 'Ανεξάρτητη Αρχή',
  university: 'Πανεπιστήμιο',
  hospital: 'Νοσοκομείο',
  school: 'Εκπαιδευτικό Ίδρυμα',
  other: 'Άλλο'
} as const;

/**
 * Legal Status Labels για δημόσιες υπηρεσίες
 */
export const LEGAL_STATUS_LABELS = {
  npdd: 'Νομικό Πρόσωπο Δημοσίου Δικαίου (Ν.Π.Δ.Δ.)',
  npid: 'Νομικό Πρόσωπο Ιδιωτικού Δικαίου (Ν.Π.Ι.Δ.)',
  public_service: 'Δημόσια Υπηρεσία',
  independent_authority: 'Ανεξάρτητη Αρχή',
  decentralized_admin: 'Αποκεντρωμένη Διοίκηση'
} as const;

/**
 * Boolean Options (Yes/No)
 */
export const BOOLEAN_LABELS = {
  yes: 'Ναι',
  no: 'Όχι'
} as const;

/**
 * Encoding Options for DXF imports
 */
export const ENCODING_LABELS = {
  'windows-1253': 'Windows-1253 (Greek)',
  'UTF-8': 'UTF-8 (Προεπιλογή)',
  'windows-1252': 'Windows-1252 (Western)',
  'ISO-8859-7': 'ISO-8859-7 (Greek)'
} as const;

/**
 * Contact Business Types - για CompactToolbar configs
 */
export const CONTACT_BUSINESS_TYPE_LABELS = {
  customer: 'Πελάτες',
  supplier: 'Προμηθευτές',
  agent: 'Μεσίτες',
  contractor: 'Εργολάβοι'
} as const;

/**
 * Availability Status Labels - για CompactToolbar configs
 */
export const AVAILABILITY_STATUS_LABELS = {
  unavailable: 'Μη διαθέσιμες',
  available: 'Διαθέσιμες',
  occupied: 'Κατειλημμένες'
} as const;

/**
 * Building Name Filter Labels - για CompactToolbar configs
 */
export const BUILDING_NAME_FILTER_LABELS = {
  NAME_A_TO_Z: 'Όνομα A-Z',
  NAME_Z_TO_A: 'Όνομα Z-A',
  CONTAINS_TOWER: 'Περιέχει "Πύργο"',
  CONTAINS_COMPLEX: 'Περιέχει "Συγκρότημα"'
} as const;