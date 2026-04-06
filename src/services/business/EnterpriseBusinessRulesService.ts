/**
 * 🏢 ENTERPRISE BUSINESS RULES SERVICE
 *
 * Database-driven business rules management service.
 * Replaces hardcoded business rules from src/config/company-gemi-config.ts
 *
 * Types: ./business-rules-types.ts
 * Default configs: ./business-rules-defaults.ts
 *
 * @enterprise-ready true
 * @multi-tenant true
 */

import { doc, getDoc, Firestore } from 'firebase/firestore';
import { createModuleLogger } from '@/lib/telemetry';

import type {
  LegalFormOption,
  CompanyStatusOption,
  BusinessRule,
  BusinessRulesConfiguration,
  RawLegalFormData,
  RawBusinessRuleData,
  RawAuditTrailEntry,
  CacheEntry,
  BusinessRulesCache,
} from './business-rules-types';

import { createDefaultConfiguration } from './business-rules-defaults';

// Re-export types for consumers
export type * from './business-rules-types';

const loggerService = createModuleLogger('EnterpriseBusinessRulesService');

// ============================================================================
// ENTERPRISE BUSINESS RULES SERVICE
// ============================================================================

export class EnterpriseBusinessRulesService {
  private static instance: EnterpriseBusinessRulesService;
  private cache: BusinessRulesCache;
  private initialized: boolean = false;
  private db: Firestore | null = null;

  private constructor() {
    this.cache = {
      configurations: new Map(),
      legalForms: new Map(),
      companyStatuses: new Map(),
      businessRules: new Map(),
    };
  }

  static getInstance(): EnterpriseBusinessRulesService {
    if (!EnterpriseBusinessRulesService.instance) {
      EnterpriseBusinessRulesService.instance = new EnterpriseBusinessRulesService();
    }
    return EnterpriseBusinessRulesService.instance;
  }

  async initialize(firestore: Firestore): Promise<void> {
    this.db = firestore;
    this.initialized = true;
    loggerService.info('🏢 EnterpriseBusinessRulesService initialized');
  }

  private ensureInitialized(): void {
    if (!this.initialized || !this.db) {
      throw new Error('EnterpriseBusinessRulesService not initialized. Call initialize(firestore) first.');
    }
  }

  // ============================================================================
  // CACHE MANAGEMENT
  // ============================================================================

  private isCacheValid<T>(entry: CacheEntry<T>): boolean {
    return Date.now() - entry.timestamp < entry.ttl;
  }

  private getCacheEntry<T>(cache: Map<string, CacheEntry<T>>, key: string): T | null {
    const entry = cache.get(key);
    if (entry && this.isCacheValid(entry)) {
      return entry.data;
    }
    if (entry) {
      cache.delete(key);
    }
    return null;
  }

  private setCacheEntry<T>(
    cache: Map<string, CacheEntry<T>>,
    key: string,
    data: T,
    ttlSeconds: number = 300
  ): void {
    cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttlSeconds * 1000,
      key,
    });
  }

  clearCache(): void {
    this.cache.configurations.clear();
    this.cache.legalForms.clear();
    this.cache.companyStatuses.clear();
    this.cache.businessRules.clear();
    loggerService.info('🏢 Business rules cache cleared');
  }

  // ============================================================================
  // MAIN CONFIGURATION METHODS
  // ============================================================================

  async loadBusinessRulesConfiguration(
    tenantId: string = 'default',
    jurisdiction: string = 'GR',
    environment: string = 'production'
  ): Promise<BusinessRulesConfiguration> {
    this.ensureInitialized();

    const cacheKey = `config-${tenantId}-${jurisdiction}-${environment}`;

    const cached = this.getCacheEntry(this.cache.configurations, cacheKey);
    if (cached) {
      loggerService.info(`🏢 Business rules configuration loaded from cache: ${cacheKey}`);
      return cached;
    }

    try {
      const firestore = this.db!;
      const configRef = doc(
        firestore,
        'business_rules_configurations',
        `${tenantId}-${jurisdiction}-${environment}`
      );

      const configDoc = await getDoc(configRef);

      if (configDoc.exists()) {
        const docData = configDoc.data();
        const config = {
          ...docData,
          createdAt: docData.createdAt?.toDate?.() || new Date(),
          lastUpdated: docData.lastUpdated?.toDate?.() || new Date(),
          legalForms: (docData.legalForms as RawLegalFormData[] | undefined)?.map((lf: RawLegalFormData) => ({
            ...lf,
            effectiveDate: lf.effectiveDate?.toDate?.() || new Date(),
            expiryDate: lf.expiryDate?.toDate?.() || undefined,
          })) || [],
          businessRules: (docData.businessRules as RawBusinessRuleData[] | undefined)?.map((br: RawBusinessRuleData) => ({
            ...br,
            lastReviewed: br.lastReviewed?.toDate?.() || new Date(),
            nextReview: br.nextReview?.toDate?.() || new Date(),
          })) || [],
          auditTrail: (docData.auditTrail as RawAuditTrailEntry[] | undefined)?.map((entry: RawAuditTrailEntry) => ({
            ...entry,
            timestamp: entry.timestamp?.toDate?.() || new Date(),
          })) || [],
        } as BusinessRulesConfiguration;

        this.setCacheEntry(this.cache.configurations, cacheKey, config, config.cacheSettings?.ttl || 300);

        loggerService.info(`🏢 Business rules configuration loaded from database: ${cacheKey}`);
        return config;
      } else {
        const defaultConfig = createDefaultConfiguration(tenantId, jurisdiction, environment);
        loggerService.info(`🏢 Created default business rules configuration: ${cacheKey}`);
        return defaultConfig;
      }
    } catch (error) {
      loggerService.error('❌ Failed to load business rules configuration:', error);
      return createDefaultConfiguration(tenantId, jurisdiction, environment);
    }
  }

  async getLegalForms(
    tenantId: string = 'default',
    jurisdiction: string = 'GR',
    environment: string = 'production'
  ): Promise<LegalFormOption[]> {
    const config = await this.loadBusinessRulesConfiguration(tenantId, jurisdiction, environment);

    const legalForms = config.legalForms
      .filter(lf => lf.isActive)
      .filter(lf => !lf.expiryDate || lf.expiryDate > new Date())
      .sort((a, b) => a.order - b.order);

    loggerService.info(`🏢 Retrieved ${legalForms.length} legal forms for ${jurisdiction}`);
    return legalForms;
  }

  async getCompanyStatuses(
    tenantId: string = 'default',
    jurisdiction: string = 'GR',
    environment: string = 'production'
  ): Promise<CompanyStatusOption[]> {
    const config = await this.loadBusinessRulesConfiguration(tenantId, jurisdiction, environment);

    const statuses = config.companyStatuses
      .filter(cs => cs.isActive)
      .sort((a, b) => a.order - b.order);

    loggerService.info(`🏢 Retrieved ${statuses.length} company statuses for ${jurisdiction}`);
    return statuses;
  }

  async getBusinessRules(
    category?: string,
    tenantId: string = 'default',
    jurisdiction: string = 'GR',
    environment: string = 'production'
  ): Promise<BusinessRule[]> {
    const config = await this.loadBusinessRulesConfiguration(tenantId, jurisdiction, environment);

    let rules = config.businessRules.filter(br => br.isActive);

    if (category) {
      rules = rules.filter(br => br.category === category);
    }

    rules.sort((a, b) => a.priority - b.priority);

    loggerService.info(`🏢 Retrieved ${rules.length} business rules for ${category || 'all categories'}`);
    return rules;
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  async getLegalFormsForSelect(
    tenantId?: string,
    jurisdiction?: string,
    environment?: string
  ): Promise<Array<{ value: string; label: string; description?: string }>> {
    const legalForms = await this.getLegalForms(tenantId, jurisdiction, environment);

    return legalForms.map(lf => ({
      value: lf.value,
      label: lf.label,
      description: lf.description,
    }));
  }

  async getCompanyStatusesForSelect(
    tenantId?: string,
    jurisdiction?: string,
    environment?: string
  ): Promise<Array<{ value: string; label: string; category?: string }>> {
    const statuses = await this.getCompanyStatuses(tenantId, jurisdiction, environment);

    return statuses.map(cs => ({
      value: cs.value,
      label: cs.label,
      category: cs.category,
    }));
  }

  async validateStatusTransition(
    fromStatus: string,
    toStatus: string,
    tenantId?: string,
    jurisdiction?: string,
    environment?: string
  ): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
    requiredActions: string[];
  }> {
    const statuses = await this.getCompanyStatuses(tenantId, jurisdiction, environment);
    const fromStatusConfig = statuses.find(s => s.value === fromStatus);

    if (!fromStatusConfig) {
      return {
        isValid: false,
        errors: [`Unknown source status: ${fromStatus}`],
        warnings: [],
        requiredActions: [],
      };
    }

    const isValidTransition = fromStatusConfig.allowedTransitions.includes(toStatus);
    const toStatusConfig = statuses.find(s => s.value === toStatus);

    return {
      isValid: isValidTransition,
      errors: isValidTransition ? [] : [`Invalid transition from ${fromStatus} to ${toStatus}`],
      warnings: [],
      requiredActions: toStatusConfig?.requiredActions || [],
    };
  }

  async getLegalFormRequirements(
    legalFormValue: string,
    tenantId?: string,
    jurisdiction?: string,
    environment?: string
  ): Promise<LegalFormOption | null> {
    const legalForms = await this.getLegalForms(tenantId, jurisdiction, environment);
    return legalForms.find(lf => lf.value === legalFormValue) || null;
  }

  async validateLegalFormCompliance(
    legalFormValue: string,
    companyData: {
      capitalAmount?: number;
      shareholderCount?: number;
      documents?: string[];
    },
    tenantId?: string,
    jurisdiction?: string,
    environment?: string
  ): Promise<{
    isCompliant: boolean;
    violations: string[];
    warnings: string[];
    recommendations: string[];
  }> {
    const legalForm = await this.getLegalFormRequirements(legalFormValue, tenantId, jurisdiction, environment);

    if (!legalForm) {
      return {
        isCompliant: false,
        violations: [`Unknown legal form: ${legalFormValue}`],
        warnings: [],
        recommendations: [],
      };
    }

    const violations: string[] = [];
    const warnings: string[] = [];
    const recommendations: string[] = [];

    if (companyData.capitalAmount !== undefined) {
      if (companyData.capitalAmount < legalForm.minCapital.amount) {
        violations.push(
          `Insufficient capital: ${companyData.capitalAmount} ${legalForm.minCapital.currency} < ${legalForm.minCapital.amount} ${legalForm.minCapital.currency}`
        );
      }
    }

    if (companyData.shareholderCount !== undefined) {
      if (companyData.shareholderCount < legalForm.minShareholders) {
        violations.push(`Insufficient shareholders: ${companyData.shareholderCount} < ${legalForm.minShareholders}`);
      }
      if (legalForm.maxShareholders && companyData.shareholderCount > legalForm.maxShareholders) {
        violations.push(`Too many shareholders: ${companyData.shareholderCount} > ${legalForm.maxShareholders}`);
      }
    }

    recommendations.push(...legalForm.advantages);

    return {
      isCompliant: violations.length === 0,
      violations,
      warnings,
      recommendations,
    };
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default EnterpriseBusinessRulesService;

export const businessRulesService = EnterpriseBusinessRulesService.getInstance();
