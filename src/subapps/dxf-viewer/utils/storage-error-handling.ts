/**
 * 🏢 ADR-092 — **Η ΑΝΑΚΤΗΣΗ ΟΤΑΝ Ο ΧΩΡΟΣ ΤΕΛΕΙΩΣΕΙ**: αναγνώριση σφάλματος quota και ο
 * διάλογος καθαρισμού.
 *
 * ## Γιατί ξεχωριστό αρχείο (N.7.1 — EXTRACT, ποτέ trim)
 * Το `storage-utils.ts` πέρασε τις **500 γραμμές** όταν η ADR-771 Φ.2 πρόσθεσε το κλειδί
 * `TABLE_SURFACE_MODE`. Το κόψιμο δεν έγινε «όπου βόλευε»: το αρχείο είχε **δύο** ευθύνες και
 * η τομή ήταν ήδη γραμμένη μέσα του.
 *
 * ```
 *   storage-utils.ts          «πώς γράφω και διαβάζω»  — κλειδιά + get/set, SSR-safe
 *   storage-error-handling.ts «τι κάνω όταν γεμίσει»   — αναγνώριση + ανάκτηση  ← εδώ
 * ```
 *
 * Η εξάρτηση είναι **μονόδρομη** (εδώ → `storage-utils`) και όχι κυκλική: η ανάκτηση ρωτά τον
 * `StorageManager` για μέτρηση και καθαρισμό, ενώ ο βασικός δρόμος ανάγνωσης/εγγραφής δεν
 * χρειάζεται ποτέ να ξέρει ότι υπάρχει διάλογος ανάκτησης.
 *
 * @module subapps/dxf-viewer/utils/storage-error-handling
 * @see utils/storage-utils.ts — τα κλειδιά, οι SSR-safe προσβάσεις και ο `StorageManager`
 */

import { derr } from '../debug';
import { StorageManager } from './storage-utils';

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

    derr('Storage', 'Storage error detected:', error);

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
        alert('✅ Storage cleared! Please refresh the page.');
        window.location.reload();
        return true;
      }

      return false;
    } catch (cleanupError) {
      derr('Storage', 'Error during storage cleanup:', cleanupError);
      alert('Could not clear storage. Please clear the browser cache manually from settings.');
      return false;
    }
  }
}

// ADR-700 §4 (2026-08-24): withStorageErrorHandling() ΔΙΑΓΡΑΦΗΚΕ — μηδέν καταναλωτές.
// Γενικός wrapper που κανένα σημείο κλήσης δεν υιοθέτησε· ο StorageErrorHandler καλείται
// απευθείας εκεί που χρειάζεται.
