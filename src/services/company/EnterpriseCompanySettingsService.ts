/**
 * 🏢 ENTERPRISE COMPANY SETTINGS SERVICE
 *
 * Database-driven company configuration for multi-tenant deployments.
 *
 * Split into SRP modules (ADR-065):
 * - company-settings-types.ts — types, interfaces, fallback config
 * - company-settings-legacy-converter.ts — legacy contact→settings conversion
 *
 * @module services/company/EnterpriseCompanySettingsService
 */

import { doc, setDoc, where, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';
import { firestoreQueryService } from '@/services/firestore/firestore-query.service';
import { RealtimeService } from '@/services/realtime';
import { createModuleLogger } from '@/lib/telemetry';

// Re-export types for consumers
export type {
  EnterpriseCompanySettings,
  CompanyQuickContact,
  CompanyBrandInfo,
} from './company-settings-types';

import type { EnterpriseCompanySettings, CompanyQuickContact, CompanyBrandInfo } from './company-settings-types';
import { FALLBACK_COMPANY_SETTINGS } from './company-settings-types';
import { convertLegacyContactToSettings, normalizeEnvironment } from './company-settings-legacy-converter';
import type { LegacyContactData } from './company-settings-legacy-converter';

const logger = createModuleLogger('EnterpriseCompanySettingsService');

// ============================================================================
// ENTERPRISE COMPANY SETTINGS SERVICE CLASS
// ============================================================================

export class EnterpriseCompanySettingsService {
  private static instance: EnterpriseCompanySettingsService;
  private settingsCache: Map<string, EnterpriseCompanySettings> = new Map();
  private cacheTimestamp: Map<string, number> = new Map();
  private readonly CACHE_DURATION = 15 * 60 * 1000; // 15 minutes (settings cache longer)

  constructor() {
    if (EnterpriseCompanySettingsService.instance) {
      return EnterpriseCompanySettingsService.instance;
    }
    EnterpriseCompanySettingsService.instance = this;
  }

  // ========================================================================
  // SETTINGS LOADING & MANAGEMENT
  // ========================================================================

  /**
   * 🏢 Load company settings για specific tenant and environment
   */
  async loadCompanySettings(
    tenantId?: string,
    environment?: string
  ): Promise<EnterpriseCompanySettings> {
    try {
      const cacheKey = `${tenantId || 'default'}-${environment || 'default'}`;

      // Check cache first
      if (this.isCacheValid(cacheKey)) {
        logger.debug('Using cached company settings', { cacheKey });
        return this.settingsCache.get(cacheKey)!;
      }

      logger.info('Loading company settings from Firebase', { tenantId, environment });

      // Try to load από system collection
      let settings = await this.loadFromSystemCollection(tenantId, environment);

      // If not found, try to load από contacts collection (legacy)
      if (!settings) {
        settings = await this.loadFromContactsCollection(tenantId);
      }

      // If still not found, initialize default settings
      if (!settings) {
        logger.warn('No company settings found, initializing defaults');
        settings = await this.initializeDefaultSettings(tenantId, environment);
      }

      // Cache the results
      this.settingsCache.set(cacheKey, settings);
      this.cacheTimestamp.set(cacheKey, Date.now());

      logger.info('Loaded company settings', { tenantId: tenantId || 'default' });
      return settings;

    } catch (error) {
      logger.error('Error loading company settings', { error });
      return this.getFallbackSettings(tenantId);
    }
  }

  /**
   * 📥 Load settings από system collection
   */
  private async loadFromSystemCollection(
    tenantId?: string,
    environment?: string
  ): Promise<EnterpriseCompanySettings | null> {
    try {
      // Try tenant-specific document first
      if (tenantId) {
        const tenantData = await firestoreQueryService.getById<EnterpriseCompanySettings>(
          'SYSTEM', `company-${tenantId}`
        );

        if (tenantData && this.isValidForEnvironment(tenantData, environment)) {
          return tenantData;
        }
      }

      // Try default company document
      const defaultDocId = process.env.NEXT_PUBLIC_COMPANY_CONFIG_DOC || 'company';
      const defaultData = await firestoreQueryService.getById<EnterpriseCompanySettings>(
        'SYSTEM', defaultDocId
      );

      if (defaultData && this.isValidForEnvironment(defaultData, environment)) {
        return defaultData;
      }

      return null;
    } catch (error) {
      logger.error('Error loading from system collection', { error });
      return null;
    }
  }

  /**
   * 📥 Load settings από contacts collection (legacy support)
   */
  private async loadFromContactsCollection(tenantId?: string): Promise<EnterpriseCompanySettings | null> {
    try {
      const constraints = [
        where('type', '==', 'company'),
        orderBy('createdAt', 'desc'),
        limit(1)
      ];

      if (tenantId) {
        constraints.unshift(where('tenantId', '==', tenantId));
      }

      const result = await firestoreQueryService.getAll<Record<string, unknown>>(
        'CONTACTS', { constraints, tenantOverride: 'skip' }
      );

      if (!result.isEmpty && result.documents.length > 0) {
        const companyDoc = result.documents[0] as LegacyContactData;
        const docId = typeof (companyDoc as Record<string, unknown>).id === 'string'
          ? (companyDoc as Record<string, unknown>).id as string
          : '';
        return convertLegacyContactToSettings(companyDoc, docId);
      }

      return null;
    } catch (error) {
      logger.error('Error loading from contacts collection', { error });
      return null;
    }
  }

  // ========================================================================
  // QUICK ACCESS METHODS
  // ========================================================================

  /**
   * 📞 Get quick contact information
   */
  async getQuickContact(tenantId?: string): Promise<CompanyQuickContact> {
    const settings = await this.loadCompanySettings(tenantId);

    return {
      name: settings.companyInfo.name,
      email: settings.contactInfo.email,
      phone: settings.contactInfo.phone,
      website: settings.companyInfo.website,
      domain: settings.technicalSettings.domain
    };
  }

  /**
   * 🎨 Get brand information
   */
  async getBrandInfo(tenantId?: string): Promise<CompanyBrandInfo> {
    const settings = await this.loadCompanySettings(tenantId);

    return {
      name: settings.companyInfo.name,
      displayName: settings.companyInfo.displayName || settings.companyInfo.name,
      logo: settings.brandSettings.logoUrl,
      primaryColor: settings.brandSettings.primaryColor,
      secondaryColor: settings.brandSettings.secondaryColor,
      theme: settings.brandSettings.theme
    };
  }

  /**
   * 📧 Get communication template variables
   */
  async getTemplateVariables(tenantId?: string): Promise<Record<string, string>> {
    const settings = await this.loadCompanySettings(tenantId);

    return {
      companyName: settings.companyInfo.name,
      companyDisplayName: settings.companyInfo.displayName || settings.companyInfo.name,
      companyEmail: settings.contactInfo.email,
      companyPhone: settings.contactInfo.phone,
      companyWebsite: settings.companyInfo.website || '',
      companyAddress: `${settings.addressInfo.street}, ${settings.addressInfo.city}`,
      companySupportEmail: settings.contactInfo.supportEmail || settings.contactInfo.email,
      companySalesEmail: settings.contactInfo.salesEmail || settings.contactInfo.email
    };
  }

  // ========================================================================
  // SETTINGS MANAGEMENT
  // ========================================================================

  /**
   * 📝 Update company settings
   */
  async updateCompanySettings(
    updates: Partial<EnterpriseCompanySettings>,
    tenantId?: string
  ): Promise<boolean> {
    try {
      const docId = tenantId ? `company-${tenantId}` : (process.env.NEXT_PUBLIC_COMPANY_CONFIG_DOC || 'company');

      const updateData = {
        ...updates,
        metadata: {
          ...updates.metadata,
          updatedAt: new Date(),
          version: (updates.metadata?.version || 0) + 1
        }
      };

      await firestoreQueryService.update('SYSTEM', docId, updateData);

      // Invalidate cache
      this.invalidateCache(tenantId);

      // 🏢 ENTERPRISE: Centralized Real-time Service (cross-page sync)
      RealtimeService.dispatch('WORKSPACE_UPDATED', {
        workspaceId: docId,
        updates: {
          settings: {
            type: 'company_settings',
            tenantId
          }
        },
        timestamp: Date.now(),
      });

      logger.info('Updated company settings', { docId });
      return true;
    } catch (error) {
      logger.error('Error updating company settings', { error });
      return false;
    }
  }

  /**
   * 🏗️ Initialize default company settings στη Firebase
   */
  async initializeDefaultSettings(
    tenantId?: string,
    environment?: string
  ): Promise<EnterpriseCompanySettings> {
    try {
      logger.info('Initializing default company settings in Firebase');

      const settings = {
        ...FALLBACK_COMPANY_SETTINGS,
        tenantId,
        environment: normalizeEnvironment(environment),
        metadata: {
          ...FALLBACK_COMPANY_SETTINGS.metadata,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      };

      const docId = tenantId ? `company-${tenantId}` : (process.env.NEXT_PUBLIC_COMPANY_CONFIG_DOC || 'company');
      const docRef = doc(db, COLLECTIONS.SYSTEM, docId);

      await setDoc(docRef, settings, { merge: true });

      logger.info('Default company settings initialized in Firebase');
      return settings;
    } catch (error) {
      logger.error('Error initializing default settings', { error });
      return this.getFallbackSettings(tenantId);
    }
  }

  // ========================================================================
  // UTILITIES
  // ========================================================================

  /**
   * 🔄 Get fallback settings
   */
  getFallbackSettings(tenantId?: string): EnterpriseCompanySettings {
    logger.info('Using fallback company settings');
    return {
      ...FALLBACK_COMPANY_SETTINGS,
      tenantId
    };
  }

  /**
   * ✅ Check if settings are valid for environment
   */
  private isValidForEnvironment(data: { environment?: string }, environment?: string): boolean {
    if (!environment) return true;

    const dataEnv = data.environment;
    return !dataEnv || dataEnv === 'all' || dataEnv === environment;
  }

  /**
   * ⏰ Check if cache is valid
   */
  private isCacheValid(cacheKey: string): boolean {
    const timestamp = this.cacheTimestamp.get(cacheKey);
    if (!timestamp) return false;

    return (Date.now() - timestamp) < this.CACHE_DURATION;
  }

  /**
   * 🗑️ Invalidate cache
   */
  invalidateCache(tenantId?: string): void {
    if (tenantId) {
      // Clear specific tenant cache
      const keys = Array.from(this.settingsCache.keys()).filter(key => key.includes(tenantId));
      keys.forEach(key => {
        this.settingsCache.delete(key);
        this.cacheTimestamp.delete(key);
      });
    } else {
      // Clear all cache
      this.settingsCache.clear();
      this.cacheTimestamp.clear();
    }

    logger.info('Company settings cache invalidated', { tenantId: tenantId || 'all' });
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const companySettingsService = new EnterpriseCompanySettingsService();

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================


