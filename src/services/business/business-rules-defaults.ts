/**
 * 🏢 Enterprise Business Rules Default Configurations
 *
 * Default/fallback configuration factory and centralized data converters.
 * Extracted from EnterpriseBusinessRulesService.ts (ADR-065 SRP split).
 *
 * Uses centralized legal forms from modal-select — NO hardcoded duplicates.
 *
 * @enterprise-ready true
 * @config-data true
 */

import { getLegalFormOptions, getGemiStatusOptions } from '@/subapps/dxf-viewer/config/modal-select';
import type {
  LegalFormOption,
  CompanyStatusOption,
  BusinessRulesConfiguration,
} from './business-rules-types';

// ============================================================================
// CENTRALIZED DATA CONVERTERS
// ============================================================================

/**
 * Convert centralized legal forms to service format.
 * Eliminates hardcoded duplicates — uses SSoT from modal-select.
 */
export function getCentralizedLegalForms(): LegalFormOption[] {
  const centralizedForms = getLegalFormOptions();

  return centralizedForms.map(form => ({
    value: form.value.toUpperCase(),
    label: form.label,
    fullName: form.label.match(/\((.*?)\)/)?.[1] || form.label,
    description: form.label,
    jurisdiction: 'GR',
    minCapital: { amount: 0, currency: 'EUR' },
    minShareholders: form.value === 'ae' ? 1 : 2,
    maxShareholders: form.value === 'ae' ? undefined : 50,
    liabilityType: form.value === 'ae' ? 'limited' : 'unlimited',
    requirements: [],
    taxImplications: [],
    registrationAuthorities: [],
    requiredDocuments: [],
    useCases: [],
    advantages: [],
    disadvantages: [],
    order: centralizedForms.indexOf(form) + 1,
    isActive: true,
    effectiveDate: new Date(),
  }));
}

/**
 * Convert centralized GEMI statuses to service format.
 * Eliminates hardcoded duplicates — uses SSoT from modal-select.
 */
export function getCentralizedCompanyStatuses(): CompanyStatusOption[] {
  const centralizedStatuses = getGemiStatusOptions();

  return centralizedStatuses.map(status => ({
    value: status.value,
    label: status.label,
    description: status.label,
    category: 'operational' as const,
    businessImpact: status.value === 'active' ? 'none' as const : 'limited' as const,
    legalImplications: [],
    requiredActions: [],
    allowedTransitions: [],
    notificationRequirements: [],
    reportingObligations: [],
    order: centralizedStatuses.indexOf(status) + 1,
    isActive: status.value === 'active',
    workflow: {
      canTransitionTo: status.value === 'active' ? ['inactive', 'dissolved'] : [],
      requiresApproval: status.value === 'dissolved',
      autoReasons: [],
    },
  }));
}

// ============================================================================
// DEFAULT CONFIGURATION FACTORY
// ============================================================================

/**
 * Create default business rules configuration (fallback when DB unavailable)
 */
export function createDefaultConfiguration(
  tenantId: string,
  jurisdiction: string,
  environment: string
): BusinessRulesConfiguration {
  return {
    configId: `business-rules-${tenantId}-${jurisdiction}-${environment}`,
    version: '1.0.0',
    tenantId,
    primaryJurisdiction: jurisdiction,
    secondaryJurisdictions: [],
    environment,
    legalForms: getCentralizedLegalForms(),
    companyStatuses: getCentralizedCompanyStatuses(),
    businessRules: [],
    complianceSettings: {
      strictValidation: true,
      autoApplyRules: true,
      enableAuditTrail: true,
      auditRetentionDays: 365,
      notifications: {
        ruleViolations: true,
        statusChanges: true,
        complianceDeadlines: true,
      },
    },
    localizationSettings: {
      primaryLanguage: 'el',
      secondaryLanguages: ['en'],
      dateFormat: 'DD/MM/YYYY',
      numberFormat: '1.234,56',
      currencyFormat: '€ 1.234,56',
    },
    integrationSettings: {},
    cacheSettings: {
      ttl: 300,
      autoRefresh: true,
      refreshInterval: 3600,
    },
    createdAt: new Date(),
    lastUpdated: new Date(),
    updatedBy: 'system-default',
    auditTrail: [{
      action: 'created_default',
      userId: 'system',
      timestamp: new Date(),
      changes: { reason: 'Default configuration created' },
    }],
  };
}
