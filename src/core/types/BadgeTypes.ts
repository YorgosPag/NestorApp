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

export type DomainType = 'PROJECT' | 'BUILDING' | 'CONTACT' | 'PROPERTY' | 'UNIT' | 'NAVIGATION';

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
  | 'sold'
  | 'pending'
  | 'withdrawn'
  | 'expired'
  // 🏨 Essential Rental Statuses
  | 'long-term-rental'         // Μακροχρόνια μίσθωση (1+ χρόνια)
  | 'short-term-rental'        // Βραχυχρόνια μίσθωση (AirBnb style)
  | 'long-term-rented'         // Μισθώθηκε μακροχρόνια
  | 'short-term-rented'        // Μισθώθηκε βραχυχρόνια
  // 🔒 Essential Reservation Statuses
  | 'reserved'                 // Δεσμευμένο (από reserved-pending)
  // 👑 Role-Based Ownership Statuses
  | 'company-owned'            // Εταιρικό (δεν το πουλάει η εργολάβος)
  | 'owner-compensation'       // Αντιπαροχή (του οικοπεδούχου)
  // Essential από το παλιό σύστημα για συμβατότητα
  | 'for-sale'                 // Προς πώληση
  | 'coming-soon';             // Σύντομα διαθέσιμο

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