/**
 * 🏢 ENTERPRISE PROPERTY STATUS SYSTEM
 *
 * Enterprise-class κεντρικοποιημένο σύστημα διαχείρισης καταστάσεων ακινήτων
 * Βασίζεται στο υπάρχον statuses.ts με πλήρη backward compatibility
 *
 * @created 2025-12-14
 * @author Claude AI Assistant
 * @version 1.0.0
 * @enterprise Production-ready status management system
 */

import {
  PropertyStatus,
  PROPERTY_STATUS_LABELS,
  PROPERTY_STATUS_COLORS,
  DEFAULT_PROPERTY_STATUS
} from './statuses';

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
  // 🏨 ESSENTIAL RENTAL STATUSES
  | 'long-term-rental'         // Μακροχρόνια μίσθωση (1+ χρόνια)
  | 'short-term-rental'        // Βραχυχρόνια μίσθωση (AirBnb style)
  | 'long-term-rented'         // Μισθώθηκε μακροχρόνια
  | 'short-term-rented';       // Μισθώθηκε βραχυχρόνια

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

// ============================================================================
// ROLE-BASED STATUS LABELS SYSTEM
// ============================================================================

/**
 * 🏷️ ENHANCED STATUS LABELS - INTERNAL VIEW
 *
 * Ελληνικές ετικέτες για εσωτερικούς χρήστες (πλήρη πληροφορία)
 * Επεκτείνει τα υπάρχοντα PROPERTY_STATUS_LABELS με πλήρη συμβατότητα
 */
export const ENHANCED_STATUS_LABELS: Record<EnhancedPropertyStatus, string> = {
  // Βασικές καταστάσεις (από υπάρχον σύστημα)
  ...PROPERTY_STATUS_LABELS,

  // 🏨 Essential Rental Statuses
  'long-term-rental': 'Μακροχρόνια Μίσθωση',
  'short-term-rental': 'Βραχυχρόνια Μίσθωση',
  'long-term-rented': 'Μισθώθηκε Μακροχρόνια',
  'short-term-rented': 'Μισθώθηκε Βραχυχρόνια',
};

/**
 * 🌐 PUBLIC STATUS LABELS - EXTERNAL VIEW
 *
 * Ετικέτες για δημόσια εμφάνιση (επισκέπτες ιστοσελίδας)
 * Κρύπτει ευαίσθητες πληροφορίες ιδιοκτησίας
 */
export const PUBLIC_STATUS_LABELS: Record<EnhancedPropertyStatus, string> = {
  // Βασικές καταστάσεις (ίδιες για όλους)
  ...ENHANCED_STATUS_LABELS,

  // 👑 Role-Based Ownership Statuses (masked για επισκέπτες)
  'company-owned': 'Μη Διαθέσιμο',        // Κρύβει ότι είναι εταιρικό
  'owner-compensation': 'Μη Διαθέσιμο',   // Κρύβει ότι είναι αντιπαροχή
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

  // 🏨 Essential Rental Colors (Blue variants)
  'long-term-rental': 'hsl(var(--status-info))',
  'short-term-rental': 'hsl(var(--status-info-light))',
  'long-term-rented': 'hsl(var(--status-purple))',
  'short-term-rented': 'hsl(var(--status-purple-light))',
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
    'for-sale', 'long-term-rental', 'short-term-rental', 'coming-soon'
  ] as EnhancedPropertyStatus[],

  // Δεσμευμένα/Πωλημένα
  COMMITTED: [
    'sold', 'long-term-rented', 'short-term-rented', 'reserved'
  ] as EnhancedPropertyStatus[],

  // Εκτός αγοράς (Role-based ownership)
  OFF_MARKET: [
    'company-owned', 'owner-compensation'
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
 *
 * @deprecated Since we removed the IN_PROCESS category entirely,
 * this function now always returns false. Keeping for backward compatibility.
 */
export function hasPropertyIssues(status: EnhancedPropertyStatus): boolean {
  return false; // IN_PROCESS category was removed completely
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
// ROLE-BASED DISPLAY SYSTEM
// ============================================================================

/**
 * 🧑‍💼 User Role για role-based display
 */
export type UserRole = 'internal' | 'public';

/**
 * 🎭 Get role-based status label
 *
 * Επιστρέφει το κατάλληλο label ανάλογα με το role του χρήστη:
 * - internal: Πλήρης πληροφορία (Εταιρικό, Αντιπαροχή)
 * - public: Κρυμμένη πληροφορία (Μη Διαθέσιμο)
 */
export function getRoleBasedStatusLabel(status: EnhancedPropertyStatus, userRole: UserRole = 'public'): string {
  if (userRole === 'internal') {
    return ENHANCED_STATUS_LABELS[status];
  } else {
    return PUBLIC_STATUS_LABELS[status];
  }
}

/**
 * 🔐 Check if status contains sensitive ownership info
 */
export function isSensitiveOwnershipStatus(status: EnhancedPropertyStatus): boolean {
  return status === 'company-owned' || status === 'owner-compensation';
}

/**
 * 🏢 Check if status is company owned
 */
export function isCompanyOwned(status: EnhancedPropertyStatus): boolean {
  return status === 'company-owned';
}

/**
 * 🤝 Check if status is owner compensation
 */
export function isOwnerCompensation(status: EnhancedPropertyStatus): boolean {
  return status === 'owner-compensation';
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
export {
  PropertyStatus,
  PROPERTY_STATUS_LABELS,
  PROPERTY_STATUS_COLORS,
  DEFAULT_PROPERTY_STATUS
} from './statuses';

// Enhanced versions που δεδουλεύουν με και BasicPropertyStatus και Enhanced
export const getStatusLabel = getEnhancedStatusLabel;
export const getStatusColor = getEnhancedStatusColor;

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  // Labels & Colors
  ENHANCED_STATUS_LABELS,
  PUBLIC_STATUS_LABELS,
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

  // Role-Based Functions
  getRoleBasedStatusLabel,
  isSensitiveOwnershipStatus,
  isCompanyOwned,
  isOwnerCompensation,
};