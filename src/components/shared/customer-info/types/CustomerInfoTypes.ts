/**
 * 🏷️ ENTERPRISE CUSTOMER INFO TYPES
 *
 * Κεντρικοποιημένα types για το unified customer information system
 * Enterprise-class type definitions που χρησιμοποιούνται σε όλη την εφαρμογή
 *
 * @created 2025-12-14
 * @author Claude AI Assistant
 * @version 1.0.0
 */

import type { LucideIcon } from 'lucide-react';

// ============================================================================
// CORE CUSTOMER INFO TYPES
// ============================================================================

/**
 * Βασικές πληροφορίες πελάτη
 */
export interface CustomerBasicInfo {
  /** ID του contact */
  contactId: string;

  /** Εμφανιζόμενο όνομα (από getContactDisplayName) */
  displayName: string;

  /** Κύριο τηλέφωνο (από getPrimaryPhone) */
  primaryPhone: string | null;

  /** Κύριο email */
  primaryEmail: string | null;

  /** Status του contact */
  status?: string;

  /** Avatar/Profile image URL */
  avatarUrl?: string;
}

/**
 * Εκτεταμένες πληροφορίες πελάτη
 */
export interface CustomerExtendedInfo extends CustomerBasicInfo {
  /** Αριθμός μονάδων που έχει αγοράσει */
  propertiesCount: number;

  /** IDs των μονάδων που κατέχει */
  propertyIds: string[];

  /** Συνολική αξία περιουσίας */
  totalValue?: number;

  /** Επαγγελματικές πληροφορίες */
  profession?: string;

  /** Πόλη διαμονής */
  city?: string;

  /** Ημερομηνία τελευταίας επικοινωνίας */
  lastContactDate?: Date;
}

/**
 * Context types για διαφορετικές χρήσεις του component
 */
export type CustomerInfoContext =
  | 'property'  // Εμφάνιση σε property details
  | 'building'  // Εμφάνιση σε building customers list
  | 'project'   // Εμφάνιση σε project customers table
  | 'contact'   // Εμφάνιση σε contact details
  | 'dashboard' // Εμφάνιση σε dashboard widgets
  | 'search';   // Εμφάνιση σε search results

/**
 * Variant types για διαφορετικές εμφανίσεις
 */
export type CustomerInfoVariant =
  | 'full'      // Πλήρη στοιχεία με όλες τις πληροφορίες
  | 'compact'   // Συμπαγής εμφάνιση (όνομα + τηλέφωνο + actions)
  | 'minimal'   // Ελάχιστη εμφάνιση (μόνο όνομα + action)
  | 'card'      // Card layout με hover effects
  | 'inline'    // Inline εμφάνιση για tables
  | 'table';    // Table row layout με στήλες (avatar | name | phone | units | actions)

/**
 * Size variants για responsive design
 */
export type CustomerInfoSize =
  | 'sm'   // Small για mobile/compact spaces
  | 'md'   // Medium για standard desktop
  | 'lg';  // Large για emphasis/hero sections

// ============================================================================
// ACTION TYPES
// ============================================================================

/**
 * Customer action types
 */
export type CustomerActionType =
  | 'view'        // Προβολή στοιχείων πελάτη
  | 'call'        // Τηλεφωνική επικοινωνία
  | 'email'       // Email επικοινωνία
  | 'message'     // SMS ή chat message
  | 'edit'        // Επεξεργασία στοιχείων
  | 'reassign'    // Αλλαγή assignment μονάδας
  | 'history'     // Ιστορικό συναλλαγών
  | 'documents'   // Έγγραφα πελάτη
  | 'notes';      // Σημειώσεις πελάτη

/**
 * Customer action configuration
 */
export interface CustomerAction {
  /** Τύπος ενέργειας */
  type: CustomerActionType;

  /** Εμφανιζόμενη ετικέτα */
  label: string;

  /** Icon για την ενέργεια */
  icon: LucideIcon;

  /** Variant για το button styling */
  variant?: 'default' | 'outline' | 'ghost' | 'destructive' | 'secondary';

  /** Callback function */
  onClick: () => void;

  /** Αν η ενέργεια είναι disabled */
  disabled?: boolean;

  /** Loading state */
  loading?: boolean;

  /** Tooltip text */
  tooltip?: string;
}

// ============================================================================
// COMPONENT PROPS TYPES
// ============================================================================

/**
 * Base props που κληρονομούν όλα τα customer info components
 */
export interface CustomerInfoBaseProps {
  /** ID του contact */
  contactId: string;

  /** Context χρήσης του component */
  context: CustomerInfoContext;

  /** Variant εμφάνισης */
  variant?: CustomerInfoVariant;

  /** Size του component */
  size?: CustomerInfoSize;

  /** Custom CSS classes */
  className?: string;

  /** Loading state */
  loading?: boolean;

  /** Error state */
  error?: string | null;

  /** Callback για αλλαγές */
  onUpdate?: (customerInfo: CustomerExtendedInfo) => void;
}

/**
 * Props για UnifiedCustomerCard
 */
export interface UnifiedCustomerCardProps extends CustomerInfoBaseProps {
  /** Εμφάνιση units count */
  showUnitsCount?: boolean;

  /** Εμφάνιση total value */
  showTotalValue?: boolean;

  /** Custom actions */
  customActions?: CustomerAction[];

  /** Disabled actions */
  disabledActions?: CustomerActionType[];

  /** Compact mode για mobile */
  compact?: boolean;

  /** Click handler για το card */
  onClick?: () => void;

  /** Selected state */
  selected?: boolean;
}

/**
 * Props για CustomerInfoCompact
 */
export interface CustomerInfoCompactProps extends CustomerInfoBaseProps {
  /** Εμφάνιση μόνο του ονόματος */
  nameOnly?: boolean;

  /** Εμφάνιση phone number */
  showPhone?: boolean;

  /** Εμφάνιση quick actions */
  showActions?: boolean;

  /** Max width για text truncation */
  maxWidth?: number;

  /** Εμφάνιση units count (για table layout) */
  showUnitsCount?: boolean;

  /** Units count value (αν διαθέσιμο από το API) */
  propertiesCount?: number;

  /** Pre-loaded customer data (skips fetch if provided) */
  customerData?: {
    name?: string;
    displayName?: string;
    phone?: string | null;
    email?: string | null;
    primaryPhone?: string | null;
    primaryEmail?: string | null;
    avatarUrl?: string;
  };
}

/**
 * Props για CustomerActionButtons
 */
export interface CustomerActionButtonsProps {
  /** Customer information */
  customerInfo: CustomerBasicInfo;

  /** Context για τα κατάλληλα actions */
  context: CustomerInfoContext;

  /** Custom actions */
  actions?: CustomerAction[];

  /** Disabled actions */
  disabledActions?: CustomerActionType[];

  /** Button size */
  size?: 'sm' | 'md' | 'lg';

  /** Layout direction */
  direction?: 'horizontal' | 'vertical';

  /** Show only icons (no labels) */
  iconsOnly?: boolean;
}

// ============================================================================
// HOOK TYPES
// ============================================================================

/**
 * Return type για useCustomerInfo hook
 */
export interface UseCustomerInfoReturn {
  /** Customer basic info */
  customerInfo: CustomerBasicInfo | null;

  /** Extended customer info με units */
  extendedInfo: CustomerExtendedInfo | null;

  /** Loading states */
  loading: boolean;
  loadingExtended: boolean;

  /** Error states */
  error: string | null;
  extendedError: string | null;

  /** Refetch functions */
  refetch: () => Promise<void>;
  refetchExtended: () => Promise<void>;

  /** Cache invalidation */
  invalidateCache: () => void;
}

/**
 * Configuration για useCustomerInfo hook
 */
export interface UseCustomerInfoConfig {
  /** Fetch extended info αυτόματα */
  fetchExtended?: boolean;

  /** Cache timeout σε milliseconds */
  cacheTimeout?: number;

  /** Retry configuration */
  retries?: number;

  /** Enabled/disabled state */
  enabled?: boolean;

  /** Stale time για cache */
  staleTime?: number;
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

/**
 * Context-specific additional data
 */
export type ContextualData = {
  unit: {
    propertyId: string;
    buildingId?: string;
    projectId?: string;
  };
  building: {
    buildingId: string;
    projectId?: string;
  };
  project: {
    projectId: string;
  };
  contact: Record<string, never>;
  dashboard: {
    metric?: string;
    timeRange?: string;
  };
  search: {
    query?: string;
    filters?: Record<string, unknown>;
  };
};

/**
 * Theme-aware styling
 */
export interface CustomerInfoStyling {
  /** Container classes */
  container: string;

  /** Avatar classes */
  avatar: string;

  /** Name text classes */
  name: string;

  /** Secondary text classes */
  secondary: string;

  /** Action button classes */
  actions: string;

  /** Badge classes */
  badge: string;

  /** Hover effect classes */
  hover: string;
}

/**
 * Export όλων των types για clean imports
 */
export type {
  // Re-export για convenience
  LucideIcon
} from 'lucide-react';

// ============================================================================
// DEFAULT CONFIGURATIONS
// ============================================================================

/**
 * Default context actions configuration
 */
export const DEFAULT_CONTEXT_ACTIONS: Record<CustomerInfoContext, CustomerActionType[]> = {
  unit: ['view', 'call', 'email', 'reassign'],
  building: ['view', 'call', 'email', 'history'],
  project: ['view', 'call', 'email', 'history'],
  contact: ['call', 'email', 'edit', 'documents'],
  dashboard: ['view'],
  search: ['view', 'call']
} as const;

/**
 * Default variant για context
 */
export const DEFAULT_CONTEXT_VARIANT: Record<CustomerInfoContext, CustomerInfoVariant> = {
  unit: 'card',
  building: 'table',    // Νέο: table layout με 4 στήλες
  project: 'table',     // Νέο: table layout με 4 στήλες
  contact: 'full',
  dashboard: 'minimal',
  search: 'inline'
} as const;