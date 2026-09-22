/**
 * =============================================================================
 * FIRESTORE LEGACY CACHE PURGE — σβήνει την IndexedDB της παλιάς ρύθμισης
 * =============================================================================
 *
 * Μέχρι 2026-09-22 η παραγωγή έτρεχε `persistentLocalCache` (ADR-367 §2.1). Από τότε
 * τρέχει `memoryLocalCache` (ADR-367 §2.5), άρα **κανείς δεν διαβάζει** τη βάση που
 * έμεινε στον δίσκο — αλλά εκείνη **εξακολουθεί να κρατά δεδομένα ενοικιαστή**, και σε
 * κοινόχρηστο υπολογιστή τα κρατά για όποιον καθίσει μετά. Τη σβήνουμε.
 *
 * 🔑 Το όνομα **δεν μαντεύεται**: είναι ο κανόνας του SDK
 * (`__PRIVATE_indexedDbStoragePrefix` + `"main"`, @firebase/firestore 4.9.3):
 *   `firestore/<persistenceKey = app.name>/<projectId>/main`  (προεπιλεγμένη βάση).
 * Τα `firestore_zombie_*` είναι οι σημαίες lease του SDK στο localStorage.
 *
 * Ιδεμποτία: σημαία στο localStorage μόνο **μετά** από επιτυχία. Αν παλιά καρτέλα
 * (προηγούμενο deploy) κρατά τη βάση ανοιχτή, το `deleteDatabase` μένει «blocked» και
 * ολοκληρώνεται όταν κλείσει· αν αποτύχει, ξαναδοκιμάζεται στην επόμενη φόρτωση.
 *
 * @module lib/firestore-legacy-cache
 * @enterprise ADR-367 §2.5
 */

import app from './firebase';

const PURGED_FLAG = 'nestor.firestore-legacy-cache-purged';
const ZOMBIE_KEY_PREFIX = 'firestore_zombie_';

function legacyDatabaseName(): string | null {
  const projectId = app.options.projectId;
  return projectId ? `firestore/${app.name}/${projectId}/main` : null;
}

function removeZombieLeaseKeys(): void {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (key?.startsWith(ZOMBIE_KEY_PREFIX)) keys.push(key);
  }
  keys.forEach((key) => localStorage.removeItem(key));
}

/**
 * Σβήνει μία φορά ανά browser την IndexedDB + τις σημαίες lease της παλιάς
 * `persistentLocalCache`. Fire-and-forget: δεν μπλοκάρει τίποτα, δεν πετά ποτέ.
 */
export function purgeLegacyFirestoreCache(): void {
  if (typeof window === 'undefined' || typeof indexedDB === 'undefined') return;
  try {
    if (localStorage.getItem(PURGED_FLAG) === '1') return;
    const name = legacyDatabaseName();
    if (!name) return;
    removeZombieLeaseKeys();
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => {
      try {
        localStorage.setItem(PURGED_FLAG, '1');
      } catch {
        // Storage αποκλεισμένο — ξαναδοκιμάζεται στην επόμενη φόρτωση, ακίνδυνα.
      }
    };
  } catch {
    // Ιδιωτική περιήγηση / αποκλεισμένο storage: τίποτα να σβηστεί.
  }
}
