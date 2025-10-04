/**
 * USEAUTOSAVESETTINGS HOOK
 * Γενικός hook για αυτόματη αποθήκευση ρυθμίσεων DXF
 *
 * Αυτός ο hook παρέχει αυτόματη αποθήκευση για όλες τις ρυθμίσεις
 * των γενικών καρτελών στο floating panel (Γραμμές, Κείμενο, Grips)
 *
 * Χαρακτηριστικά:
 * - Debounced save (500ms) για αποφυγή υπερβολικών εγγραφών
 * - Type-safe με generic types
 * - Εμφάνιση status για debugging
 * - Automatic localStorage persistence
 */

import { useEffect, useRef, useCallback } from 'react';

export interface AutoSaveConfig<T> {
  /** Το κλειδί για το localStorage */
  storageKey: string;
  /** Τα δεδομένα που θα αποθηκευτούν */
  data: T;
  /** Ενεργοποίηση/απενεργοποίηση auto-save */
  enabled?: boolean;
  /** Καθυστέρηση debounce σε ms (default: 500) */
  debounceMs?: number;
  /** Callback όταν γίνει αποθήκευση */
  onSaved?: (data: T) => void;
  /** Callback όταν προκύψει σφάλμα */
  onError?: (error: Error) => void;
}

export interface AutoSaveStatus {
  /** Κατάσταση αποθήκευσης */
  status: 'idle' | 'saving' | 'saved' | 'error';
  /** Τελευταία αποθήκευση */
  lastSaved: Date | null;
  /** Μήνυμα σφάλματος αν υπάρχει */
  error: string | null;
}

/**
 * Hook για αυτόματη αποθήκευση ρυθμίσεων
 *
 * @example
 * ```typescript
 * const autoSave = useAutoSaveSettings({
 *   storageKey: 'dxf-line-settings',
 *   data: lineSettings,
 *   enabled: true,
 *   onSaved: (data) => console.log('Line settings saved:', data)
 * });
 *
 * // Στο UI: {autoSave.status === 'saved' && '✅ Αποθηκεύτηκε'}
 * ```
 */
export function useAutoSaveSettings<T>({
  storageKey,
  data,
  enabled = true,
  debounceMs = 500,
  onSaved,
  onError
}: AutoSaveConfig<T>): AutoSaveStatus {

  const saveTimeoutRef = useRef<NodeJS.Timeout>();
  const lastSavedRef = useRef<Date | null>(null);
  const statusRef = useRef<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const errorRef = useRef<string | null>(null);

  // Trigger re-render when status changes (simplified state management)
  const forceUpdate = useCallback(() => {
    // Using a hack to force re-render without useState
    const event = new CustomEvent('autosave-status-change', {
      detail: { storageKey, status: statusRef.current }
    });
    window.dispatchEvent(event);
  }, [storageKey]);

  const saveData = useCallback(async (dataToSave: T) => {
    if (!enabled) return;

    try {
      statusRef.current = 'saving';
      errorRef.current = null;
      forceUpdate();

      // Προσθέτουμε timestamp για tracking
      const dataWithTimestamp = {
        ...dataToSave,
        __autosave_timestamp: Date.now(),
        __autosave_key: storageKey
      };

      localStorage.setItem(storageKey, JSON.stringify(dataWithTimestamp));

      lastSavedRef.current = new Date();
      statusRef.current = 'saved';
      forceUpdate();

      console.log(`✅ [AutoSave] Αποθηκεύτηκαν οι ρυθμίσεις: ${storageKey}`);

      onSaved?.(dataToSave);

      // Reset status μετά από 2 δευτερόλεπτα
      setTimeout(() => {
        statusRef.current = 'idle';
        forceUpdate();
      }, 2000);

    } catch (error) {
      statusRef.current = 'error';
      errorRef.current = error instanceof Error ? error.message : 'Άγνωστο σφάλμα';
      forceUpdate();

      console.error(`❌ [AutoSave] Σφάλμα αποθήκευσης για ${storageKey}:`, error);
      onError?.(error instanceof Error ? error : new Error(String(error)));
    }
  }, [storageKey, enabled, onSaved, onError, forceUpdate]);

  // Auto-save effect με debouncing
  useEffect(() => {
    if (!enabled || !data) return;

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Set debounced save
    saveTimeoutRef.current = setTimeout(() => {
      saveData(data);
    }, debounceMs);

    // Cleanup
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [data, enabled, debounceMs, saveData]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  return {
    status: statusRef.current,
    lastSaved: lastSavedRef.current,
    error: errorRef.current
  };
}

/**
 * Hook για φόρτωση αποθηκευμένων ρυθμίσεων
 */
export function useLoadSavedSettings<T>(storageKey: string): T | null {
  const loadSettings = useCallback((): T | null => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (!stored) return null;

      const parsed = JSON.parse(stored);

      // Αφαιρούμε τα metadata πριν επιστρέψουμε τα δεδομένα
      const { __autosave_timestamp, __autosave_key, ...actualData } = parsed;

      console.log(`📂 [AutoSave] Φορτώθηκαν ρυθμίσεις από: ${storageKey}`);
      return actualData as T;
    } catch (error) {
      console.error(`❌ [AutoSave] Σφάλμα φόρτωσης από ${storageKey}:`, error);
      return null;
    }
  }, [storageKey]);

  return loadSettings();
}

/**
 * Utility για καθαρισμό όλων των auto-saved settings
 */
export function clearAllAutoSavedSettings(prefix = 'dxf-'): void {
  try {
    const keysToRemove: string[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix)) {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach(key => localStorage.removeItem(key));

    console.log(`🗑️ [AutoSave] Καθαρίστηκαν ${keysToRemove.length} αποθηκευμένες ρυθμίσεις`);
  } catch (error) {
    console.error('❌ [AutoSave] Σφάλμα καθαρισμού:', error);
  }
}