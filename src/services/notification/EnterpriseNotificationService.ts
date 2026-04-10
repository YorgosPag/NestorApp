/**
 * 🏢 ENTERPRISE NOTIFICATION CONFIGURATION SERVICE
 *
 * Database-driven notification configuration system for multi-tenant deployments.
 * Replaces ALL hardcoded notification settings with configurable, environment-specific values.
 *
 * Types: ./notification-types.ts
 * Fallback configs: ./notification-defaults.ts
 *
 * @enterprise-ready true
 * @multi-tenant true
 * @cache-enabled true
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { createModuleLogger } from '@/lib/telemetry';
import { normalizeToDate } from '@/lib/date-local';

import type {
  AlertSeverity,
  EnterpriseNotificationConfig,
  EnterpriseNotificationPriority,
  EnterpriseSeverityMapping,
  EnterpriseChannelConfig,
  EnterpriseRetryPolicy,
} from './notification-types';

import {
  getDefaultProcessingConfig,
  getDefaultDefaults,
  getDefaultFeatures,
  getDefaultRetryPolicy,
  getFallbackPriorities,
  getFallbackSeverityMappings,
  getFallbackChannels,
  getFallbackConfiguration,
} from './notification-defaults';

// Re-export types for consumers
export type * from './notification-types';

const notifLogger = createModuleLogger('EnterpriseNotificationService');

// ============================================================================
// ENTERPRISE NOTIFICATION SERVICE CLASS
// ============================================================================

class EnterpriseNotificationService {
  private static instance: EnterpriseNotificationService | null = null;

  // Firestore connection
  private db: ReturnType<typeof getFirestore> | null = null;

  // Multi-level caching system
  private configCache = new Map<string, { config: EnterpriseNotificationConfig; cachedAt: number; ttl: number }>();
  private prioritiesCache = new Map<string, { priorities: EnterpriseNotificationPriority[]; cachedAt: number; ttl: number }>();
  private channelsCache = new Map<string, { channels: EnterpriseChannelConfig[]; cachedAt: number; ttl: number }>();
  private mappingsCache = new Map<string, { mappings: EnterpriseSeverityMapping[]; cachedAt: number; ttl: number }>();

  // Cache TTL settings (milliseconds)
  private readonly cacheTtl = {
    fullConfig: 5 * 60 * 1000,   // 5 minutes - volatile
    priorities: 10 * 60 * 1000,   // 10 minutes - stable
    channels: 5 * 60 * 1000,      // 5 minutes - may change
    mappings: 15 * 60 * 1000,     // 15 minutes - rarely changed
  };

  private constructor() {}

  // ========================================================================
  // SINGLETON PATTERN
  // ========================================================================

  public static getInstance(): EnterpriseNotificationService {
    if (!EnterpriseNotificationService.instance) {
      EnterpriseNotificationService.instance = new EnterpriseNotificationService();
    }
    return EnterpriseNotificationService.instance;
  }

  // ========================================================================
  // INITIALIZATION & CONNECTION
  // ========================================================================

  private async ensureFirebaseConnection(): Promise<void> {
    if (this.db) return;

    try {
      const app = initializeApp({
        apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
        authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
        appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
      });

      this.db = getFirestore(app);
      notifLogger.info('Firebase connection established');
    } catch (error) {
      notifLogger.warn('Firebase connection failed, using fallback mode', { error });
    }
  }

  // ========================================================================
  // MAIN CONFIGURATION LOADING
  // ========================================================================

  async loadNotificationConfiguration(
    environment: string = 'production',
    tenantId?: string
  ): Promise<EnterpriseNotificationConfig> {
    const cacheKey = `${environment}-${tenantId || 'global'}`;

    const cached = this.configCache.get(cacheKey);
    if (cached && this.isCacheValid(cached.cachedAt, cached.ttl)) {
      return cached.config;
    }

    try {
      await this.ensureFirebaseConnection();

      if (this.db) {
        const config = await this.loadConfigFromDatabase(environment, tenantId);

        this.configCache.set(cacheKey, {
          config,
          cachedAt: Date.now(),
          ttl: this.cacheTtl.fullConfig,
        });

        notifLogger.info('Configuration loaded from database', { environment, tenantId });
        return config;
      }
    } catch (error) {
      notifLogger.warn('Database load failed, using fallback', { error });
    }

    const fallbackConfig = getFallbackConfiguration(environment, tenantId);

    this.configCache.set(cacheKey, {
      config: fallbackConfig,
      cachedAt: Date.now(),
      ttl: this.cacheTtl.fullConfig,
    });

    return fallbackConfig;
  }

  private async loadConfigFromDatabase(
    environment: string,
    tenantId?: string
  ): Promise<EnterpriseNotificationConfig> {
    const configPath = tenantId
      ? `notification_configs/tenants/${tenantId}/${environment}`
      : `notification_configs/global/${environment}`;

    const firestore = this.db!;
    const configDoc = await getDoc(doc(firestore, configPath));

    if (!configDoc.exists()) {
      throw new Error(`Configuration not found: ${configPath}`);
    }

    const configData = configDoc.data();

    const priorities = await this.loadPrioritiesFromDatabase(environment, tenantId);
    const channels = await this.loadChannelsFromDatabase(environment, tenantId);
    const severityMappings = await this.loadSeverityMappingsFromDatabase(environment, tenantId);

    return {
      configId: configDoc.id,
      version: configData.version || '1.0.0',
      tenantId,
      environment,
      lastUpdated: normalizeToDate(configData.lastUpdated) ?? new Date(),
      priorities,
      severityMappings,
      channels,
      processing: configData.processing || getDefaultProcessingConfig(),
      defaults: configData.defaults || getDefaultDefaults(),
      features: configData.features || getDefaultFeatures(),
    };
  }

  // ========================================================================
  // PRIORITY MANAGEMENT
  // ========================================================================

  async getNotificationPriorities(
    environment: string = 'production',
    tenantId?: string
  ): Promise<EnterpriseNotificationPriority[]> {
    const cacheKey = `priorities-${environment}-${tenantId || 'global'}`;

    const cached = this.prioritiesCache.get(cacheKey);
    if (cached && this.isCacheValid(cached.cachedAt, cached.ttl)) {
      return cached.priorities;
    }

    try {
      await this.ensureFirebaseConnection();

      if (this.db) {
        const priorities = await this.loadPrioritiesFromDatabase(environment, tenantId);

        this.prioritiesCache.set(cacheKey, {
          priorities,
          cachedAt: Date.now(),
          ttl: this.cacheTtl.priorities,
        });

        return priorities;
      }
    } catch (error) {
      notifLogger.warn('Priority loading failed, using fallback', { error });
    }

    const fallbackPriorities = getFallbackPriorities();

    this.prioritiesCache.set(cacheKey, {
      priorities: fallbackPriorities,
      cachedAt: Date.now(),
      ttl: this.cacheTtl.priorities,
    });

    return fallbackPriorities;
  }

  private async loadPrioritiesFromDatabase(
    environment: string,
    tenantId?: string
  ): Promise<EnterpriseNotificationPriority[]> {
    const prioritiesPath = tenantId
      ? `notification_priorities/tenants/${tenantId}/${environment}`
      : `notification_priorities/global/${environment}`;

    const firestore = this.db!;
    // companyId: N/A — multi-tenancy via path (`notification_priorities/tenants/${tenantId}/...`),
    // not via field. The collection itself is environment+tenant scoped at the path level.
    const prioritiesQuery = query(
      // companyId: N/A — path-based tenancy (notification_priorities/tenants/${tenantId})
      collection(firestore, prioritiesPath),
      where('isActive', '==', true)
    );
    const prioritiesSnapshot = await getDocs(prioritiesQuery);

    const priorities: EnterpriseNotificationPriority[] = [];
    prioritiesSnapshot.forEach((docSnap) => {
      priorities.push({
        id: docSnap.id,
        ...docSnap.data(),
      } as EnterpriseNotificationPriority);
    });

    return priorities.sort((a, b) => a.order - b.order);
  }

  // ========================================================================
  // CHANNEL MANAGEMENT
  // ========================================================================

  async getChannelConfigurations(
    environment: string = 'production',
    tenantId?: string
  ): Promise<EnterpriseChannelConfig[]> {
    const cacheKey = `channels-${environment}-${tenantId || 'global'}`;

    const cached = this.channelsCache.get(cacheKey);
    if (cached && this.isCacheValid(cached.cachedAt, cached.ttl)) {
      return cached.channels;
    }

    try {
      await this.ensureFirebaseConnection();

      if (this.db) {
        const channels = await this.loadChannelsFromDatabase(environment, tenantId);

        this.channelsCache.set(cacheKey, {
          channels,
          cachedAt: Date.now(),
          ttl: this.cacheTtl.channels,
        });

        return channels;
      }
    } catch (error) {
      notifLogger.warn('Channel loading failed, using fallback', { error });
    }

    const fallbackChannels = getFallbackChannels();

    this.channelsCache.set(cacheKey, {
      channels: fallbackChannels,
      cachedAt: Date.now(),
      ttl: this.cacheTtl.channels,
    });

    return fallbackChannels;
  }

  private async loadChannelsFromDatabase(
    environment: string,
    tenantId?: string
  ): Promise<EnterpriseChannelConfig[]> {
    const channelsPath = tenantId
      ? `notification_channels/tenants/${tenantId}/${environment}`
      : `notification_channels/global/${environment}`;

    const firestore = this.db!;
    // companyId: N/A — multi-tenancy via path (`notification_channels/tenants/${tenantId}/...`),
    // not via field. The collection itself is environment+tenant scoped at the path level.
    const channelsQuery = query(
      // companyId: N/A — path-based tenancy (notification_channels/tenants/${tenantId})
      collection(firestore, channelsPath),
      where('isEnabled', '==', true)
    );
    const channelsSnapshot = await getDocs(channelsQuery);

    const channels: EnterpriseChannelConfig[] = [];
    channelsSnapshot.forEach((docSnap) => {
      channels.push({
        channelId: docSnap.id,
        ...docSnap.data(),
      } as EnterpriseChannelConfig);
    });

    return channels;
  }

  // ========================================================================
  // SEVERITY MAPPING
  // ========================================================================

  async getSeverityMappings(
    environment: string = 'production',
    tenantId?: string
  ): Promise<EnterpriseSeverityMapping[]> {
    const cacheKey = `mappings-${environment}-${tenantId || 'global'}`;

    const cached = this.mappingsCache.get(cacheKey);
    if (cached && this.isCacheValid(cached.cachedAt, cached.ttl)) {
      return cached.mappings;
    }

    try {
      await this.ensureFirebaseConnection();

      if (this.db) {
        const mappings = await this.loadSeverityMappingsFromDatabase(environment, tenantId);

        this.mappingsCache.set(cacheKey, {
          mappings,
          cachedAt: Date.now(),
          ttl: this.cacheTtl.mappings,
        });

        return mappings;
      }
    } catch (error) {
      notifLogger.warn('Severity mapping loading failed, using fallback', { error });
    }

    const fallbackMappings = getFallbackSeverityMappings();

    this.mappingsCache.set(cacheKey, {
      mappings: fallbackMappings,
      cachedAt: Date.now(),
      ttl: this.cacheTtl.mappings,
    });

    return fallbackMappings;
  }

  private async loadSeverityMappingsFromDatabase(
    environment: string,
    tenantId?: string
  ): Promise<EnterpriseSeverityMapping[]> {
    const mappingsPath = tenantId
      ? `severity_mappings/tenants/${tenantId}/${environment}`
      : `severity_mappings/global/${environment}`;

    const firestore = this.db!;
    const mappingsSnapshot = await getDocs(collection(firestore, mappingsPath));

    const mappings: EnterpriseSeverityMapping[] = [];
    mappingsSnapshot.forEach((docSnap) => {
      mappings.push({
        ...docSnap.data(),
      } as EnterpriseSeverityMapping);
    });

    return mappings;
  }

  // ========================================================================
  // HELPER METHODS
  // ========================================================================

  async getPriorityForSeverity(
    severity: AlertSeverity,
    environment: string = 'production',
    tenantId?: string
  ): Promise<string> {
    const mappings = await this.getSeverityMappings(environment, tenantId);

    const mapping = mappings.find(m => m.severity === severity);
    if (!mapping) {
      notifLogger.warn('No mapping found for severity, using default', { severity });
      return 'normal';
    }

    if (tenantId && mapping.overrides?.[tenantId]) {
      return mapping.overrides[tenantId];
    }

    return mapping.priority;
  }

  async getBatchSizeForPriority(
    priorityId: string,
    environment: string = 'production',
    tenantId?: string
  ): Promise<number> {
    const priorities = await this.getNotificationPriorities(environment, tenantId);
    const priority = priorities.find(p => p.id === priorityId);
    return priority?.batchSize || 5;
  }

  async getProcessingIntervalForPriority(
    priorityId: string,
    environment: string = 'production',
    tenantId?: string
  ): Promise<number> {
    const priorities = await this.getNotificationPriorities(environment, tenantId);
    const priority = priorities.find(p => p.id === priorityId);
    return priority?.processingIntervalMs || 2000;
  }

  async getChannelRetryPolicy(
    channelId: string,
    environment: string = 'production',
    tenantId?: string
  ): Promise<EnterpriseRetryPolicy> {
    const channels = await this.getChannelConfigurations(environment, tenantId);
    const channel = channels.find(c => c.channelId === channelId);
    return channel?.retryPolicy || getDefaultRetryPolicy();
  }

  // ========================================================================
  // CACHE MANAGEMENT
  // ========================================================================

  private isCacheValid(cachedAt: number, ttl: number): boolean {
    return Date.now() - cachedAt < ttl;
  }

  clearCache(): void {
    this.configCache.clear();
    this.prioritiesCache.clear();
    this.channelsCache.clear();
    this.mappingsCache.clear();
    notifLogger.info('Enterprise notification service cache cleared');
  }

  async warmCache(environment: string, tenantId?: string): Promise<void> {
    notifLogger.info('Warming notification cache', { environment, tenantId });

    await Promise.allSettled([
      this.getNotificationPriorities(environment, tenantId),
      this.getChannelConfigurations(environment, tenantId),
      this.getSeverityMappings(environment, tenantId),
      this.loadNotificationConfiguration(environment, tenantId),
    ]);

    notifLogger.info('Notification cache warmed successfully');
  }
}

// ============================================================================
// EXPORT SINGLETON INSTANCE
// ============================================================================

export const enterpriseNotificationService = EnterpriseNotificationService.getInstance();

export default enterpriseNotificationService;
