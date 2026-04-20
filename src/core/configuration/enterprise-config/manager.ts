/**
 * ============================================================================
 * 🚀 ENTERPRISE CONFIGURATION MANAGER
 * ============================================================================
 *
 * Κεντρικός manager για όλες τις configurations με:
 * - Real-time updates (via firestoreQueryService — ADR-214 SSoT)
 * - Caching mechanism
 * - Error handling
 * - Type safety
 *
 * Extracted from enterprise-config-management.ts (ADR-314 C.5.43 SRP split).
 * Migrated inline `onSnapshot` → `firestoreQueryService.subscribeDoc` SSoT.
 *
 * ============================================================================
 */

import {
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  type DocumentData,
  type Unsubscribe
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { nowTimestamp } from '@/lib/firestore-now';
import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';
import { firestoreQueryService } from '@/services/firestore/firestore-query.service';
import type {
  CompanyConfiguration,
  EnterpriseConfiguration,
  ProjectTemplateConfiguration,
  SystemConfiguration
} from './types';
import { DEFAULT_COMPANY_CONFIG, DEFAULT_SYSTEM_CONFIG } from './defaults';
import {
  parseAndValidateConfiguration,
  validateCompanyConfig,
  validateProjectTemplate,
  validateSystemConfig
} from './validators';

const logger = createModuleLogger('enterprise-config-manager');

/**
 * Enterprise Configuration Manager
 * Singleton manager for all configurations.
 */
export class EnterpriseConfigurationManager {
  private static instance: EnterpriseConfigurationManager;
  private config: EnterpriseConfiguration | null = null;
  private listeners: Map<string, Unsubscribe> = new Map();
  private configCache: Map<string, unknown> = new Map();
  private readonly cacheTimeout = 5 * 60 * 1000; // 5 minutes

  private constructor() {}

  public static getInstance(): EnterpriseConfigurationManager {
    if (!EnterpriseConfigurationManager.instance) {
      EnterpriseConfigurationManager.instance = new EnterpriseConfigurationManager();
    }
    return EnterpriseConfigurationManager.instance;
  }

  // ============================================================================
  // 📥 LOADING
  // ============================================================================

  public async loadConfiguration(): Promise<EnterpriseConfiguration> {
    try {
      const configDoc = await getDoc(doc(db, COLLECTIONS.SYSTEM, 'configuration'));

      if (!configDoc.exists()) {
        logger.warn('Configuration not found in database, creating defaults...');
        await this.createDefaultConfiguration();
        return await this.loadConfiguration();
      }

      const data = configDoc.data();
      const configuration = parseAndValidateConfiguration(data);
      this.config = configuration;

      logger.info('Enterprise configuration loaded successfully');
      return configuration;

    } catch (error) {
      logger.error('Failed to load configuration', { error });
      throw new Error(`Configuration loading failed: ${error}`);
    }
  }

  public async getCompanyConfig(): Promise<CompanyConfiguration> {
    const cacheKey = 'company_config';

    if (this.configCache.has(cacheKey)) {
      return this.configCache.get(cacheKey) as CompanyConfiguration;
    }

    try {
      const configDoc = await getDoc(doc(db, COLLECTIONS.SYSTEM, 'company'));

      if (!configDoc.exists()) {
        logger.warn('Company config not found, using defaults');
        return DEFAULT_COMPANY_CONFIG;
      }

      const companyConfig = validateCompanyConfig(configDoc.data());

      this.configCache.set(cacheKey, companyConfig);
      setTimeout(() => this.configCache.delete(cacheKey), this.cacheTimeout);

      return companyConfig;

    } catch (error) {
      logger.error('Failed to load company config', { error });
      return DEFAULT_COMPANY_CONFIG;
    }
  }

  public async getSystemConfig(): Promise<SystemConfiguration> {
    const cacheKey = 'system_config';

    if (this.configCache.has(cacheKey)) {
      return this.configCache.get(cacheKey) as SystemConfiguration;
    }

    try {
      const configDoc = await getDoc(doc(db, COLLECTIONS.SYSTEM, 'settings'));

      if (!configDoc.exists()) {
        logger.warn('System config not found, using defaults');
        return DEFAULT_SYSTEM_CONFIG;
      }

      const systemConfig = validateSystemConfig(configDoc.data());

      this.configCache.set(cacheKey, systemConfig);
      setTimeout(() => this.configCache.delete(cacheKey), this.cacheTimeout);

      return systemConfig;

    } catch (error) {
      logger.error('Failed to load system config', { error });
      return DEFAULT_SYSTEM_CONFIG;
    }
  }

  /**
   * 🏢 ENTERPRISE: Get Admin Configuration
   * Returns admin UID and settings for system notifications.
   */
  public async getAdminConfig(): Promise<SystemConfiguration['admin']> {
    const cacheKey = 'admin_config';

    if (this.configCache.has(cacheKey)) {
      return this.configCache.get(cacheKey) as SystemConfiguration['admin'];
    }

    try {
      const systemConfig = await this.getSystemConfig();
      const adminConfig = systemConfig.admin;

      if (!adminConfig.primaryAdminUid) {
        logger.warn('Admin UID not configured - using email as fallback');
      }

      this.configCache.set(cacheKey, adminConfig);
      setTimeout(() => this.configCache.delete(cacheKey), this.cacheTimeout);

      return adminConfig;

    } catch (error) {
      logger.error('Failed to load admin config', { error });
      return DEFAULT_SYSTEM_CONFIG.admin;
    }
  }

  public async getProjectTemplates(): Promise<readonly ProjectTemplateConfiguration[]> {
    try {
      const snapshot = await getDocs(collection(db, COLLECTIONS.SYSTEM, 'project-templates'));

      if (snapshot.empty) {
        logger.warn('No project templates found');
        return [];
      }

      const templates: ProjectTemplateConfiguration[] = [];
      snapshot.forEach((tplDoc) => {
        const template = validateProjectTemplate(tplDoc.data());
        if (template) {
          templates.push(template);
        }
      });

      return templates;

    } catch (error) {
      logger.error('Failed to load project templates', { error });
      return [];
    }
  }

  // ============================================================================
  // 💾 UPDATES
  // ============================================================================

  public async updateCompanyConfig(updates: Partial<CompanyConfiguration>): Promise<void> {
    try {
      const current = await this.getCompanyConfig();
      const updated = { ...current, ...updates };

      validateCompanyConfig(updated);

      await setDoc(doc(db, COLLECTIONS.SYSTEM, 'company'), updated);

      this.configCache.delete('company_config');

      logger.info('Company configuration updated successfully');

    } catch (error) {
      logger.error('Failed to update company config', { error });
      throw new Error(`Company config update failed: ${error}`);
    }
  }

  public async updateSystemConfig(updates: Partial<SystemConfiguration>): Promise<void> {
    try {
      const current = await this.getSystemConfig();
      const updated = { ...current, ...updates };

      validateSystemConfig(updated);

      await setDoc(doc(db, COLLECTIONS.SYSTEM, 'settings'), updated);

      this.configCache.delete('system_config');

      logger.info('System configuration updated successfully');

    } catch (error) {
      logger.error('Failed to update system config', { error });
      throw new Error(`System config update failed: ${error}`);
    }
  }

  // ============================================================================
  // 🎧 REAL-TIME LISTENERS (firestoreQueryService SSoT — ADR-214)
  // ============================================================================

  /**
   * Setup real-time listener for configuration changes.
   * Migrated to firestoreQueryService SSoT (ADR-314 C.5.43).
   */
  public setupConfigurationListener(
    onUpdate: (config: EnterpriseConfiguration) => void
  ): void {
    const unsubscribe = firestoreQueryService.subscribeDoc<DocumentData>(
      'SYSTEM',
      'configuration',
      (data) => {
        if (!data) return;
        try {
          const configuration = parseAndValidateConfiguration(data);
          this.config = configuration;
          onUpdate(configuration);
        } catch (error) {
          logger.error('Configuration listener error', { error });
        }
      },
      (error) => {
        logger.error('Configuration listener failed', { error });
      }
    );

    this.listeners.set('main', unsubscribe);
  }

  public cleanup(): void {
    this.listeners.forEach((unsubscribe) => unsubscribe());
    this.listeners.clear();
    this.configCache.clear();
  }

  // ============================================================================
  // 🛠️ INTERNAL
  // ============================================================================

  private async createDefaultConfiguration(): Promise<void> {
    try {
      const defaultConfig: EnterpriseConfiguration = {
        company: DEFAULT_COMPANY_CONFIG,
        system: DEFAULT_SYSTEM_CONFIG,
        projectTemplates: [],
        userPreferences: {
          userId: 'default',
          language: 'el',
          timezone: process.env.NEXT_PUBLIC_DEFAULT_TIMEZONE || 'Europe/Athens',
          dateFormat: 'DD/MM/YYYY',
          numberFormat: 'el-GR',
          theme: 'light',
          notifications: {
            email: true,
            push: true,
            sms: false
          },
          dashboard: {
            defaultView: 'projects',
            refreshInterval: 30000,
            itemsPerPage: 25
          }
        },
        lastUpdated: nowTimestamp(),
        version: '1.0.0'
      };

      await setDoc(doc(db, COLLECTIONS.SYSTEM, 'configuration'), defaultConfig);
      logger.info('Default configuration created successfully');

    } catch (error) {
      logger.error('Failed to create default configuration', { error });
      throw new Error(`Default configuration creation failed: ${error}`);
    }
  }
}
