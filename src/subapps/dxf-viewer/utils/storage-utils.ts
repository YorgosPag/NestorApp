/**
 * 🏢 ADR-092: Centralized localStorage Service
 *
 * Storage utilities για DXF Viewer
 * - SSR-safe localStorage operations
 * - Type-safe JSON serialization
 * - Consistent error handling
 *
 * ⚠️ **Η ανάκτηση από γεμάτο storage ΔΕΝ ζει εδώ** — μετακόμισε στο
 * {@link ../utils/storage-error-handling storage-error-handling.ts} όταν το αρχείο πέρασε τις
 * 500 γραμμές (N.7.1, EXTRACT ποτέ trim). Η τομή είναι κατά ευθύνη, όχι κατά γραμμή: εδώ «πώς
 * γράφω και διαβάζω», εκεί «τι κάνω όταν γεμίσει». Αν ψάχνεις `StorageErrorHandler`, είναι εκεί.
 *
 * @author Γιώργος Παγωνής + Claude Code (Anthropic AI)
 * @since 2026-01-31
 */

import { isStorageAvailable } from '@/lib/storage';
import { dwarn, derr } from '../debug';

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

  // Overlay State (per-level dynamic key prefix)
  OVERLAY_STATE: 'dxf-viewer:overlay-state:v1',
  OVERLAY_STATE_PREFIX: 'dxf-overlay-',

  // Colors
  RECENT_COLORS: 'dxf-viewer:recent-colors',

  // Το **τελευταίο** χρώμα κειμένου πίνακα (ADR-739 Φ.Ε/Φ4) — αυτό που εφαρμόζει το κύριο μισό
  // του split button χωρίς να ανοίξει μενού. **Ξεχωριστό κλειδί** από τα `RECENT_COLORS`, και
  // δεν είναι λεπτομέρεια: εκείνα είναι καθολικό LRU **όλου** του subapp, οπότε μια επιλογή
  // χρώματος περιγράμματος ή layer θα άλλαζε μόνη της το κουμπί «Α». Το Excel κρατά ένα
  // «τελευταίο» **ανά εντολή**, ακριβώς γι' αυτόν τον λόγο.
  TABLE_TEXT_COLOR: 'dxf-viewer:table-text-color:v1',

  // Το ίδιο για το **γέμισμα** (ADR-739 Φ.Ε/Φ4β). 🔴 Δεύτερο κλειδί και ΟΧΙ ένα κοινό JSON
  // `{text, fill}`: οι δύο τιμές γράφονται από **διαφορετικές χειρονομίες** (ίδιο σκεπτικό με
  // `WORKSPACE_DOCK_WIDTH` / `WORKSPACE_DOCK_MODE`), και σε κοινό κλειδί μια αλλοιωμένη ή
  // μισογραμμένη τιμή θα σκότωνε **και τα δύο** χειριστήρια αντί για το ένα.
  TABLE_FILL_COLOR: 'dxf-viewer:table-fill-color:v1',

  // ADR-750 Φ5 — **το μολύβι περιγράμματος** (χρώμα · στυλ · πάχος · διπλή).
  // 🔑 **Ένα** κλειδί με JSON, σε αντίθεση με τα δύο από πάνω — και ο λόγος είναι ο ίδιος που
  // τα χώρισε: εκεί οι δύο τιμές είναι **δύο χειριστήρια** που γράφονται από διαφορετικές
  // χειρονομίες, εδώ τα τέσσερα πεδία είναι **ένα** εργαλείο («τρέχον μολύβι», το ίδιο που ο
  // AutoCAD εκθέτει ως ένα διάλογο *Cell Border Properties*): διαβάζονται και γράφονται μαζί
  // σε κάθε εντολή. Και σε αλλοίωση, η ασφαλής κατάσταση είναι **ολόκληρο** το «Αυτόματο»
  // (κληρονομιά από το στυλ, Α20) — δηλαδή το «να πεθάνει μόνο το ένα» δεν είναι καν επιθυμητό.
  TABLE_BORDER_PENCIL: 'dxf-viewer:table-border-pencil:v1',

  // Settings (used by LocalStorageDriver)
  DXF_SETTINGS: 'dxf-settings-v2',
  CURSOR_SETTINGS: 'autocad_cursor_settings',

  // Rulers/Grid Persistence (dynamic key - used with prefix)
  RULERS_GRID_PREFIX: 'rulers-grid-persistence',

  // Constraints System (dynamic key - used with prefix)
  CONSTRAINTS_PREFIX: 'dxf-viewer-constraints',

  // Command Persistence (dynamic key - used with prefix)
  COMMAND_HISTORY_PREFIX: 'dxf-command-history',

  // Canvas Background Theme
  CANVAS_BACKGROUND: 'dxf-viewer:canvas-background-theme',
  // Custom canvas background color (hex) — used when CANVAS_BACKGROUND === 'custom'
  CANVAS_BACKGROUND_CUSTOM: 'dxf-viewer:canvas-background-custom',

  // Table presentation surface (ADR-771 Φ.2) — 'canvas' | 'sheet' | 'paper'.
  // Κατάσταση ΘΕΑΣΗΣ, ρητά έξω από το έγγραφο: γι' αυτό εδώ και όχι στο PersistedTableModel.
  TABLE_SURFACE_MODE: 'dxf-viewer:table-surface-mode',

  // Viewport State Persistence (ADR-400) — dynamic key, used with `:{fileRecordId}` suffix
  VIEWPORT_STATE_PREFIX: 'dxf-viewer:viewport-state',
  // 3D Camera State Persistence (ADR-400 §3D) — dynamic key, used with `:{fileRecordId}` suffix
  CAMERA3D_STATE_PREFIX: 'dxf-viewer:camera3d-state',

  // Match/Transfer Properties habit stats (ADR-581) — default checklist ανά (sourceType,targetType)
  MATCH_PROPERTIES_HABIT: 'dxf-viewer:match-properties-habit:v1',

  // Πλάτος της αγκυρωμένης κύριας παλέτας (ADR-724). Ανά χρήστη/περιηγητή, ουδέτερο
  // ως προς έργο/όροφο — η διάταξη είναι ιδιότητα του χώρου εργασίας, όχι του σχεδίου.
  // Το `:v1` επιτρέπει σιωπηλή απόρριψη παλιού σχήματος όταν η Φ2/Φ3 προσθέσει `mode`.
  WORKSPACE_DOCK_WIDTH: 'dxf-viewer:workspace-dock-width:v1',

  // Πλευρά αγκύρωσης της ίδιας παλέτας (ADR-724 Φ2). **Ξεχωριστό κλειδί** από το πλάτος, όχι
  // αντικείμενο `{mode,width}`: τα δύο πεδία γράφονται από τελείως διαφορετικές χειρονομίες
  // (το πλάτος στο τέλος κάθε συρσίματος, η πλευρά μία φορά στους μήνες) και έχουν διαφορετικό
  // προφίλ συνδρομητών (το πλάτος **δεν** έχει, η πλευρά έχει). Κοινό record θα σήμαινε ότι
  // κάθε σύρσιμο ειδοποιεί τους συνδρομητές της πλευράς — ακριβώς το ADR-040 πρόβλημα.
  WORKSPACE_DOCK_MODE: 'dxf-viewer:workspace-dock-mode:v1',

  // Η **τελευταία πλευρά** στην οποία ήταν αγκυρωμένη η παλέτα πριν αιωρηθεί (ADR-724 Φ3).
  // Ξεχωριστό πεδίο και όχι «παράγωγο» του `WORKSPACE_DOCK_MODE`: μόλις το mode γίνει
  // `'floating'`, η πληροφορία «πού ήταν» έχει **χαθεί** από εκείνο το κλειδί. Χωρίς αυτό, το
  // διπλό κλικ στην επικεφαλίδα θα επέστρεφε πάντα αριστερά — ενώ το Revit επιστρέφει την
  // παλέτα **εκεί που την άφησες**. Ένα τρίτο κλειδί κοστίζει λιγότερο από ένα ψέμα.
  WORKSPACE_DOCK_LAST_SIDE: 'dxf-viewer:workspace-dock-last-side:v1',

  // ADR-763 §7 — οι **τελευταίες 10 συναρτήσεις** που εισήγαγε ο χρήστης από τον διάλογο
  // «Εισαγωγή συνάρτησης» (`fx`). Είναι η προεπιλεγμένη κατηγορία του διαλόγου, όπως στο Excel.
  // 🔑 **Ξεχωριστό κλειδί από το `RECENT_COLORS`** παρότι η δομή είναι ίδια (LRU 10): εκείνο
  // κρατά hex και ελέγχεται με regex, αυτό κρατά ονόματα και ο μόνος έγκυρος έλεγχος είναι
  // «υπάρχει ακόμα στο μητρώο κλήσεων;» — δηλαδή δύο διαφορετικές ερωτήσεις εγκυρότητας που σε
  // κοινό κλειδί θα έπρεπε να συνυπάρξουν σε έναν sanitizer.
  FORMULA_RECENT_FUNCTIONS: 'dxf-viewer:formula-recent-functions:v1',
} as const;

export type StorageKey = typeof STORAGE_KEYS[keyof typeof STORAGE_KEYS] | string;

// ============================================================================
// SSR-SAFE SYNC STORAGE UTILITIES
// ============================================================================

/**
 * 🏢 SSR-safe check for localStorage availability.
 *
 * ⚠️ **Δεν υλοποιείται εδώ** — εισάγεται από το κοινό `@/lib/storage` (2026-07-29, N.18/CHECK
 * 3.28). Ήταν byte-identical αντίγραφο: δύο probes για μία αλήθεια. Η φορά εξάρτησης είναι η
 * σωστή (subapp → common)· το αντίστροφο θα ήταν αντιστροφή επιπέδων.
 *
 * ⓘ Το **υπόλοιπο** αυτού του module ΔΕΝ είναι διπλότυπο του `@/lib/storage`: εκεί τα strings
 * αποθηκεύονται ωμά, εδώ περνούν πάντα από `JSON.stringify`. Δύο **ασύμβατα συμβόλαια**, όχι
 * δύο αντίγραφα — ενοποίησή τους αλλάζει τη μορφή στον δίσκο και χάνει σιωπηλά αποθηκευμένες
 * προτιμήσεις. Βλ. `.claude-rules/pending-ratchet-work.md`.
 *
 * @see {@link isStorageAvailable} — εισάγεται στην κορυφή του αρχείου.
 */

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
    dwarn('Storage', `Failed to get "${key}":`, error);
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
      derr('Storage', `Quota exceeded for "${key}"`);
    } else {
      dwarn('Storage', `Failed to set "${key}":`, error);
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

/**
 * 🏢 Get a RAW string value from localStorage (no JSON parse) — SSR/quota-safe.
 *
 * For values persisted as bare strings (not JSON), e.g. an enum literal `'mm'` or a
 * legacy `'1'`/`'0'` flag. Pairs with `storageSetString`. Prefer `storageGet` (JSON)
 * for structured data; use this only to preserve a pre-existing raw-string format.
 *
 * @returns the stored string, or `null` if absent / storage unavailable.
 */
export function storageGetString(key: StorageKey): string | null {
  if (!isStorageAvailable()) return null;

  try {
    return localStorage.getItem(key);
  } catch (error) {
    dwarn('Storage', `Failed to get string "${key}":`, error);
    return null;
  }
}

/**
 * 🏢 Set a RAW string value to localStorage (no JSON stringify) — SSR/quota-safe.
 *
 * @returns true if successful, false on error.
 */
export function storageSetString(key: StorageKey, value: string): boolean {
  if (!isStorageAvailable()) return false;

  try {
    localStorage.setItem(key, value);
    return true;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      derr('Storage', `Quota exceeded for "${key}"`);
    } else {
      dwarn('Storage', `Failed to set string "${key}":`, error);
    }
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
      derr('Storage', 'Error clearing browser storage:', error);
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
      derr('Storage', 'Error clearing IndexedDB:', error);
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
        dwarn('Storage', `Database ${name} deletion blocked. Close all tabs and try again.`);
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
      derr('Storage', 'Error during complete storage cleanup:', error);
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
      dwarn('Storage', 'Could not check storage quota:', error);
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
