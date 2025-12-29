/**
 * 🏷️ CENTRAL BADGE SYSTEM - TYPE DEFINITIONS
 *
 * Enterprise-class type definitions για unified badge system
 * Single Source of Truth για όλα τα badge types
 */

// ===== CORE BADGE TYPES =====

export type BadgeVariant =
  | 'default'
  | 'secondary'
  | 'destructive'
  | 'outline'
  | 'success'
  | 'warning'
  | 'error'
  | 'info'
  | 'purple';

export type BadgeSize = 'sm' | 'default' | 'lg';

// ===== DOMAIN DEFINITIONS =====

export type DomainType = 'PROJECT' | 'BUILDING' | 'CONTACT' | 'PROPERTY' | 'UNIT' | 'NAVIGATION' | 'OBLIGATION';

// ===== STATUS TYPE UNIONS =====

export type ProjectStatus =
  | 'planning'
  | 'in_progress'
  | 'completed'
  | 'on_hold'
  | 'cancelled'
  | 'review'
  | 'approved';

export type BuildingStatus =
  | 'available'
  | 'occupied'
  | 'maintenance'
  | 'for_sale'
  | 'for_rent'
  | 'sold'
  | 'rented'
  | 'construction'
  | 'planned';

export type ContactStatus =
  | 'active'
  | 'inactive'
  | 'pending'
  | 'blocked'
  | 'archived';

export type PropertyStatus =
  // Βασικές καταστάσεις (legacy)
  | 'available'
  | 'reserved'
  | 'sold'
  | 'pending'
  | 'withdrawn'
  | 'expired'
  // 🏨 Advanced Rental Statuses
  | 'rental-only'              // ΜΟΝΟ για ενοικίαση (δεν πωλείται ποτέ)
  | 'long-term-rental'         // Μακροχρόνια μίσθωση (1+ χρόνια)
  | 'short-term-rental'        // Βραχυχρόνια μίσθωση (AirBnb style)
  // 🔒 Advanced Reservation Statuses
  | 'reserved-pending'         // Δεσμευμένο εκκρεμή (δεν ολοκληρώθηκε)
  | 'contract-signed'          // Συμβόλαιο υπογεγραμμένο (εκκρεμή μεταβίβαση)
  | 'deposit-paid'             // Προκαταβολή δεδομένη
  // 👑 Ownership Statuses
  | 'company-owned'            // Εταιρικό (δεν είναι προς πώληση)
  | 'not-for-sale'             // Δεν είναι για πώληση (προσωπική χρήση)
  | 'family-reserved'          // Κρατημένο για οικογένεια
  // ⚡ Market Dynamics
  | 'pre-launch'               // Προ-εκκίνηση (marketing phase)
  | 'exclusive-listing'        // Αποκλειστική διάθεση
  | 'price-reduced'            // Μειωμένη τιμή
  | 'urgent-sale'              // Επείγουσα πώληση
  // 🔧 Operational Statuses
  | 'under-renovation'         // Υπό ανακαίνιση
  | 'legal-issues'             // Νομικά προβλήματα
  | 'inspection-required'      // Απαιτείται επιθεώρηση
  | 'documentation-pending'    // Εκκρεμή έγγραφα
  // Βασικά από το παλιό σύστημα για συμβατότητα
  | 'for-sale'                 // Προς πώληση
  | 'for-rent'                 // Προς ενοικίαση
  | 'rented'                   // Ενοικιασμένο
  | 'under-negotiation'        // Υπό διαπραγμάτευση
  | 'coming-soon'              // Σύντομα διαθέσιμο
  | 'landowner'                // Ιδιοκτήτης γης
  | 'off-market'               // Εκτός αγοράς
  | 'unavailable';             // Μη διαθέσιμο

export type UnitStatus =
  | 'available'
  | 'occupied'
  | 'maintenance'
  | 'reserved';

export type NavigationStatus =
  | 'no_projects'
  | 'empty'
  | 'warning'
  | 'alert'
  | 'success'
  | 'info';

export type ObligationStatus =
  | 'draft'
  | 'completed'
  | 'approved';

// ===== BADGE CONFIGURATION INTERFACE =====

export interface BadgeDefinition {
  label: string;
  variant: BadgeVariant;
  color?: string;
  backgroundColor?: string;
  icon?: string;
  size?: BadgeSize;
  className?: string;
}

export interface DomainBadgeConfig {
  [key: string]: BadgeDefinition;
}

export interface BadgeSystemConfig {
  domains: {
    PROJECT: Record<ProjectStatus, BadgeDefinition>;
    BUILDING: Record<BuildingStatus, BadgeDefinition>;
    CONTACT: Record<ContactStatus, BadgeDefinition>;
    PROPERTY: Record<PropertyStatus, BadgeDefinition>;
    UNIT: Record<UnitStatus, BadgeDefinition>;
    NAVIGATION: Record<NavigationStatus, BadgeDefinition>;
    OBLIGATION: Record<ObligationStatus, BadgeDefinition>;
  };
  common: Record<string, BadgeDefinition>;
}

// ===== FACTORY OPTIONS =====

export interface BadgeFactoryOptions {
  variant?: BadgeVariant;
  size?: BadgeSize;
  className?: string;
  showIcon?: boolean;
  customLabel?: string;
}

// ===== STATUS TRANSITION TYPES =====

export interface StatusTransitionRule {
  from: string;
  to: string[];
  permission?: string;
  validation?: (context: any) => boolean;
}

export interface DomainTransitionRules {
  [domain: string]: StatusTransitionRule[];
}

// ===== COMPONENT PROPS INTERFACES - MISSING EXPORTS =====

/**
 * Unified Badge Props - Main badge component interface
 */
export interface UnifiedBadgeProps extends BadgeFactoryOptions {
  className?: string;
}

/**
 * Project Badge Props - Project-specific badge component
 */
export interface ProjectBadgeProps extends BadgeFactoryOptions {
  projectId?: string;
  className?: string;
}

/**
 * Building Badge Props - Building-specific badge component
 */
export interface BuildingBadgeProps extends BadgeFactoryOptions {
  buildingId?: string;
  className?: string;
}

/**
 * Contact Badge Props - Contact-specific badge component
 */
export interface ContactBadgeProps extends BadgeFactoryOptions {
  contactId?: string;
  className?: string;
}

/**
 * Property Badge Props - Property-specific badge component
 */
export interface PropertyBadgeProps extends BadgeFactoryOptions {
  propertyId?: string;
  className?: string;
}

/**
 * Unit Badge Props - Unit-specific badge component
 */
export interface UnitBadgeProps extends BadgeFactoryOptions {
  unitId?: string;
  className?: string;
}

/**
 * Common Badge Props - Shared badge properties
 */
export interface CommonBadgeProps extends BadgeFactoryOptions {
  id?: string;
  className?: string;
}

/**
 * Badge Group Props - Multiple badges container
 */
export interface BadgeGroupProps {
  badges: BadgeFactoryOptions[];
  className?: string;
  orientation?: 'horizontal' | 'vertical';
  spacing?: 'sm' | 'md' | 'lg';
}