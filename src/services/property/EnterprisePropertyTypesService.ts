/**
 * 🏠 ENTERPRISE PROPERTY TYPES SERVICE
 *
 * Database-driven property types management service.
 * Replaces hardcoded property types from src/features/property-grid/constants.ts
 *
 * Provides enterprise-grade property type management with:
 * - Multi-locale support (Greek, English, etc.)
 * - Tenant-specific property types
 * - Market-specific configurations (residential, commercial, industrial)
 * - Regulatory compliance per jurisdiction
 * - Smart caching with TTL invalidation
 * - Property classification hierarchies
 * - Dynamic validation rules per property type
 *
 * @enterprise-ready true
 * @multi-tenant true
 * @gdpr-compliant true
 * @version 1.0.0
 * @created 2025-12-16
 */

import {
  collection,
  doc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  DocumentSnapshot,
  QuerySnapshot,
  DocumentData
} from 'firebase/firestore';
import { PROPERTY_FILTER_LABELS } from '@/constants/property-statuses-enterprise';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

/**
 * Property type option for dropdowns and selectors
 */
export interface PropertyTypeOption {
  /** Unique identifier for the property type */
  value: string;
  /** Display label (localized) */
  label: string;
  /** Category for grouping (residential, commercial, industrial) */
  category: 'residential' | 'commercial' | 'industrial' | 'special' | 'mixed';
  /** Icon identifier */
  icon?: string;
  /** Description for tooltips */
  description?: string;
  /** Minimum area in square meters */
  minArea?: number;
  /** Maximum area in square meters */
  maxArea?: number;
  /** Typical characteristics */
  characteristics?: string[];
  /** Market classification */
  marketClass?: 'luxury' | 'standard' | 'budget' | 'social';
  /** Regulatory requirements */
  regulations?: string[];
  /** Sort order */
  order: number;
  /** Active status */
  isActive: boolean;
}

/**
 * Property type classification with hierarchy
 */
export interface PropertyTypeClassification {
  /** Classification ID */
  id: string;
  /** Classification name */
  name: string;
  /** Parent classification ID */
  parentId: string | null;
  /** Child classification IDs */
  childIds: string[];
  /** Classification level (0 = root, 1 = category, 2 = subcategory) */
  level: number;
  /** Description */
  description?: string;
  /** Legal requirements */
  legalRequirements?: string[];
  /** Tax implications */
  taxCategory?: string;
  /** Insurance category */
  insuranceCategory?: string;
  /** Property types in this classification */
  propertyTypeIds: string[];
}

/**
 * Property type validation rule
 */
export interface PropertyTypeValidationRule {
  /** Rule ID */
  id: string;
  /** Property type ID */
  propertyTypeId: string;
  /** Rule type */
  ruleType: 'area' | 'rooms' | 'floors' | 'features' | 'location' | 'custom';
  /** Field name to validate */
  fieldName: string;
  /** Validation operator */
  operator: 'min' | 'max' | 'equals' | 'in' | 'regex' | 'custom';
  /** Expected value */
  value: unknown;
  /** Error message (localized) */
  errorMessage: string;
  /** Warning message (optional) */
  warningMessage?: string;
  /** Is this rule mandatory */
  isMandatory: boolean;
  /** Rule priority */
  priority: number;
}

/**
 * Property types configuration per tenant/locale
 */
export interface PropertyTypesConfiguration {
  /** Configuration ID */
  configId: string;
  /** Configuration version */
  version: string;
  /** Tenant/Organization ID */
  tenantId: string;
  /** Locale code (el, en, etc.) */
  locale: string;
  /** Environment (production, staging, development) */
  environment: string;
  /** Property types list */
  propertyTypes: PropertyTypeOption[];
  /** Classification hierarchy */
  classifications: PropertyTypeClassification[];
  /** Validation rules */
  validationRules: PropertyTypeValidationRule[];
  /** Market-specific settings */
  marketSettings: {
    /** Primary market type */
    primaryMarket: 'residential' | 'commercial' | 'mixed';
    /** Enable luxury properties */
    enableLuxury: boolean;
    /** Enable industrial properties */
    enableIndustrial: boolean;
    /** Enable special properties (churches, schools, etc.) */
    enableSpecial: boolean;
    /** Default property type */
    defaultPropertyType: string;
    /** Require area validation */
    requireAreaValidation: boolean;
    /** Currency for pricing */
    currency: string;
    /** Area unit (sqm, sqft, etc.) */
    areaUnit: 'sqm' | 'sqft' | 'hectare';
  };
  /** Display settings */
  displaySettings: {
    /** Show property type icons */
    showIcons: boolean;
    /** Show categories in groups */
    groupByCategory: boolean;
    /** Show descriptions */
    showDescriptions: boolean;
    /** Default view mode */
    defaultView: 'dropdown' | 'grid' | 'list';
    /** Max items per page */
    pageSize: number;
    /** Show characteristics */
    showCharacteristics: boolean;
  };
  /** Cache settings */
  cacheSettings: {
    /** Cache TTL in seconds */
    ttl: number;
    /** Auto-refresh enabled */
    autoRefresh: boolean;
    /** Refresh interval in seconds */
    refreshInterval: number;
  };
  /** Creation metadata */
  createdAt: Date;
  /** Last update metadata */
  lastUpdated: Date;
  /** Updated by user */
  updatedBy: string;
  /** Audit trail */
  auditTrail: Array<{
    action: string;
    userId: string;
    timestamp: Date;
    changes: Record<string, unknown>;
  }>;
}

// ============================================================================
// CACHE INTERFACES
// ============================================================================

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  key: string;
}

interface PropertyTypeCache {
  configurations: Map<string, CacheEntry<PropertyTypesConfiguration>>;
  propertyTypes: Map<string, CacheEntry<PropertyTypeOption[]>>;
  classifications: Map<string, CacheEntry<PropertyTypeClassification[]>>;
  validationRules: Map<string, CacheEntry<PropertyTypeValidationRule[]>>;
}

// ============================================================================
// ENTERPRISE PROPERTY TYPES SERVICE
// ============================================================================

/**
 * Enterprise Property Types Service
 * Singleton service για διαχείριση property types από database
 */
export class EnterprisePropertyTypesService {
  private static instance: EnterprisePropertyTypesService;
  private cache: PropertyTypeCache;
  private initialized: boolean = false;
  private db: ReturnType<typeof import('firebase/firestore').getFirestore> | null = null;

  private constructor() {
    this.cache = {
      configurations: new Map(),
      propertyTypes: new Map(),
      classifications: new Map(),
      validationRules: new Map()
    };
  }

  /**
   * Get singleton instance
   */
  static getInstance(): EnterprisePropertyTypesService {
    if (!EnterprisePropertyTypesService.instance) {
      EnterprisePropertyTypesService.instance = new EnterprisePropertyTypesService();
    }
    return EnterprisePropertyTypesService.instance;
  }

  /**
   * Initialize service with Firestore instance
   */
  async initialize(firestore: ReturnType<typeof import('firebase/firestore').getFirestore>): Promise<void> {
    this.db = firestore;
    this.initialized = true;
    console.log('🏠 EnterprisePropertyTypesService initialized');
  }

  /**
   * Ensure service is initialized
   */
  private ensureInitialized(): void {
    if (!this.initialized || !this.db) {
      throw new Error('EnterprisePropertyTypesService not initialized. Call initialize(firestore) first.');
    }
  }

  // ============================================================================
  // CACHE MANAGEMENT
  // ============================================================================

  /**
   * Check if cache entry is valid
   */
  private isCacheValid<T>(entry: CacheEntry<T>): boolean {
    return Date.now() - entry.timestamp < entry.ttl;
  }

  /**
   * Get cache entry if valid
   */
  private getCacheEntry<T>(cache: Map<string, CacheEntry<T>>, key: string): T | null {
    const entry = cache.get(key);
    if (entry && this.isCacheValid(entry)) {
      return entry.data;
    }
    if (entry) {
      cache.delete(key); // Remove expired entry
    }
    return null;
  }

  /**
   * Set cache entry with TTL
   */
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
      key
    });
  }

  /**
   * Clear all cache entries
   */
  clearCache(): void {
    this.cache.configurations.clear();
    this.cache.propertyTypes.clear();
    this.cache.classifications.clear();
    this.cache.validationRules.clear();
    console.log('🏠 Property types cache cleared');
  }

  // ============================================================================
  // MAIN CONFIGURATION METHODS
  // ============================================================================

  /**
   * Load property types configuration from database
   */
  async loadPropertyTypesConfiguration(
    tenantId: string = 'default',
    locale: string = 'el',
    environment: string = 'production'
  ): Promise<PropertyTypesConfiguration> {
    this.ensureInitialized();

    const cacheKey = `config-${tenantId}-${locale}-${environment}`;

    // Check cache first
    const cached = this.getCacheEntry(this.cache.configurations, cacheKey);
    if (cached) {
      console.log(`🏠 Property types configuration loaded from cache: ${cacheKey}`);
      return cached;
    }

    try {
      // Query database for configuration
      const firestore = this.db!;
      const configRef = doc(
        firestore,
        'property_types_configurations',
        `${tenantId}-${locale}-${environment}`
      );

      const configDoc = await getDoc(configRef);

      if (configDoc.exists()) {
        const config = {
          ...configDoc.data(),
          createdAt: configDoc.data().createdAt?.toDate?.() || new Date(),
          lastUpdated: configDoc.data().lastUpdated?.toDate?.() || new Date(),
          auditTrail: configDoc.data().auditTrail?.map((entry: { action?: string; userId?: string; timestamp?: { toDate?: () => Date }; changes?: Record<string, unknown> }) => ({
            ...entry,
            timestamp: entry.timestamp?.toDate?.() || new Date()
          })) || []
        } as PropertyTypesConfiguration;

        // Cache the configuration
        this.setCacheEntry(this.cache.configurations, cacheKey, config, config.cacheSettings?.ttl || 300);

        console.log(`🏠 Property types configuration loaded from database: ${cacheKey}`);
        return config;
      } else {
        // Create default configuration
        const defaultConfig = this.createDefaultConfiguration(tenantId, locale, environment);
        console.log(`🏠 Created default property types configuration: ${cacheKey}`);
        return defaultConfig;
      }
    } catch (error) {
      console.error('❌ Failed to load property types configuration:', error);
      // Return default configuration as fallback
      return this.createDefaultConfiguration(tenantId, locale, environment);
    }
  }

  /**
   * Get property types for dropdown/selector
   */
  async getPropertyTypes(
    tenantId: string = 'default',
    locale: string = 'el',
    environment: string = 'production',
    category?: 'residential' | 'commercial' | 'industrial' | 'special' | 'mixed'
  ): Promise<PropertyTypeOption[]> {
    const config = await this.loadPropertyTypesConfiguration(tenantId, locale, environment);

    let propertyTypes = config.propertyTypes.filter(pt => pt.isActive);

    // Filter by category if specified
    if (category) {
      propertyTypes = propertyTypes.filter(pt => pt.category === category);
    }

    // Sort by order
    propertyTypes.sort((a, b) => a.order - b.order);

    console.log(`🏠 Retrieved ${propertyTypes.length} property types for ${tenantId}/${locale}/${category || 'all'}`);
    return propertyTypes;
  }

  /**
   * Get property type by value/ID
   */
  async getPropertyType(
    value: string,
    tenantId: string = 'default',
    locale: string = 'el',
    environment: string = 'production'
  ): Promise<PropertyTypeOption | null> {
    const propertyTypes = await this.getPropertyTypes(tenantId, locale, environment);
    return propertyTypes.find(pt => pt.value === value) || null;
  }

  /**
   * Get property type classifications (hierarchy)
   */
  async getPropertyTypeClassifications(
    tenantId: string = 'default',
    locale: string = 'el',
    environment: string = 'production'
  ): Promise<PropertyTypeClassification[]> {
    const config = await this.loadPropertyTypesConfiguration(tenantId, locale, environment);
    return config.classifications;
  }

  /**
   * Get validation rules for property type
   */
  async getPropertyTypeValidationRules(
    propertyTypeId: string,
    tenantId: string = 'default',
    locale: string = 'el',
    environment: string = 'production'
  ): Promise<PropertyTypeValidationRule[]> {
    const config = await this.loadPropertyTypesConfiguration(tenantId, locale, environment);
    return config.validationRules
      .filter(rule => rule.propertyTypeId === propertyTypeId)
      .sort((a, b) => a.priority - b.priority);
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Get property types formatted for React Select
   */
  async getPropertyTypesForSelect(
    tenantId?: string,
    locale?: string,
    environment?: string,
    includeAll: boolean = true
  ): Promise<Array<{ value: string; label: string; category?: string }>> {
    const propertyTypes = await this.getPropertyTypes(tenantId, locale, environment);

    const options: Array<{ value: string; label: string; category?: PropertyTypeOption['category'] }> = propertyTypes.map(pt => ({
      value: pt.value,
      label: pt.label,
      category: pt.category
    }));

    if (includeAll) {
      options.unshift({ value: 'all', label: PROPERTY_FILTER_LABELS.ALL_TYPES });
    }

    return options;
  }

  /**
   * Get property types grouped by category
   */
  async getPropertyTypesGrouped(
    tenantId?: string,
    locale?: string,
    environment?: string
  ): Promise<Record<string, PropertyTypeOption[]>> {
    const propertyTypes = await this.getPropertyTypes(tenantId, locale, environment);

    return propertyTypes.reduce((groups, pt) => {
      if (!groups[pt.category]) {
        groups[pt.category] = [];
      }
      groups[pt.category].push(pt);
      return groups;
    }, {} as Record<string, PropertyTypeOption[]>);
  }

  /**
   * Validate property data against type rules
   */
  async validatePropertyData(
    propertyTypeId: string,
    propertyData: Record<string, unknown>,
    tenantId?: string,
    locale?: string,
    environment?: string
  ): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const rules = await this.getPropertyTypeValidationRules(
      propertyTypeId,
      tenantId,
      locale,
      environment
    );

    const errors: string[] = [];
    const warnings: string[] = [];

    for (const rule of rules) {
      const fieldValue = propertyData[rule.fieldName];
      const toNumber = (value: unknown): number | null => (
        typeof value === 'number' && Number.isFinite(value) ? value : null
      );
      let isRuleValid = true;

      switch (rule.operator) {
        case 'min':
          {
            const fieldNumber = toNumber(fieldValue);
            const ruleNumber = toNumber(rule.value);
            isRuleValid = fieldNumber !== null && ruleNumber !== null && fieldNumber >= ruleNumber;
          }
          break;
        case 'max':
          {
            const fieldNumber = toNumber(fieldValue);
            const ruleNumber = toNumber(rule.value);
            isRuleValid = fieldNumber !== null && ruleNumber !== null && fieldNumber <= ruleNumber;
          }
          break;
        case 'equals':
          isRuleValid = fieldValue === rule.value;
          break;
        case 'in':
          isRuleValid = Array.isArray(rule.value) && rule.value.some((value) => value === fieldValue);
          break;
        case 'regex':
          if (typeof fieldValue === 'string' && (typeof rule.value === 'string' || rule.value instanceof RegExp)) {
            const regex = rule.value instanceof RegExp ? rule.value : new RegExp(rule.value);
            isRuleValid = regex.test(fieldValue);
          } else {
            isRuleValid = false;
          }
          break;
      }

      if (!isRuleValid) {
        if (rule.isMandatory) {
          errors.push(rule.errorMessage);
        } else if (rule.warningMessage) {
          warnings.push(rule.warningMessage);
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  // ============================================================================
  // DEFAULT CONFIGURATIONS
  // ============================================================================

  /**
   * Create default property types configuration
   */
  private createDefaultConfiguration(
    tenantId: string,
    locale: string,
    environment: string
  ): PropertyTypesConfiguration {
    const defaultPropertyTypes: PropertyTypeOption[] = [
      {
        value: 'studio',
        label: 'Στούντιο',
        category: 'residential',
        icon: 'home',
        description: 'Μικρό διαμέρισμα με ενιαίο χώρο',
        minArea: 20,
        maxArea: 50,
        characteristics: ['Ενιαίος χώρος', 'Μικρό μπάνιο', 'Κουζινάκι'],
        marketClass: 'budget',
        order: 1,
        isActive: true
      },
      {
        value: 'garsoniera',
        label: 'Γκαρσονιέρα',
        category: 'residential',
        icon: 'home',
        description: 'Μικρό διαμέρισμα 1 δωματίου',
        minArea: 25,
        maxArea: 45,
        characteristics: ['1 δωμάτιο', 'Μικρή κουζίνα', 'Μπάνιο'],
        marketClass: 'standard',
        order: 2,
        isActive: true
      },
      {
        value: 'apartment',
        label: 'Διαμέρισμα',
        category: 'residential',
        icon: 'building',
        description: 'Διαμέρισμα πολλών δωματίων',
        minArea: 50,
        maxArea: 200,
        characteristics: ['Πολλά δωμάτια', 'Σαλόνι', 'Κουζίνα', 'Μπάνια'],
        marketClass: 'standard',
        order: 3,
        isActive: true
      },
      {
        value: 'maisonette',
        label: 'Μεζονέτα',
        category: 'residential',
        icon: 'home-modern',
        description: 'Διώροφο διαμέρισμα ή σπίτι',
        minArea: 80,
        maxArea: 300,
        characteristics: ['2 όροφοι', 'Εσωτερικές σκάλες', 'Μεγάλοι χώροι'],
        marketClass: 'luxury',
        order: 4,
        isActive: true
      },
      {
        value: 'warehouse',
        label: 'Αποθήκη',
        category: 'commercial',
        icon: 'warehouse',
        description: 'Αποθηκευτικός χώρος',
        minArea: 20,
        maxArea: 1000,
        characteristics: ['Μεγάλος χώρος', 'Υψηλό ταβάνι', 'Εύκολη πρόσβαση'],
        marketClass: 'standard',
        order: 5,
        isActive: true
      },
      {
        value: 'parking',
        label: 'Parking',
        category: 'commercial',
        icon: 'car',
        description: 'Χώρος στάθμευσης',
        minArea: 10,
        maxArea: 50,
        characteristics: ['Κλειστός χώρος', 'Ασφάλεια', 'Εύκολη πρόσβαση'],
        marketClass: 'standard',
        order: 6,
        isActive: true
      }
    ];

    const defaultClassifications: PropertyTypeClassification[] = [
      {
        id: 'residential',
        name: 'Κατοικίες',
        parentId: null,
        childIds: ['residential-small', 'residential-large'],
        level: 0,
        description: 'Ακίνητα κατοικίας',
        propertyTypeIds: ['studio', 'garsoniera', 'apartment', 'maisonette']
      },
      {
        id: 'commercial',
        name: 'Επαγγελματικά',
        parentId: null,
        childIds: ['commercial-storage', 'commercial-office'],
        level: 0,
        description: 'Επαγγελματικά ακίνητα',
        propertyTypeIds: ['warehouse', 'parking']
      }
    ];

    return {
      configId: `property-types-${tenantId}-${locale}-${environment}`,
      version: '1.0.0',
      tenantId,
      locale,
      environment,
      propertyTypes: defaultPropertyTypes,
      classifications: defaultClassifications,
      validationRules: [],
      marketSettings: {
        primaryMarket: 'residential',
        enableLuxury: true,
        enableIndustrial: false,
        enableSpecial: false,
        defaultPropertyType: 'apartment',
        requireAreaValidation: true,
        currency: 'EUR',
        areaUnit: 'sqm'
      },
      displaySettings: {
        showIcons: true,
        groupByCategory: true,
        showDescriptions: true,
        defaultView: 'dropdown',
        pageSize: 20,
        showCharacteristics: true
      },
      cacheSettings: {
        ttl: 300,
        autoRefresh: true,
        refreshInterval: 600
      },
      createdAt: new Date(),
      lastUpdated: new Date(),
      updatedBy: 'system-default',
      auditTrail: [{
        action: 'created_default',
        userId: 'system',
        timestamp: new Date(),
        changes: { reason: 'Default configuration created' }
      }]
    };
  }

  // ============================================================================
  // ADVANCED FEATURES
  // ============================================================================

  /**
   * Get property type suggestions based on criteria
   */
  async getPropertyTypeSuggestions(
    criteria: {
      area?: number;
      budget?: number;
      location?: string;
      features?: string[];
    },
    tenantId?: string,
    locale?: string,
    environment?: string
  ): Promise<PropertyTypeOption[]> {
    const propertyTypes = await this.getPropertyTypes(tenantId, locale, environment);

    return propertyTypes.filter(pt => {
      if (criteria.area && pt.minArea && pt.maxArea) {
        return criteria.area >= pt.minArea && criteria.area <= pt.maxArea;
      }
      return true;
    }).slice(0, 5); // Return top 5 suggestions
  }

  /**
   * Get property type statistics
   */
  async getPropertyTypeStatistics(
    tenantId?: string,
    locale?: string,
    environment?: string
  ): Promise<{
    totalTypes: number;
    typesByCategory: Record<string, number>;
    averageAreaRange: Record<string, { min: number; max: number }>;
  }> {
    const propertyTypes = await this.getPropertyTypes(tenantId, locale, environment);

    const stats = {
      totalTypes: propertyTypes.length,
      typesByCategory: {} as Record<string, number>,
      averageAreaRange: {} as Record<string, { min: number; max: number }>
    };

    // Count by category
    propertyTypes.forEach(pt => {
      stats.typesByCategory[pt.category] = (stats.typesByCategory[pt.category] || 0) + 1;
    });

    // Calculate average area ranges by category
    Object.keys(stats.typesByCategory).forEach(category => {
      const typesInCategory = propertyTypes.filter(pt => pt.category === category);
      const areas = typesInCategory
        .filter(pt => pt.minArea && pt.maxArea)
        .map(pt => ({ min: pt.minArea!, max: pt.maxArea! }));

      if (areas.length > 0) {
        stats.averageAreaRange[category] = {
          min: Math.min(...areas.map(a => a.min)),
          max: Math.max(...areas.map(a => a.max))
        };
      }
    });

    return stats;
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default EnterprisePropertyTypesService;

// Create and export singleton instance
export const propertyTypesService = EnterprisePropertyTypesService.getInstance();
