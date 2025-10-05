// Storage utilities για DXF Viewer
// Χειρισμός storage errors και cleanup

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