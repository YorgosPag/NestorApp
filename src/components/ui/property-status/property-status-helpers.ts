/**
 * 🏢 PROPERTY STATUS HELPERS
 *
 * Helper functions and types for PropertyStatusSelector
 * Extracted for SRP compliance (Google File Size Standards)
 *
 * @created 2026-03-28
 */

import { EnhancedPropertyStatus } from '@/constants/property-statuses-enterprise';

// ============================================================================
// TYPES
// ============================================================================

export interface StatusOption {
  status: EnhancedPropertyStatus;
  label: string;
  category: string;
  isAllowed: boolean;
  requiresApproval: boolean;
  description?: string;
  warning?: string;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

// 🏢 ENTERPRISE: Returns i18n key for category label
export function getCategoryKey(category: string): string {
  const keys: Record<string, string> = {
    'AVAILABLE': 'statusSelector.categories.available',
    'COMMITTED': 'statusSelector.categories.committed',
    'OFF_MARKET': 'statusSelector.categories.offMarket',
    'IN_PROCESS': 'statusSelector.categories.inProcess',
    'OTHER': 'statusSelector.categories.other'
  };
  return keys[category] || category;
}

// 🏢 ENTERPRISE: Returns i18n key for status description
export function getStatusDescriptionKey(status: EnhancedPropertyStatus): string {
  const keys: Partial<Record<EnhancedPropertyStatus, string>> = {
    'rental-only': 'statusSelector.descriptions.rentalOnly',
    'reserved-pending': 'statusSelector.descriptions.reservedPending',
    'contract-signed': 'statusSelector.descriptions.contractSigned',
    'company-owned': 'statusSelector.descriptions.companyOwned',
    'urgent-sale': 'statusSelector.descriptions.urgentSale',
    'under-renovation': 'statusSelector.descriptions.underRenovation'
  };
  return keys[status] || '';
}

// 🏢 ENTERPRISE: Returns i18n key for validation warning
export function getValidationWarningKey(
  from: EnhancedPropertyStatus,
  to: EnhancedPropertyStatus,
  userRole: string
): string {
  if (from === 'sold') {
    return 'statusSelector.warnings.soldCannotChange';
  }

  if (userRole === 'agent' && to === 'company-owned') {
    return 'statusSelector.warnings.managerApprovalRequired';
  }

  return 'statusSelector.warnings.notAllowed';
}
