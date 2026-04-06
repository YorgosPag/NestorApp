/**
 * 👤 ENTERPRISE USER PREFERENCES SERVICE
 *
 * Database-driven user preferences system for personalized experiences.
 *
 * Split into 2 files for SRP compliance (ADR-065 Phase 4):
 * - user-preferences-types.ts              — Types + defaults factory (EXEMPT)
 * - EnterpriseUserPreferencesService.ts     — Service class (this file)
 */

import { db } from '@/lib/firebase';
import { doc, setDoc, where } from 'firebase/firestore';
import { COLLECTIONS } from '@/config/firestore-collections';
import { firestoreQueryService } from '@/services/firestore/firestore-query.service';
import { RealtimeService } from '@/services/realtime';
import { createModuleLogger } from '@/lib/telemetry';

// Re-export all types for backward compatibility
export type {
  PropertyViewerFilters,
  PropertyViewerStats,
  PropertyViewerPreferences,
  EditorToolPreferences,
  DisplayPreferences,
  NotificationPreferences,
  UserPreferences,
  EnterpriseUserPreferencesConfig,
  CompanyDefaultPreferencesConfig,
} from './user-preferences-types';

import type {
  UserPreferences,
  PropertyViewerPreferences,
  EditorToolPreferences,
  DisplayPreferences,
  NotificationPreferences,
  EnterpriseUserPreferencesConfig,
  CompanyDefaultPreferencesConfig,
} from './user-preferences-types';
import { getDefaultUserPreferences } from './user-preferences-types';

const logger = createModuleLogger('EnterpriseUserPreferencesService');

// ============================================================================
// ENTERPRISE USER PREFERENCES SERVICE
// ============================================================================

class EnterpriseUserPreferencesService {
  private readonly CONFIG_COLLECTION = COLLECTIONS.CONFIG;
  private readonly USER_PREFERENCES_COLLECTION = COLLECTIONS.USER_PREFERENCES;
  private readonly preferencesCache = new Map<string, UserPreferences>();
  private readonly companyDefaultsCache = new Map<string, Record<string, unknown>>();
  private readonly cacheTTL = 5 * 60 * 1000; // 5 minutes
  private cacheTimestamps = new Map<string, number>();

  // ========================================================================
  // CACHE MANAGEMENT
  // ========================================================================

  private isCacheValid(cacheKey: string): boolean {
    const timestamp = this.cacheTimestamps.get(cacheKey);
    if (!timestamp) return false;
    return Date.now() - timestamp < this.cacheTTL;
  }

  private setCache<T>(cacheMap: Map<string, T>, cacheKey: string, data: T): void {
    cacheMap.set(cacheKey, data);
    this.cacheTimestamps.set(cacheKey, Date.now());
  }

  invalidateCache(): void {
    this.preferencesCache.clear();
    this.companyDefaultsCache.clear();
    this.cacheTimestamps.clear();
    logger.info('User preferences caches invalidated');
  }

  clearCacheForUser(userId: string): void {
    const keysToDelete: string[] = [];

    for (const key of this.cacheTimestamps.keys()) {
      if (key.includes(userId)) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => {
      this.preferencesCache.delete(key);
      this.companyDefaultsCache.delete(key);
      this.cacheTimestamps.delete(key);
    });

    logger.info(`Cleared user preferences cache for user: ${userId}`);
  }

  // ========================================================================
  // USER PREFERENCES - CORE FUNCTIONALITY
  // ========================================================================

  async loadUserPreferences(
    userId: string,
    tenantId?: string
  ): Promise<UserPreferences> {
    const cacheKey = `user_prefs_${userId}_${tenantId || 'default'}`;

    if (this.isCacheValid(cacheKey)) {
      const cached = this.preferencesCache.get(cacheKey);
      if (cached) {
        return cached;
      }
    }

    try {
      const userData = await firestoreQueryService.getById<EnterpriseUserPreferencesConfig>(
        'USER_PREFERENCES', `${userId}_${tenantId || 'default'}`
      );

      let userPrefs: UserPreferences | null = null;

      if (userData) {
        userPrefs = userData.preferences;
      }

      const companyDefaults = await this.loadCompanyDefaults(tenantId);
      const completePreferences = this.mergePreferences(userPrefs, companyDefaults);

      this.setCache(this.preferencesCache, cacheKey, completePreferences);

      logger.info('User preferences loaded', {
        userId,
        tenantId,
        hasUserPrefs: !!userPrefs,
        hasCompanyDefaults: Object.keys(companyDefaults).length > 0
      });

      return completePreferences;

    } catch (error) {
      logger.error('Error loading user preferences:', error);
      return this.getFallbackPreferences();
    }
  }

  async saveUserPreferences(
    userId: string,
    preferences: UserPreferences,
    tenantId?: string
  ): Promise<void> {
    try {
      const docId = `${userId}_${tenantId || 'default'}`;

      const config: EnterpriseUserPreferencesConfig = {
        id: docId,
        userId,
        tenantId,
        preferences,
        isEnabled: true,
        version: '1.0.0',
        metadata: {
          displayName: `Preferences for user ${userId}`,
          description: 'User-specific application preferences',
          lastSyncedAt: new Date(),
          deviceInfo: {
            deviceType: this.getDeviceType(),
            browserInfo: this.getBrowserInfo(),
            screenResolution: this.getScreenResolution()
          },
          createdBy: userId,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      };

      await setDoc(doc(db, this.USER_PREFERENCES_COLLECTION, docId), config, { merge: true });

      this.clearCacheForUser(userId);

      RealtimeService.dispatch('USER_SETTINGS_UPDATED', {
        userId,
        updates: {
          settingKey: 'preferences',
          value: {
            categories: Object.keys(preferences),
          }
        },
        timestamp: Date.now(),
      });

      logger.info('User preferences saved:', docId);
    } catch (error) {
      logger.error('Error saving user preferences:', error);
      throw error;
    }
  }

  async updateUserPreferences(
    userId: string,
    category: keyof UserPreferences,
    updates: Partial<UserPreferences[keyof UserPreferences]>,
    tenantId?: string
  ): Promise<void> {
    try {
      const docId = `${userId}_${tenantId || 'default'}`;

      const updateData = {
        [`preferences.${category}`]: updates,
        'metadata.updatedAt': new Date(),
        'metadata.lastSyncedAt': new Date()
      };

      await firestoreQueryService.update('USER_PREFERENCES', docId, updateData);

      this.clearCacheForUser(userId);

      RealtimeService.dispatch('USER_SETTINGS_UPDATED', {
        userId,
        updates: {
          settingKey: 'preferences',
          value: {
            category,
            updatedKeys: Object.keys(updates),
          }
        },
        timestamp: Date.now(),
      });

      logger.info('User preferences updated:', { userId, category });
    } catch (error) {
      logger.error('Error updating user preferences:', error);
      throw error;
    }
  }

  // ========================================================================
  // COMPANY DEFAULTS MANAGEMENT
  // ========================================================================

  async loadCompanyDefaults(tenantId?: string): Promise<Record<string, unknown>> {
    const cacheKey = `company_defaults_${tenantId || 'default'}`;

    if (this.isCacheValid(cacheKey)) {
      const cached = this.companyDefaultsCache.get(cacheKey);
      if (cached) {
        return cached;
      }
    }

    try {
      const constraints = [
        where('type', '==', 'company-defaults'),
        where('isEnabled', '==', true)
      ];

      if (tenantId) {
        constraints.push(where('tenantId', '==', tenantId));
      }

      const result = await firestoreQueryService.getAll<CompanyDefaultPreferencesConfig>(
        'CONFIG', { constraints, tenantOverride: 'skip' }
      );

      const defaults: Record<string, unknown> = {};

      result.documents.forEach((config) => {
        if (config.category && config.defaults) {
          defaults[config.category] = config.defaults;
        }
      });

      this.setCache(this.companyDefaultsCache, cacheKey, defaults);

      logger.info('Company defaults loaded', {
        tenantId,
        categoriesCount: Object.keys(defaults).length
      });

      return defaults;

    } catch (error) {
      logger.error('Error loading company defaults:', error);
      return {};
    }
  }

  private mergePreferences(
    userPrefs: UserPreferences | null,
    companyDefaults: Record<string, unknown>
  ): UserPreferences {
    const fallbackPrefs = this.getFallbackPreferences();
    let mergedPrefs: UserPreferences = { ...fallbackPrefs };

    const applyCategoryDefaults = <TKey extends keyof UserPreferences>(
      key: TKey,
      defaults: Partial<UserPreferences[TKey]>
    ): void => {
      mergedPrefs = {
        ...mergedPrefs,
        [key]: {
          ...mergedPrefs[key],
          ...defaults
        }
      };
    };

    Object.keys(companyDefaults).forEach((category) => {
      const key = category as keyof UserPreferences;
      const defaultsForCategory = companyDefaults[category];

      if (
        mergedPrefs[key] &&
        defaultsForCategory &&
        typeof defaultsForCategory === 'object' &&
        !Array.isArray(defaultsForCategory)
      ) {
        applyCategoryDefaults(key, defaultsForCategory as Partial<UserPreferences[typeof key]>);
      }
    });

    if (userPrefs) {
      mergedPrefs = {
        ...mergedPrefs,
        ...userPrefs
      };
    }

    return mergedPrefs;
  }

  // ========================================================================
  // SPECIALIZED GETTERS
  // ========================================================================

  async getPropertyViewerPreferences(
    userId: string,
    tenantId?: string
  ): Promise<PropertyViewerPreferences> {
    const preferences = await this.loadUserPreferences(userId, tenantId);
    return preferences.propertyViewer;
  }

  async getEditorToolPreferences(
    userId: string,
    tenantId?: string
  ): Promise<EditorToolPreferences> {
    const preferences = await this.loadUserPreferences(userId, tenantId);
    return preferences.editorTools;
  }

  async getDisplayPreferences(
    userId: string,
    tenantId?: string
  ): Promise<DisplayPreferences> {
    const preferences = await this.loadUserPreferences(userId, tenantId);
    return preferences.display;
  }

  async getNotificationPreferences(
    userId: string,
    tenantId?: string
  ): Promise<NotificationPreferences> {
    const preferences = await this.loadUserPreferences(userId, tenantId);
    return preferences.notifications;
  }

  // ========================================================================
  // FALLBACK & UTILITIES
  // ========================================================================

  getFallbackPreferences(): UserPreferences {
    return getDefaultUserPreferences();
  }

  private getDeviceType(): string {
    if (typeof window === 'undefined') return 'server';

    const userAgent = navigator.userAgent;
    if (/tablet|ipad|playbook|silk/i.test(userAgent)) {
      return 'tablet';
    } else if (/mobile|iphone|ipod|android|blackberry|opera|mini|windows\sce|palm|smartphone|iemobile/i.test(userAgent)) {
      return 'mobile';
    }
    return 'desktop';
  }

  private getBrowserInfo(): string {
    if (typeof window === 'undefined') return 'unknown';

    const userAgent = navigator.userAgent;
    let browserName = 'unknown';

    if (userAgent.includes('Chrome')) browserName = 'Chrome';
    else if (userAgent.includes('Firefox')) browserName = 'Firefox';
    else if (userAgent.includes('Safari')) browserName = 'Safari';
    else if (userAgent.includes('Edge')) browserName = 'Edge';

    return browserName;
  }

  private getScreenResolution(): string {
    if (typeof window === 'undefined') return 'unknown';
    return `${window.screen.width}x${window.screen.height}`;
  }

  isReady(): boolean {
    try {
      return !!db;
    } catch {
      return false;
    }
  }

  getCacheStats() {
    return {
      preferencesCacheSize: this.preferencesCache.size,
      companyDefaultsCacheSize: this.companyDefaultsCache.size,
      totalCacheEntries: this.cacheTimestamps.size,
      cacheTTL: this.cacheTTL
    };
  }
}

// ============================================================================
// EXPORT SINGLETON INSTANCE
// ============================================================================

export const userPreferencesService = new EnterpriseUserPreferencesService();
export default userPreferencesService;
