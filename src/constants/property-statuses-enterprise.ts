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
// 🔧 EXPORT FIX: Explicit exports για hot-reload compatibility
export {
  PROPERTY_STATUS_LABELS,
  PROPERTY_STATUS_COLORS,
  DEFAULT_PROPERTY_STATUS
} from './statuses';

// ✅ FIXED: Single export for PropertyStatus as type only
export type { PropertyStatus } from './statuses';

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