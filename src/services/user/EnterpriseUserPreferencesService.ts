/**
 * 👤 ENTERPRISE USER PREFERENCES SERVICE
 *
 * Database-driven user preferences system για personalized experiences.
 * Replaces hardcoded DEFAULT_FILTERS, DEFAULT_STATS με configurable, user-specific solutions.
 *
 * Features:
 * - Database-driven user preferences (Firestore)
 * - User-specific settings storage
 * - Company default preferences
 * - Real-time preferences sync
 * - Performance-optimized caching
 * - Cross-device preferences sync
 * - Preference versioning
 * - Fallback system για offline mode
 *
 * @version 1.0.0
 * @enterprise-ready true
 */

import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, getDoc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { COLLECTIONS } from '@/config/firestore-collections';
// 🏢 ENTERPRISE: Centralized real-time service for cross-page sync
import { RealtimeService } from '@/services/realtime';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Property viewer filter state
 */
export interface PropertyViewerFilters {
  searchTerm: string;
  project: string[];
  building: string[];
  floor: string[];
  propertyType: string[];
  status: string[];
  priceRange: { min: number | null; max: number | null };
  areaRange: { min: number | null; max: number | null };
  features: string[];
}

/**
 * Property viewer statistics structure
 */
export interface PropertyViewerStats {
  totalProperties: number;
  availableProperties: number;
  soldProperties: number;
  totalValue: number;
  totalArea: number;
  averagePrice: number;
  propertiesByStatus: Record<string, number>;
  propertiesByType: Record<string, number>;
  propertiesByFloor: Record<string, number>;
  totalStorageUnits: number;
  availableStorageUnits: number;
  soldStorageUnits: number;
  uniqueBuildings: number;
  reserved: number;
}

/**
 * Property viewer preferences
 */
export interface PropertyViewerPreferences {
  defaultFilters: PropertyViewerFilters;
  defaultStats: PropertyViewerStats;
  fallbackFloorId: string;
  viewMode: 'grid' | 'list' | 'map';
  showGrid: boolean;
  snapToGrid: boolean;
  gridSize: number;
  showMeasurements: boolean;
  scale: number;
  showDashboard: boolean;
  autoSaveFilters: boolean;
  rememberLastView: boolean;
}

/**
 * Editor tool preferences
 */
export interface EditorToolPreferences {
  defaultTool: string;
  showToolTips: boolean;
  keyboardShortcuts: Record<string, string>;
  toolbarLayout: 'horizontal' | 'vertical' | 'compact';
  showAdvancedTools: boolean;
}

/**
 * Display preferences
 */
export interface DisplayPreferences {
  theme: 'light' | 'dark' | 'auto';
  colorScheme: string;
  fontSize: 'small' | 'medium' | 'large';
  density: 'compact' | 'comfortable' | 'spacious';
  animations: boolean;
  highContrast: boolean;
  reduceMotion: boolean;
}

/**
 * Notification preferences
 */
export interface NotificationPreferences {
  emailNotifications: boolean;
  pushNotifications: boolean;
  soundEnabled: boolean;
  notificationTypes: {
    propertyUpdates: boolean;
    systemMessages: boolean;
    taskReminders: boolean;
    collaborationUpdates: boolean;
  };
}

/**
 * Complete user preferences interface
 */
export interface UserPreferences {
  propertyViewer: PropertyViewerPreferences;
  editorTools: EditorToolPreferences;
  display: DisplayPreferences;
  notifications: NotificationPreferences;
  customSettings: Record<string, any>;
}

/**
 * User preferences configuration για Firebase
 */
export interface EnterpriseUserPreferencesConfig {
  id: string;
  userId: string;
  tenantId?: string;
  preferences: UserPreferences;
  isEnabled: boolean;
  version: string;
  metadata: {
    displayName?: string;
    description?: string;
    lastSyncedAt?: Date;
    deviceInfo?: {
      deviceType: string;
      browserInfo: string;
      screenResolution: string;
    };
    migrationInfo?: {
      migratedFrom?: string;
      migrationDate?: Date;
    };
    createdBy?: string;
    createdAt: Date;
    updatedAt: Date;
  };
}

/**
 * Company default preferences configuration
 */
export interface CompanyDefaultPreferencesConfig {
  id: string;
  tenantId: string;
  category: 'propertyViewer' | 'editorTools' | 'display' | 'notifications';
  defaults: Record<string, any>;
  isEnabled: boolean;
  priority: number;
  environment?: string;
  metadata: {
    displayName?: string;
    description?: string;
    version?: string;
    createdBy?: string;
    createdAt: Date;
    updatedAt: Date;
  };
}

// ============================================================================
// ENTERPRISE USER PREFERENCES SERVICE
// ============================================================================

class EnterpriseUserPreferencesService {
  private readonly CONFIG_COLLECTION = COLLECTIONS.CONFIG;
  private readonly USER_PREFERENCES_COLLECTION = COLLECTIONS.USER_PREFERENCES || 'user_preferences';
  private readonly preferencesCache = new Map<string, UserPreferences>();
  private readonly companyDefaultsCache = new Map<string, Record<string, any>>();
  private readonly cacheTTL = 5 * 60 * 1000; // 5 minutes για user preferences
  private cacheTimestamps = new Map<string, number>();

  // ========================================================================
  // CACHE MANAGEMENT
  // ========================================================================

  /**
   * Check if cache is valid για specific key
   */
  private isCacheValid(cacheKey: string): boolean {
    const timestamp = this.cacheTimestamps.get(cacheKey);
    if (!timestamp) return false;
    return Date.now() - timestamp < this.cacheTTL;
  }

  /**
   * Set cache με timestamp
   */
  private setCache<T>(cacheMap: Map<string, T>, cacheKey: string, data: T): void {
    cacheMap.set(cacheKey, data);
    this.cacheTimestamps.set(cacheKey, Date.now());
  }

  /**
   * Invalidate all caches
   */
  invalidateCache(): void {
    this.preferencesCache.clear();
    this.companyDefaultsCache.clear();
    this.cacheTimestamps.clear();
    console.log('🗑️ User preferences caches invalidated');
  }

  /**
   * Clear cache για specific user
   */
  clearCacheForUser(userId: string): void {
    const keysToDelete: string[] = [];

    // Find all cache keys που περιέχουν το userId
    for (const key of this.cacheTimestamps.keys()) {
      if (key.includes(userId)) {
        keysToDelete.push(key);
      }
    }

    // Delete matching entries
    keysToDelete.forEach(key => {
      this.preferencesCache.delete(key);
      this.companyDefaultsCache.delete(key);
      this.cacheTimestamps.delete(key);
    });

    console.log(`🗑️ Cleared user preferences cache for user: ${userId}`);
  }

  // ========================================================================
  // USER PREFERENCES - CORE FUNCTIONALITY
  // ========================================================================

  /**
   * 👤 Load user preferences με company defaults fallback
   */
  async loadUserPreferences(
    userId: string,
    tenantId?: string
  ): Promise<UserPreferences> {
    const cacheKey = `user_prefs_${userId}_${tenantId || 'default'}`;

    // Check cache first
    if (this.isCacheValid(cacheKey)) {
      const cached = this.preferencesCache.get(cacheKey);
      if (cached) {
        console.log('✅ User preferences loaded from cache:', cacheKey);
        return cached;
      }
    }

    try {
      console.log('🔄 Loading user preferences from Firebase:', { userId, tenantId });

      // Try to load user-specific preferences
      const userDoc = await getDoc(doc(db, this.USER_PREFERENCES_COLLECTION, `${userId}_${tenantId || 'default'}`));

      let userPrefs: UserPreferences | null = null;

      if (userDoc.exists()) {
        const userData = userDoc.data() as EnterpriseUserPreferencesConfig;
        userPrefs = userData.preferences;
      }

      // Load company defaults για missing preferences
      const companyDefaults = await this.loadCompanyDefaults(tenantId);

      // Merge user preferences με company defaults
      const completePreferences = await this.mergePreferences(userPrefs, companyDefaults);

      // Cache the results
      this.setCache(this.preferencesCache, cacheKey, completePreferences);

      console.log('✅ User preferences loaded successfully:', {
        userId,
        tenantId,
        hasUserPrefs: !!userPrefs,
        hasCompanyDefaults: Object.keys(companyDefaults).length > 0
      });

      return completePreferences;

    } catch (error) {
      console.error('❌ Error loading user preferences:', error);

      // Return fallback preferences
      console.log('🔄 Using fallback user preferences for user:', userId);
      return this.getFallbackPreferences();
    }
  }

  /**
   * 💾 Save user preferences
   */
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

      // Invalidate cache για this user
      this.clearCacheForUser(userId);

      // 🏢 ENTERPRISE: Centralized Real-time Service (cross-page sync)
      RealtimeService.dispatchUserSettingsUpdated({
        userId,
        settingsType: 'preferences',
        updates: {
          categories: Object.keys(preferences),
        },
        timestamp: Date.now(),
      });

      console.log('✅ User preferences saved successfully:', docId);
    } catch (error) {
      console.error('❌ Error saving user preferences:', error);
      throw error;
    }
  }

  /**
   * 📝 Update specific preference category
   */
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

      await updateDoc(doc(db, this.USER_PREFERENCES_COLLECTION, docId), updateData);

      // Invalidate cache για this user
      this.clearCacheForUser(userId);

      // 🏢 ENTERPRISE: Centralized Real-time Service (cross-page sync)
      RealtimeService.dispatchUserSettingsUpdated({
        userId,
        settingsType: 'preferences',
        updates: {
          category,
          updatedKeys: Object.keys(updates),
        },
        timestamp: Date.now(),
      });

      console.log('✅ User preferences updated successfully:', { userId, category });
    } catch (error) {
      console.error('❌ Error updating user preferences:', error);
      throw error;
    }
  }

  // ========================================================================
  // COMPANY DEFAULTS MANAGEMENT
  // ========================================================================

  /**
   * 🏢 Load company default preferences
   */
  async loadCompanyDefaults(tenantId?: string): Promise<Record<string, any>> {
    const cacheKey = `company_defaults_${tenantId || 'default'}`;

    // Check cache first
    if (this.isCacheValid(cacheKey)) {
      const cached = this.companyDefaultsCache.get(cacheKey);
      if (cached) {
        console.log('✅ Company defaults loaded from cache:', cacheKey);
        return cached;
      }
    }

    try {
      console.log('🔄 Loading company defaults from Firebase:', { tenantId });

      // Build query constraints
      const constraints = [
        where('type', '==', 'company-defaults'),
        where('isEnabled', '==', true)
      ];

      if (tenantId) {
        constraints.push(where('tenantId', '==', tenantId));
      }

      // Query Firestore
      const q = query(collection(db, this.CONFIG_COLLECTION), ...constraints);
      const querySnapshot = await getDocs(q);

      const defaults: Record<string, any> = {};

      querySnapshot.forEach((doc) => {
        const config = doc.data() as CompanyDefaultPreferencesConfig;
        if (config.category && config.defaults) {
          defaults[config.category] = config.defaults;
        }
      });

      // Cache the results
      this.setCache(this.companyDefaultsCache, cacheKey, defaults);

      console.log('✅ Company defaults loaded successfully:', {
        tenantId,
        categoriesCount: Object.keys(defaults).length
      });

      return defaults;

    } catch (error) {
      console.error('❌ Error loading company defaults:', error);
      return {};
    }
  }

  /**
   * 🔧 Merge user preferences με company defaults
   */
  private async mergePreferences(
    userPrefs: UserPreferences | null,
    companyDefaults: Record<string, any>
  ): Promise<UserPreferences> {
    const fallbackPrefs = this.getFallbackPreferences();

    // Start με fallback preferences
    let mergedPrefs = { ...fallbackPrefs };

    // Apply company defaults
    Object.keys(companyDefaults).forEach(category => {
      if (mergedPrefs[category as keyof UserPreferences]) {
        mergedPrefs[category as keyof UserPreferences] = {
          ...mergedPrefs[category as keyof UserPreferences],
          ...companyDefaults[category]
        };
      }
    });

    // Apply user-specific preferences (highest priority)
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

  /**
   * 🏠 Get property viewer preferences
   */
  async getPropertyViewerPreferences(
    userId: string,
    tenantId?: string
  ): Promise<PropertyViewerPreferences> {
    const preferences = await this.loadUserPreferences(userId, tenantId);
    return preferences.propertyViewer;
  }

  /**
   * 🔧 Get editor tool preferences
   */
  async getEditorToolPreferences(
    userId: string,
    tenantId?: string
  ): Promise<EditorToolPreferences> {
    const preferences = await this.loadUserPreferences(userId, tenantId);
    return preferences.editorTools;
  }

  /**
   * 🎨 Get display preferences
   */
  async getDisplayPreferences(
    userId: string,
    tenantId?: string
  ): Promise<DisplayPreferences> {
    const preferences = await this.loadUserPreferences(userId, tenantId);
    return preferences.display;
  }

  /**
   * 🔔 Get notification preferences
   */
  async getNotificationPreferences(
    userId: string,
    tenantId?: string
  ): Promise<NotificationPreferences> {
    const preferences = await this.loadUserPreferences(userId, tenantId);
    return preferences.notifications;
  }

  // ========================================================================
  // FALLBACK SYSTEMS
  // ========================================================================

  /**
   * 🛡️ Get fallback preferences για offline/error scenarios
   */
  getFallbackPreferences(): UserPreferences {
    return {
      propertyViewer: {
        // 🏢 ADR-051: Use undefined for empty ranges (enterprise-grade type consistency)
        defaultFilters: {
          searchTerm: '',
          project: [],
          building: [],
          floor: [],
          propertyType: [],
          status: [],
          priceRange: { min: undefined, max: undefined },
          areaRange: { min: undefined, max: undefined },
          features: []
        },
        defaultStats: {
          totalProperties: 0,
          availableProperties: 0,
          soldProperties: 0,
          totalValue: 0,
          totalArea: 0,
          averagePrice: 0,
          propertiesByStatus: {},
          propertiesByType: {},
          propertiesByFloor: {},
          totalStorageUnits: 0,
          availableStorageUnits: 0,
          soldStorageUnits: 0,
          uniqueBuildings: 0,
          reserved: 0
        },
        fallbackFloorId: process.env.NEXT_PUBLIC_DEFAULT_FLOOR_ID || 'floor-1',
        viewMode: 'grid',
        showGrid: true,
        snapToGrid: false,
        gridSize: 20,
        showMeasurements: true,
        scale: 1,
        showDashboard: true,
        autoSaveFilters: true,
        rememberLastView: true
      },
      editorTools: {
        defaultTool: 'select',
        showToolTips: true,
        keyboardShortcuts: {
          'ctrl+z': 'undo',
          'ctrl+y': 'redo',
          'delete': 'delete',
          'escape': 'deselect'
        },
        toolbarLayout: 'horizontal',
        showAdvancedTools: false
      },
      display: {
        theme: 'light',
        colorScheme: 'blue',
        fontSize: 'medium',
        density: 'comfortable',
        animations: true,
        highContrast: false,
        reduceMotion: false
      },
      notifications: {
        emailNotifications: true,
        pushNotifications: true,
        soundEnabled: true,
        notificationTypes: {
          propertyUpdates: true,
          systemMessages: true,
          taskReminders: true,
          collaborationUpdates: false
        }
      },
      customSettings: {}
    };
  }

  // ========================================================================
  // UTILITY METHODS
  // ========================================================================

  /**
   * 📱 Get device type
   */
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

  /**
   * 🌐 Get browser info
   */
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

  /**
   * 🖥️ Get screen resolution
   */
  private getScreenResolution(): string {
    if (typeof window === 'undefined') return 'unknown';

    return `${window.screen.width}x${window.screen.height}`;
  }

  /**
   * 🧪 Check if service is ready
   */
  isReady(): boolean {
    try {
      return !!db;
    } catch {
      return false;
    }
  }

  /**
   * 📊 Get cache statistics
   */
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