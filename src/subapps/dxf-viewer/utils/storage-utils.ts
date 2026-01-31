/**
 * 🏢 ADR-092: Centralized localStorage Service
 *
 * Storage utilities για DXF Viewer
 * - Χειρισμός storage errors και cleanup
 * - SSR-safe localStorage operations
 * - Type-safe JSON serialization
 * - Consistent error handling
 *
 * @author Γιώργος Παγωνής + Claude Code (Anthropic AI)
 * @since 2026-01-31
 */

// ============================================================================
// STORAGE KEYS REGISTRY
// ============================================================================

/**
 * 🏢 Centralized registry για όλα τα localStorage keys
 * Single Source of Truth για key naming conventions
 */
export const STORAGE_KEYS = {
  // Debug Settings
  DEBUG_RULER: 'debug.rulerDebug.enabled',
  DEBUG_ORIGIN_MARKERS: 'debug.originMarkers.enabled',

  // Performance
  PERFORMANCE_MONITOR: 'dxf-viewer-performance-monitor-enabled',

  // Overlay State
  OVERLAY_STATE: 'dxf-viewer:overlay-state:v1',

  // Colors
  RECENT_COLORS: 'dxf-viewer:recent-colors',

  // Settings (used by LocalStorageDriver)
  DXF_SETTINGS: 'dxf-settings-v2',
  CURSOR_SETTINGS: 'autocad_cursor_settings',

  // AI Snapping
  AI_SNAPPING: 'ai-snapping-data',
} as const;

export type StorageKey = typeof STORAGE_KEYS[keyof typeof STORAGE_KEYS] | string;

// ============================================================================
// SSR-SAFE SYNC STORAGE UTILITIES
// ============================================================================

/**
 * 🏢 SSR-safe check for localStorage availability
 */
function isStorageAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const test = '__storage_test__';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch {
    return false;
  }
}

/**
 * 🏢 Get value from localStorage with type safety
 *
 * @param key - The storage key
 * @param defaultValue - Value to return if key doesn't exist or on error
 * @returns The stored value or defaultValue
 *
 * @example
 * const enabled = storageGet(STORAGE_KEYS.DEBUG_RULER, false);
 * const colors = storageGet<string[]>(STORAGE_KEYS.RECENT_COLORS, []);
 */
export function storageGet<T>(key: StorageKey, defaultValue: T): T {
  if (!isStorageAvailable()) return defaultValue;

  try {
    const stored = localStorage.getItem(key);
    if (stored === null) return defaultValue;
    return JSON.parse(stored) as T;
  } catch (error) {
    console.warn(`[StorageService] Failed to get "${key}":`, error);
    return defaultValue;
  }
}

/**
 * 🏢 Set value to localStorage with error handling
 *
 * @param key - The storage key
 * @param value - Value to store (will be JSON.stringify'd)
 * @returns true if successful, false on error
 *
 * @example
 * storageSet(STORAGE_KEYS.DEBUG_RULER, true);
 * storageSet(STORAGE_KEYS.RECENT_COLORS, ['#ff0000', '#00ff00']);
 */
export function storageSet<T>(key: StorageKey, value: T): boolean {
  if (!isStorageAvailable()) return false;

  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    // Handle quota exceeded
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      console.error(`[StorageService] Quota exceeded for "${key}"`);
    } else {
      console.warn(`[StorageService] Failed to set "${key}":`, error);
    }
    return false;
  }
}

/**
 * 🏢 Remove value from localStorage
 *
 * @param key - The storage key to remove
 * @returns true if successful, false on error
 *
 * @example
 * storageRemove(STORAGE_KEYS.DEBUG_RULER);
 */
export function storageRemove(key: StorageKey): boolean {
  if (!isStorageAvailable()) return false;

  try {
    localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

/**
 * 🏢 Check if a key exists in localStorage
 *
 * @param key - The storage key to check
 * @returns true if key exists, false otherwise
 */
export function storageHas(key: StorageKey): boolean {
  if (!isStorageAvailable()) return false;

  try {
    return localStorage.getItem(key) !== null;
  } catch {
    return false;
  }
}

// ============================================================================
// STORAGE MANAGER CLASS (existing functionality)
// ============================================================================

export class StorageManager {
  /**
   * Ελέγχει το διαθέσιμο storage space
   */
  static async checkStorageQuota(): Promise<{ usage: number; quota: number; available: number }> {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      const usage = estimate.usage || 0;
      const quota = estimate.quota || 0;
      const available = quota - usage;
      
      return { usage, quota, available };
    }
    
    // Fallback για παλιότερα browsers
    return { usage: 0, quota: 0, available: 0 };
  }

  /**
   * Καθαρίζει localStorage και sessionStorage
   */
  static clearBrowserStorage(): void {
    try {
      // Clear localStorage
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.includes('dxf') || key.includes('level') || key.includes('firebase'))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));

      // Clear sessionStorage  
      const sessionKeysToRemove: string[] = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && (key.includes('dxf') || key.includes('level') || key.includes('firebase'))) {
          sessionKeysToRemove.push(key);
        }
      }
      sessionKeysToRemove.forEach(key => sessionStorage.removeItem(key));

    } catch (error) {
      console.error('❌ Error clearing browser storage:', error);
    }
  }

  /**
   * Καθαρίζει IndexedDB databases
   */
  static async clearIndexedDB(): Promise<void> {
    try {
      if ('indexedDB' in window) {
        // Get all databases
        const databases = await indexedDB.databases();
        
        for (const dbInfo of databases) {
          if (dbInfo.name && (
            dbInfo.name.includes('firebase') ||
            dbInfo.name.includes('dxf') ||
            dbInfo.name.includes('level')
          )) {
            await this.deleteDatabase(dbInfo.name);

          }
        }
      }
    } catch (error) {
      console.error('❌ Error clearing IndexedDB:', error);
    }
  }

  /**
   * Διαγράφει συγκεκριμένη IndexedDB database
   */
  static deleteDatabase(name: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const deleteReq = indexedDB.deleteDatabase(name);
      deleteReq.onsuccess = () => resolve();
      deleteReq.onerror = () => reject(deleteReq.error);
      deleteReq.onblocked = () => {
        console.warn(`Database ${name} deletion blocked. Close all tabs and try again.`);
        resolve(); // Don't reject, just warn
      };
    });
  }

  /**
   * Πλήρης καθαρισμός όλου του storage
   */
  static async clearAllStorage(): Promise<void> {
    try {
      // Clear browser storage
      this.clearBrowserStorage();
      
      // Clear IndexedDB
      await this.clearIndexedDB();
      
      // Clear cache if available
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(
          cacheNames.map(cacheName => caches.delete(cacheName))
        );

      }

    } catch (error) {
      console.error('❌ Error during complete storage cleanup:', error);
      throw error;
    }
  }

  /**
   * Ελέγχει αν υπάρχει storage space για νέα δεδομένα
   */
  static async hasEnoughSpace(requiredBytes: number = 50 * 1024 * 1024): Promise<boolean> {
    try {
      const { available } = await this.checkStorageQuota();
      return available > requiredBytes;
    } catch (error) {
      console.warn('Could not check storage quota:', error);
      return true; // Assume it's okay if we can't check
    }
  }

  /**
   * Formatάρει bytes σε human readable format
   */
  static formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Αναφέρει το τρέχον storage usage
   */
  static async reportStorageUsage(): Promise<string> {
    try {
      const { usage, quota, available } = await this.checkStorageQuota();
      return `Storage: ${this.formatBytes(usage)} / ${this.formatBytes(quota)} (${this.formatBytes(available)} available)`;
    } catch (error) {
      return 'Storage usage: Unable to determine';
    }
  }
}

/**
 * Error handler για storage-related errors
 */
export class StorageErrorHandler {
  static isStorageError(error: unknown): boolean {
    if (typeof error === 'string') {
      return error.includes('FILE_ERROR_NO_SPACE') ||
             error.includes('QuotaExceededError') ||
             error.includes('DOMException') ||
             error.includes('storage');
    }
    
    if (error instanceof Error) {
      return error.message.includes('FILE_ERROR_NO_SPACE') ||
             error.message.includes('QuotaExceededError') ||
             error.message.includes('storage') ||
             error.name === 'QuotaExceededError';
    }
    
    return false;
  }

  static async handleStorageError(error: unknown): Promise<boolean> {
    if (!this.isStorageError(error)) {
      return false; // Not a storage error
    }

    console.error('🚨 Storage error detected:', error);
    
    try {
      // Report current usage
      const usage = await StorageManager.reportStorageUsage();

      // Ask user permission to clear storage
      const shouldClear = confirm(
        'Το storage του browser είναι γεμάτο. Θέλετε να καθαρίσω τα cached data για να συνεχίσετε;\n\n' +
        'Αυτό θα διαγράψει:\n' +
        '• Cached DXF files\n' +
        '• Temporary levels data\n' +
        '• Browser cache\n\n' +
        'Τα αποθηκευμένα projects δεν θα επηρεαστούν.'
      );
      
      if (shouldClear) {
        await StorageManager.clearAllStorage();
        alert('✅ Storage καθαρίστηκε! Παρακαλώ ανανεώστε τη σελίδα.');
        window.location.reload();
        return true;
      }
      
      return false;
    } catch (cleanupError) {
      console.error('❌ Error during storage cleanup:', cleanupError);
      alert('Δεν μπόρεσα να καθαρίσω το storage. Παρακαλώ καθαρίστε το browser cache manually από τις ρυθμίσεις.');
      return false;
    }
  }
}

/**
 * Wrapper για storage operations με automatic error handling
 */
export async function withStorageErrorHandling<T>(
  operation: () => Promise<T>,
  errorMessage?: string
): Promise<T | null> {
  try {
    return await operation();
  } catch (error) {
    const handled = await StorageErrorHandler.handleStorageError(error);
    
    if (!handled) {
      // If it's not a storage error or couldn't be handled, rethrow
      console.error(errorMessage || 'Operation failed:', error);
      throw error;
    }
    
    return null;
  }
}