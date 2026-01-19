/**
 * CRM Dashboard Tabs Configuration - Single Source of Truth
 *
 * Enterprise-class centralized configuration για τις καρτέλες του CRM Dashboard.
 * Χρησιμοποιεί το ίδιο architecture pattern με τις καρτέλες επαφών, έργων, κτιρίων και μονάδων.
 *
 * @author Claude AI Assistant
 * @created 2024-11-28
 * @version 1.0.0
 */

import { LucideIcon } from 'lucide-react';

// ============================================================================
// INTERFACES & TYPES
// ============================================================================

/**
 * Interface για τη διαμόρφωση μίας καρτέλας CRM Dashboard
 */
export interface CRMDashboardTabConfig {
  /** Unique identifier για την καρτέλα */
  id: string;

  /** Εμφανιζόμενη ετικέτα */
  label: string;

  /** Τιμή για το Tab value */
  value: string;

  /** Icon για την καρτέλα (emoji string) */
  icon: string;

  /** Περιγραφή της καρτέλας (για documentation) */
  description?: string;

  /** Σειρά εμφάνισης */
  order: number;

  /** Αν η καρτέλα είναι ενεργή */
  enabled: boolean;

  /** Το component που θα render-αρει */
  component: string;

  /** Custom props για το component */
  componentProps?: Record<string, any>;

  /** Permissions required για την καρτέλα */
  requiredPermissions?: string[];

  /** Feature flags */
  featureFlag?: string;

  /** Conditional rendering logic */
  condition?: string;
}

// ============================================================================
// CRM DASHBOARD TABS CONFIGURATION
// ============================================================================

/**
 * Κεντρική διαμόρφωση όλων των καρτελών CRM Dashboard
 *
 * ΣΗΜΑΝΤΙΚΟ: Αυτή είναι η ΜΟΝΑΔΙΚΗ πηγή αλήθειας για τις καρτέλες CRM Dashboard!
 * Οποιαδήποτε αλλαγή στις καρτέλες πρέπει να γίνεται ΕΔΩ και μόνο εδώ.
 *
 * 🌐 i18n: All labels converted to i18n keys - 2026-01-18
 * Labels are translated at runtime by components using useTranslation
 */
export const CRM_DASHBOARD_TABS: CRMDashboardTabConfig[] = [
  {
    id: 'overview',
    label: 'crm.tabs.overview.label',
    value: 'overview',
    icon: 'trending-up',
    description: 'crm.tabs.overview.description',
    order: 1,
    enabled: true,
    component: 'OverviewTab',
  },
  {
    id: 'pipeline',
    label: 'crm.tabs.pipeline.label',
    value: 'pipeline',
    icon: 'target',
    description: 'crm.tabs.pipeline.description',
    order: 2,
    enabled: true,
    component: 'PipelineTab',
  },
  {
    id: 'contacts',
    label: 'crm.tabs.contacts.label',
    value: 'contacts',
    icon: 'users',
    description: 'crm.tabs.contacts.description',
    order: 3,
    enabled: true,
    component: 'ContactsTab',
  },
  {
    id: 'communications',
    label: 'crm.tabs.communications.label',
    value: 'communications',
    icon: 'message-circle',
    description: 'crm.tabs.communications.description',
    order: 4,
    enabled: true,
    component: 'CommunicationsTab',
  },
  {
    id: 'tasks',
    label: 'crm.tabs.tasks.label',
    value: 'tasks',
    icon: '⏰',
    description: 'crm.tabs.tasks.description',
    order: 5,
    enabled: true,
    component: 'TasksTab',
  },
  {
    id: 'calendar',
    label: 'crm.tabs.calendar.label',
    value: 'calendar',
    icon: 'calendar',
    description: 'crm.tabs.calendar.description',
    order: 6,
    enabled: true,
    component: 'CalendarTab',
  }
];

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Επιστρέφει όλες τις ενεργές καρτέλες ταξινομημένες κατά order
 */
export function getSortedCRMDashboardTabs(): CRMDashboardTabConfig[] {
  return CRM_DASHBOARD_TABS
    .filter(tab => tab.enabled)
    .sort((a, b) => a.order - b.order);
}

/**
 * Επιστρέφει μόνο τις enabled καρτέλες
 */
export function getEnabledCRMDashboardTabs(): CRMDashboardTabConfig[] {
  return CRM_DASHBOARD_TABS.filter(tab => tab.enabled);
}

/**
 * Βρίσκει μία καρτέλα με βάση το ID
 */
export function getCRMDashboardTabById(id: string): CRMDashboardTabConfig | undefined {
  return CRM_DASHBOARD_TABS.find(tab => tab.id === id);
}

/**
 * Βρίσκει μία καρτέλα με βάση το value
 */
export function getCRMDashboardTabByValue(value: string): CRMDashboardTabConfig | undefined {
  return CRM_DASHBOARD_TABS.find(tab => tab.value === value);
}

/**
 * Επιστρέφει όλες τις διαθέσιμες καρτέλες (enabled/disabled)
 */
export function getAllCRMDashboardTabs(): CRMDashboardTabConfig[] {
  return [...CRM_DASHBOARD_TABS];
}

/**
 * Επιστρέφει καρτέλες που ταιριάζουν σε συγκεκριμένα criteria
 */
export function getCRMDashboardTabsByCondition(
  predicate: (tab: CRMDashboardTabConfig) => boolean
): CRMDashboardTabConfig[] {
  return CRM_DASHBOARD_TABS.filter(predicate);
}

/**
 * Επιστρέφει στατιστικά των καρτελών
 */
export function getCRMDashboardTabsStats() {
  const all = CRM_DASHBOARD_TABS;
  const enabled = getEnabledCRMDashboardTabs();

  return {
    total: all.length,
    enabled: enabled.length,
    disabled: all.length - enabled.length,
    components: [...new Set(all.map(tab => tab.component))],
    icons: [...new Set(all.map(tab => tab.icon))],
  };
}

// ============================================================================
// VALIDATION UTILITIES
// ============================================================================

/**
 * Ελέγχει αν όλες οι καρτέλες έχουν μοναδικά IDs
 */
export function validateCRMDashboardTabIds(): boolean {
  const ids = CRM_DASHBOARD_TABS.map(tab => tab.id);
  return ids.length === new Set(ids).size;
}

/**
 * Ελέγχει αν όλες οι καρτέλες έχουν μοναδικά values
 */
export function validateCRMDashboardTabValues(): boolean {
  const values = CRM_DASHBOARD_TABS.map(tab => tab.value);
  return values.length === new Set(values).size;
}

/**
 * Ελέγχει αν όλες οι καρτέλες έχουν μοναδικά orders
 */
export function validateCRMDashboardTabOrders(): boolean {
  const orders = CRM_DASHBOARD_TABS.map(tab => tab.order);
  return orders.length === new Set(orders).size;
}

/**
 * Comprehensive validation όλων των καρτελών
 */
export function validateCRMDashboardTabsConfiguration(): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!validateCRMDashboardTabIds()) {
    errors.push('Duplicate tab IDs found');
  }

  if (!validateCRMDashboardTabValues()) {
    errors.push('Duplicate tab values found');
  }

  if (!validateCRMDashboardTabOrders()) {
    errors.push('Duplicate tab orders found');
  }

  // Έλεγχος για κενά required fields
  CRM_DASHBOARD_TABS.forEach((tab, index) => {
    if (!tab.id) errors.push(`Tab at index ${index} has no ID`);
    if (!tab.label) errors.push(`Tab at index ${index} has no label`);
    if (!tab.value) errors.push(`Tab at index ${index} has no value`);
    if (!tab.component) errors.push(`Tab at index ${index} has no component`);
  });

  return {
    valid: errors.length === 0,
    errors
  };
}

// ============================================================================
// DEVELOPMENT HELPERS
// ============================================================================

/**
 * Development helper για debugging
 */
export function debugCRMDashboardTabs(): void {
  if (process.env.NODE_ENV === 'development') {
    console.group('💼 CRM Dashboard Tabs Configuration Debug');
    console.log('📊 Stats:', getCRMDashboardTabsStats());
    console.log('✅ Validation:', validateCRMDashboardTabsConfiguration());
    console.log('📋 Enabled tabs:', getEnabledCRMDashboardTabs().map(t => t.label));
    console.log('🎯 All tabs:', CRM_DASHBOARD_TABS.length);
    console.groupEnd();
  }
}

// Development debug (μόνο στο development)
if (process.env.NODE_ENV === 'development') {
  debugCRMDashboardTabs();
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  tabs: CRM_DASHBOARD_TABS,
  getSorted: getSortedCRMDashboardTabs,
  getEnabled: getEnabledCRMDashboardTabs,
  getById: getCRMDashboardTabById,
  getByValue: getCRMDashboardTabByValue,
  getAll: getAllCRMDashboardTabs,
  getByCondition: getCRMDashboardTabsByCondition,
  getStats: getCRMDashboardTabsStats,
  validate: validateCRMDashboardTabsConfiguration,
  debug: debugCRMDashboardTabs,
};