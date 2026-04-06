/**
 * 🏢 Enterprise Business Rules Types & Interfaces
 *
 * All type definitions for the business rules configuration system.
 * Extracted from EnterpriseBusinessRulesService.ts (ADR-065 SRP split).
 *
 * @enterprise-ready true
 * @multi-tenant true
 */

// ============================================================================
// CORE TYPES
// ============================================================================

/** Rule logic parameters type */
export type RuleParameters = Record<string, unknown>;

/** Audit trail changes type */
export type AuditChanges = Record<string, unknown>;

/** Raw Firestore document data for legal forms */
export interface RawLegalFormData {
  effectiveDate?: { toDate?: () => Date };
  expiryDate?: { toDate?: () => Date };
  [key: string]: unknown;
}

/** Raw Firestore document data for business rules */
export interface RawBusinessRuleData {
  lastReviewed?: { toDate?: () => Date };
  nextReview?: { toDate?: () => Date };
  [key: string]: unknown;
}

/** Raw Firestore document data for audit trail */
export interface RawAuditTrailEntry {
  timestamp?: { toDate?: () => Date };
  [key: string]: unknown;
}

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * Legal form option for company registration
 */
export interface LegalFormOption {
  value: string;
  label: string;
  fullName: string;
  description: string;
  jurisdiction: string;
  minCapital: {
    amount: number;
    currency: string;
  };
  maxShareholders?: number;
  minShareholders: number;
  liabilityType: 'limited' | 'unlimited' | 'mixed';
  requirements: string[];
  taxImplications: string[];
  registrationAuthorities: string[];
  requiredDocuments: string[];
  useCases: string[];
  advantages: string[];
  disadvantages: string[];
  order: number;
  isActive: boolean;
  effectiveDate: Date;
  expiryDate?: Date;
}

/**
 * Company status option with workflow support
 */
export interface CompanyStatusOption {
  value: string;
  label: string;
  description: string;
  category: 'operational' | 'suspended' | 'terminated' | 'legal-process';
  businessImpact: 'none' | 'limited' | 'restricted' | 'prohibited';
  legalImplications: string[];
  requiredActions: string[];
  allowedTransitions: string[];
  autoTransitionRules?: Array<{
    condition: string;
    targetStatus: string;
    delayDays: number;
  }>;
  notificationRequirements: string[];
  reportingObligations: string[];
  order: number;
  isActive: boolean;
  workflow?: {
    canTransitionTo: string[];
    requiresApproval: boolean;
    autoReasons: string[];
  };
}

/**
 * Business rule definition
 */
export interface BusinessRule {
  id: string;
  name: string;
  category: 'legal-form' | 'company-status' | 'compliance' | 'taxation' | 'governance';
  ruleType: 'validation' | 'workflow' | 'notification' | 'calculation' | 'restriction';
  description: string;
  jurisdictions: string[];
  applicableLegalForms: string[];
  applicableStatuses: string[];
  logic: {
    condition: string;
    action: string;
    parameters: RuleParameters;
  };
  priority: number;
  enforcement: 'mandatory' | 'recommended' | 'informational';
  errorMessage: string;
  warningMessage?: string;
  helpText?: string;
  legalReferences: string[];
  lastReviewed: Date;
  nextReview: Date;
  isActive: boolean;
}

/**
 * Business rules configuration per tenant/jurisdiction
 */
export interface BusinessRulesConfiguration {
  configId: string;
  version: string;
  tenantId: string;
  primaryJurisdiction: string;
  secondaryJurisdictions: string[];
  environment: string;
  legalForms: LegalFormOption[];
  companyStatuses: CompanyStatusOption[];
  businessRules: BusinessRule[];
  complianceSettings: {
    strictValidation: boolean;
    autoApplyRules: boolean;
    enableAuditTrail: boolean;
    auditRetentionDays: number;
    notifications: {
      ruleViolations: boolean;
      statusChanges: boolean;
      complianceDeadlines: boolean;
    };
  };
  localizationSettings: {
    primaryLanguage: string;
    secondaryLanguages: string[];
    dateFormat: string;
    numberFormat: string;
    currencyFormat: string;
  };
  integrationSettings: {
    externalLegalDb?: string;
    governmentRegistry?: string;
    taxAuthority?: string;
    chamberOfCommerce?: string;
  };
  cacheSettings: {
    ttl: number;
    autoRefresh: boolean;
    refreshInterval: number;
  };
  createdAt: Date;
  lastUpdated: Date;
  updatedBy: string;
  auditTrail: Array<{
    action: string;
    userId: string;
    timestamp: Date;
    changes: AuditChanges;
  }>;
}

// ============================================================================
// CACHE INTERFACES
// ============================================================================

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  key: string;
}

export interface BusinessRulesCache {
  configurations: Map<string, CacheEntry<BusinessRulesConfiguration>>;
  legalForms: Map<string, CacheEntry<LegalFormOption[]>>;
  companyStatuses: Map<string, CacheEntry<CompanyStatusOption[]>>;
  businessRules: Map<string, CacheEntry<BusinessRule[]>>;
}
