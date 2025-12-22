/**
 * ============================================================================
 * 👥 CONTACT TABS CONFIGURATION
 * ============================================================================
 *
 * Single Source of Truth για όλα τα contact tabs (Individual, Company, Service)
 * Centralized config που χρησιμοποιείται από:
 * - ContactDetails (tab rendering)
 * - Edit forms (future)
 * - Any other contact-related components
 *
 * Architecture: Config-driven με Universal Components
 * Pattern: Single Source of Truth
 *
 * 🏢 ENTERPRISE MIGRATION: Unifies all contact types under UniversalTabsRenderer
 */

import type { ContactType } from '@/types/ContactFormTypes';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface ContactTabConfig {
  /** Unique tab identifier */
  id: string;
  /** Display label */
  label: string;
  /** Tab value for Tabs component */
  value: string;
  /** Tab icon (lucide-react icon name) */
  icon: string;
  /** Tab description */
  description?: string;
  /** Display order */
  order: number;
  /** Whether tab is enabled by default */
  enabled?: boolean;
  /** Component to render for this tab */
  component?: string;
  /** Any additional props for the component */
  componentProps?: Record<string, any>;
  /** Contact types this tab applies to */
  contactTypes: ContactType[];
}

// ============================================================================
// CONTACT TABS CONFIGURATION
// ============================================================================

export const CONTACT_TABS: ContactTabConfig[] = [
  // -------------------------------------------------------------------------
  // 1. ΒΑΣΙΚΑ ΣΤΟΙΧΕΙΑ (ALL TYPES)
  // -------------------------------------------------------------------------
  {
    id: 'basicInfo',
    label: 'Βασικά Στοιχεία',
    value: 'basicInfo',
    icon: 'user',
    description: 'Βασικές πληροφορίες και στοιχεία επικοινωνίας',
    order: 1,
    enabled: true,
    component: 'ContactBasicInfoTab',
    contactTypes: ['individual', 'company', 'service'],
  },

  // -------------------------------------------------------------------------
  // 2. ΕΠΙΚΟΙΝΩΝΙΑ (ALL TYPES)
  // -------------------------------------------------------------------------
  {
    id: 'communication',
    label: 'Επικοινωνία',
    value: 'communication',
    icon: 'phone',
    description: 'Τηλέφωνα, emails, websites και social media',
    order: 2,
    enabled: true,
    component: 'ContactCommunicationTab',
    contactTypes: ['individual', 'company', 'service'],
  },

  // -------------------------------------------------------------------------
  // 3. ΠΡΟΣΩΠΙΚΑ ΣΤΟΙΧΕΙΑ (INDIVIDUAL ONLY)
  // -------------------------------------------------------------------------
  {
    id: 'personalInfo',
    label: 'Προσωπικά Στοιχεία',
    value: 'personalInfo',
    icon: 'id-card',
    description: 'Ταυτότητα, γέννηση και προσωπικές πληροφορίες',
    order: 3,
    enabled: true,
    component: 'ContactPersonalInfoTab',
    contactTypes: ['individual'],
  },

  // -------------------------------------------------------------------------
  // 4. ΕΤΑΙΡΙΚΑ ΣΤΟΙΧΕΙΑ (COMPANY ONLY)
  // -------------------------------------------------------------------------
  {
    id: 'companyInfo',
    label: 'Εταιρικά Στοιχεία',
    value: 'companyInfo',
    icon: 'building',
    description: 'ΓΕΜΗ, ΑΦΜ και εταιρικές πληροφορίες',
    order: 3,
    enabled: true,
    component: 'ContactCompanyInfoTab',
    contactTypes: ['company'],
  },

  // -------------------------------------------------------------------------
  // 5. ΥΠΗΡΕΣΙΕΣ (SERVICE ONLY)
  // -------------------------------------------------------------------------
  {
    id: 'servicesInfo',
    label: 'Υπηρεσίες',
    value: 'servicesInfo',
    icon: 'briefcase',
    description: 'Παρεχόμενες υπηρεσίες και εξειδίκευση',
    order: 3,
    enabled: true,
    component: 'ContactServicesInfoTab',
    contactTypes: ['service'],
  },

  // -------------------------------------------------------------------------
  // 6. ΔΙΕΥΘΥΝΣΕΙΣ (ALL TYPES)
  // -------------------------------------------------------------------------
  {
    id: 'addresses',
    label: 'Διευθύνσεις',
    value: 'addresses',
    icon: 'map-pin',
    description: 'Διευθύνσεις κατοικίας, εργασίας και αλληλογραφίας',
    order: 4,
    enabled: true,
    component: 'ContactAddressesTab',
    contactTypes: ['individual', 'company', 'service'],
  },

  // -------------------------------------------------------------------------
  // 7. ΣΧΕΣΕΙΣ (ALL TYPES)
  // -------------------------------------------------------------------------
  {
    id: 'relationships',
    label: 'Σχέσεις',
    value: 'relationships',
    icon: 'users',
    description: 'Συνδέσεις με άλλες επαφές και οντότητες',
    order: 5,
    enabled: true,
    component: 'ContactRelationshipsTab',
    contactTypes: ['individual', 'company', 'service'],
  },

  // -------------------------------------------------------------------------
  // 8. ΦΩΤΟΓΡΑΦΙΕΣ (ALL TYPES)
  // -------------------------------------------------------------------------
  {
    id: 'photos',
    label: 'Φωτογραφίες',
    value: 'photos',
    icon: 'camera',
    description: 'Φωτογραφίες και εικόνες επαφής',
    order: 6,
    enabled: true,
    component: 'ContactPhotosTab',
    contactTypes: ['individual', 'company', 'service'],
  },

  // -------------------------------------------------------------------------
  // 9. ΛΟΓΟΤΥΠΟ (COMPANY & SERVICE ONLY)
  // -------------------------------------------------------------------------
  {
    id: 'logo',
    label: 'Λογότυπο',
    value: 'logo',
    icon: 'image',
    description: 'Εταιρικό λογότυπο και branding',
    order: 7,
    enabled: true,
    component: 'ContactLogoTab',
    contactTypes: ['company', 'service'],
  },

  // -------------------------------------------------------------------------
  // 10. ΙΣΤΟΡΙΚΟ (ALL TYPES)
  // -------------------------------------------------------------------------
  {
    id: 'history',
    label: 'Ιστορικό',
    value: 'history',
    icon: 'clock',
    description: 'Ιστορικό αλλαγών και δραστηριότητας',
    order: 8,
    enabled: false, // Disabled by default - future feature
    component: 'ContactHistoryTab',
    contactTypes: ['individual', 'company', 'service'],
  },
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get sorted tabs for specific contact type
 */
export function getSortedContactTabs(contactType: ContactType): ContactTabConfig[] {
  return CONTACT_TABS
    .filter(tab =>
      tab.enabled !== false &&
      tab.contactTypes.includes(contactType)
    )
    .sort((a, b) => a.order - b.order);
}

/**
 * Get all contact tabs (for admin/config purposes)
 */
export function getAllContactTabs(): ContactTabConfig[] {
  return [...CONTACT_TABS].sort((a, b) => a.order - b.order);
}

/**
 * Get specific tab by ID
 */
export function getContactTabById(tabId: string): ContactTabConfig | undefined {
  return CONTACT_TABS.find(tab => tab.id === tabId);
}

/**
 * Get enabled tab count for contact type
 */
export function getEnabledContactTabsCount(contactType: ContactType): number {
  return getSortedContactTabs(contactType).length;
}

/**
 * Check if tab is enabled for contact type
 */
export function isContactTabEnabled(tabId: string, contactType: ContactType): boolean {
  const tab = getContactTabById(tabId);
  return tab
    ? tab.enabled !== false && tab.contactTypes.includes(contactType)
    : false;
}

/**
 * Get default tab for contact type (first enabled tab)
 */
export function getDefaultContactTab(contactType: ContactType): string {
  const tabs = getSortedContactTabs(contactType);
  return tabs[0]?.value || 'basicInfo';
}

// ============================================================================
// VALIDATION & DEBUG
// ============================================================================

/**
 * Validate contact tabs configuration
 */
export function validateContactTabsConfig(): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check for duplicate IDs
  const ids = CONTACT_TABS.map(tab => tab.id);
  const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
  if (duplicateIds.length > 0) {
    errors.push(`Duplicate tab IDs found: ${duplicateIds.join(', ')}`);
  }

  // Check for duplicate values
  const values = CONTACT_TABS.map(tab => tab.value);
  const duplicateValues = values.filter((value, index) => values.indexOf(value) !== index);
  if (duplicateValues.length > 0) {
    errors.push(`Duplicate tab values found: ${duplicateValues.join(', ')}`);
  }

  // Check each contact type has at least one tab
  const contactTypes: ContactType[] = ['individual', 'company', 'service'];
  for (const type of contactTypes) {
    const enabledTabs = getSortedContactTabs(type);
    if (enabledTabs.length === 0) {
      warnings.push(`Contact type "${type}" has no enabled tabs`);
    }
  }

  // Check for missing components
  const missingComponents = CONTACT_TABS.filter(tab => !tab.component);
  if (missingComponents.length > 0) {
    warnings.push(`Tabs without component: ${missingComponents.map(t => t.id).join(', ')}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// ============================================================================
// DEBUG HELPERS
// ============================================================================

/**
 * Debug: Print contact tabs configuration
 */
export function debugContactTabsConfig(): void {
  if (typeof window === 'undefined') return; // Server-side safe

  console.group('👥 Contact Tabs Configuration Debug');

  const validation = validateContactTabsConfig();
  console.log('📊 Validation:', validation);

  const contactTypes: ContactType[] = ['individual', 'company', 'service'];

  for (const type of contactTypes) {
    const tabs = getSortedContactTabs(type);
    console.group(`📋 ${type.toUpperCase()} Tabs (${tabs.length})`);

    tabs.forEach((tab, index) => {
      console.log(`${index + 1}. ${tab.label} (${tab.value}) - ${tab.component || 'NO COMPONENT'}`);
    });

    console.groupEnd();
  }

  console.groupEnd();
}

// ============================================================================
// EXPORTS
// ============================================================================

export default CONTACT_TABS;

// Enterprise-grade export object for external integrations
export const ContactTabsConfig = {
  tabs: CONTACT_TABS,
  getSortedContactTabs,
  getAllContactTabs,
  getContactTabById,
  getEnabledContactTabsCount,
  isContactTabEnabled,
  getDefaultContactTab,
  validateContactTabsConfig,
  debugContactTabsConfig,
} as const;