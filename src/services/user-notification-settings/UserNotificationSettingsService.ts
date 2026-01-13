/**
 * =============================================================================
 * USER NOTIFICATION SETTINGS SERVICE
 * =============================================================================
 *
 * Enterprise Pattern: Singleton service for user notification preferences
 * Manages CRUD operations for user notification settings in Firestore
 *
 * Features:
 * - Get/Set notification preferences per user
 * - Category-specific toggle updates
 * - Email frequency management
 * - Quiet hours configuration
 * - Real-time subscription support
 *
 * @module services/user-notification-settings/UserNotificationSettingsService
 * @enterprise ADR-025 - Notification Settings Centralization
 */

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  Timestamp,
  Firestore,
} from 'firebase/firestore';

import {
  UserNotificationSettings,
  NotificationSettingsUpdate,
  CategoryToggleUpdate,
  NotificationCategory,
  getDefaultNotificationSettings,
} from './user-notification-settings.types';

// ============================================================================
// FIRESTORE COLLECTION
// ============================================================================

const COLLECTION_NAME = 'user_notification_settings';

// ============================================================================
// SERVICE CLASS
// ============================================================================

/**
 * 🏢 Enterprise User Notification Settings Service
 *
 * Singleton pattern for managing user notification preferences.
 * Connects to Firestore for persistence.
 */
class UserNotificationSettingsService {
  private static instance: UserNotificationSettingsService | null = null;
  private db: Firestore | null = null;
  private unsubscribeMap = new Map<string, () => void>();

  private constructor() {}

  // ==========================================================================
  // SINGLETON PATTERN
  // ==========================================================================

  /**
   * Get singleton instance
   */
  public static getInstance(): UserNotificationSettingsService {
    if (!UserNotificationSettingsService.instance) {
      UserNotificationSettingsService.instance = new UserNotificationSettingsService();
    }
    return UserNotificationSettingsService.instance;
  }

  /**
   * Initialize with Firestore instance
   */
  public initialize(firestore: Firestore): void {
    this.db = firestore;
    console.log('✅ [NotificationSettings] Service initialized');
  }

  // ==========================================================================
  // CORE CRUD OPERATIONS
  // ==========================================================================

  /**
   * Get notification settings for a user
   * Creates default settings if none exist
   */
  public async getSettings(userId: string): Promise<UserNotificationSettings> {
    if (!this.db) {
      throw new Error('UserNotificationSettingsService not initialized');
    }

    try {
      const docRef = doc(this.db, COLLECTION_NAME, userId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        return this.transformFromFirestore(data, userId);
      }

      // Create default settings if none exist
      const defaultSettings = getDefaultNotificationSettings(userId);
      await this.saveSettings(defaultSettings);
      return defaultSettings;
    } catch (error) {
      console.error('❌ [NotificationSettings] Error getting settings:', error);
      throw error;
    }
  }

  /**
   * Save complete notification settings
   */
  public async saveSettings(settings: UserNotificationSettings): Promise<void> {
    if (!this.db) {
      throw new Error('UserNotificationSettingsService not initialized');
    }

    try {
      const docRef = doc(this.db, COLLECTION_NAME, settings.userId);
      const data = this.transformToFirestore(settings);
      await setDoc(docRef, data, { merge: true });
      console.log('✅ [NotificationSettings] Settings saved for user:', settings.userId);
    } catch (error) {
      console.error('❌ [NotificationSettings] Error saving settings:', error);
      throw error;
    }
  }

  /**
   * Update partial notification settings
   */
  public async updateSettings(
    userId: string,
    updates: NotificationSettingsUpdate
  ): Promise<void> {
    if (!this.db) {
      throw new Error('UserNotificationSettingsService not initialized');
    }

    try {
      const docRef = doc(this.db, COLLECTION_NAME, userId);
      const updateData = {
        ...updates,
        updatedAt: Timestamp.now(),
      };
      await updateDoc(docRef, updateData);
      console.log('✅ [NotificationSettings] Settings updated for user:', userId);
    } catch (error) {
      console.error('❌ [NotificationSettings] Error updating settings:', error);
      throw error;
    }
  }

  // ==========================================================================
  // CATEGORY-SPECIFIC OPERATIONS
  // ==========================================================================

  /**
   * Toggle a specific notification setting within a category
   */
  public async toggleCategorySetting(
    userId: string,
    update: CategoryToggleUpdate
  ): Promise<void> {
    if (!this.db) {
      throw new Error('UserNotificationSettingsService not initialized');
    }

    try {
      const docRef = doc(this.db, COLLECTION_NAME, userId);
      const fieldPath = `categories.${update.category}.${update.setting}`;

      await updateDoc(docRef, {
        [fieldPath]: update.enabled,
        updatedAt: Timestamp.now(),
      });

      console.log(
        `✅ [NotificationSettings] Toggled ${update.category}.${update.setting} = ${update.enabled}`
      );
    } catch (error) {
      console.error('❌ [NotificationSettings] Error toggling setting:', error);
      throw error;
    }
  }

  /**
   * Enable/disable entire category
   */
  public async toggleCategory(
    userId: string,
    category: NotificationCategory,
    enabled: boolean
  ): Promise<void> {
    if (!this.db) {
      throw new Error('UserNotificationSettingsService not initialized');
    }

    try {
      const settings = await this.getSettings(userId);
      const categorySettings = settings.categories[category];

      // Set all settings in category to the enabled value
      const updatedCategory = Object.keys(categorySettings).reduce(
        (acc, key) => ({
          ...acc,
          [key]: enabled,
        }),
        {}
      );

      const docRef = doc(this.db, COLLECTION_NAME, userId);
      await updateDoc(docRef, {
        [`categories.${category}`]: updatedCategory,
        updatedAt: Timestamp.now(),
      });

      console.log(`✅ [NotificationSettings] Toggled entire ${category} = ${enabled}`);
    } catch (error) {
      console.error('❌ [NotificationSettings] Error toggling category:', error);
      throw error;
    }
  }

  // ==========================================================================
  // GLOBAL TOGGLES
  // ==========================================================================

  /**
   * Toggle global notifications
   */
  public async toggleGlobal(userId: string, enabled: boolean): Promise<void> {
    await this.updateSettings(userId, { globalEnabled: enabled });
  }

  /**
   * Toggle in-app notifications
   */
  public async toggleInApp(userId: string, enabled: boolean): Promise<void> {
    await this.updateSettings(userId, { inAppEnabled: enabled });
  }

  /**
   * Toggle email notifications
   */
  public async toggleEmail(userId: string, enabled: boolean): Promise<void> {
    await this.updateSettings(userId, { emailEnabled: enabled });
  }

  /**
   * Toggle push notifications
   */
  public async togglePush(userId: string, enabled: boolean): Promise<void> {
    await this.updateSettings(userId, { pushEnabled: enabled });
  }

  // ==========================================================================
  // EMAIL FREQUENCY
  // ==========================================================================

  /**
   * Set email frequency preference
   */
  public async setEmailFrequency(
    userId: string,
    frequency: UserNotificationSettings['emailFrequency']
  ): Promise<void> {
    await this.updateSettings(userId, { emailFrequency: frequency });
  }

  // ==========================================================================
  // QUIET HOURS
  // ==========================================================================

  /**
   * Update quiet hours settings
   */
  public async updateQuietHours(
    userId: string,
    quietHours: UserNotificationSettings['quietHours']
  ): Promise<void> {
    await this.updateSettings(userId, { quietHours });
  }

  // ==========================================================================
  // REAL-TIME SUBSCRIPTION
  // ==========================================================================

  /**
   * Subscribe to settings changes
   */
  public subscribeToSettings(
    userId: string,
    callback: (settings: UserNotificationSettings) => void,
    onError?: (error: Error) => void
  ): () => void {
    if (!this.db) {
      throw new Error('UserNotificationSettingsService not initialized');
    }

    // Unsubscribe from previous subscription if exists
    const existingUnsubscribe = this.unsubscribeMap.get(userId);
    if (existingUnsubscribe) {
      existingUnsubscribe();
    }

    const docRef = doc(this.db, COLLECTION_NAME, userId);

    const unsubscribe = onSnapshot(
      docRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const settings = this.transformFromFirestore(docSnap.data(), userId);
          callback(settings);
        } else {
          // Return default settings if document doesn't exist
          callback(getDefaultNotificationSettings(userId));
        }
      },
      (error) => {
        console.error('❌ [NotificationSettings] Subscription error:', error);
        onError?.(error);
      }
    );

    this.unsubscribeMap.set(userId, unsubscribe);
    return unsubscribe;
  }

  /**
   * Unsubscribe from settings changes
   */
  public unsubscribe(userId: string): void {
    const unsubscribe = this.unsubscribeMap.get(userId);
    if (unsubscribe) {
      unsubscribe();
      this.unsubscribeMap.delete(userId);
    }
  }

  // ==========================================================================
  // DATA TRANSFORMATION
  // ==========================================================================

  /**
   * Transform Firestore data to UserNotificationSettings
   */
  private transformFromFirestore(
    data: Record<string, unknown>,
    userId: string
  ): UserNotificationSettings {
    const defaults = getDefaultNotificationSettings(userId);

    return {
      userId,
      globalEnabled: (data.globalEnabled as boolean) ?? defaults.globalEnabled,
      inAppEnabled: (data.inAppEnabled as boolean) ?? defaults.inAppEnabled,
      emailEnabled: (data.emailEnabled as boolean) ?? defaults.emailEnabled,
      emailFrequency:
        (data.emailFrequency as UserNotificationSettings['emailFrequency']) ??
        defaults.emailFrequency,
      pushEnabled: (data.pushEnabled as boolean) ?? defaults.pushEnabled,
      categories: {
        crm: {
          ...defaults.categories.crm,
          ...((data.categories as Record<string, unknown>)?.crm as Record<string, boolean>),
        },
        properties: {
          ...defaults.categories.properties,
          ...((data.categories as Record<string, unknown>)?.properties as Record<string, boolean>),
        },
        tasks: {
          ...defaults.categories.tasks,
          ...((data.categories as Record<string, unknown>)?.tasks as Record<string, boolean>),
        },
        security: {
          ...defaults.categories.security,
          ...((data.categories as Record<string, unknown>)?.security as Record<string, boolean>),
        },
      },
      quietHours: {
        ...defaults.quietHours,
        ...((data.quietHours as Record<string, unknown>) ?? {}),
      },
      createdAt:
        data.createdAt instanceof Timestamp
          ? data.createdAt.toDate()
          : defaults.createdAt,
      updatedAt:
        data.updatedAt instanceof Timestamp
          ? data.updatedAt.toDate()
          : defaults.updatedAt,
    };
  }

  /**
   * Transform UserNotificationSettings to Firestore data
   */
  private transformToFirestore(
    settings: UserNotificationSettings
  ): Record<string, unknown> {
    return {
      globalEnabled: settings.globalEnabled,
      inAppEnabled: settings.inAppEnabled,
      emailEnabled: settings.emailEnabled,
      emailFrequency: settings.emailFrequency,
      pushEnabled: settings.pushEnabled,
      categories: settings.categories,
      quietHours: settings.quietHours,
      createdAt: Timestamp.fromDate(settings.createdAt),
      updatedAt: Timestamp.now(),
    };
  }
}

// ============================================================================
// EXPORT SINGLETON
// ============================================================================

export const userNotificationSettingsService = UserNotificationSettingsService.getInstance();

export default userNotificationSettingsService;
