/**
 * @fileoverview **Η ΚΑΤΑΣΤΑΣΗ ΚΑΔΟΥ ΕΝΟΣ ΑΡΧΕΙΟΥ** — τα δύο ερωτήματα που ρωτούν και οι δύο γραφείς.
 * @related ADR-032 (Enterprise Trash System) · ADR-845 §7.17 Α2 · ADR-866 §2.6.11 Β3
 * @module lib/files/file-trash-state
 *
 * 🔑 **Γιατί ζει εδώ**: ως την Α2 τα δύο αυτά ζούσαν ιδιωτικά στο `services/file-record-lifecycle`,
 * module **πελάτη** *(εισάγει `firebase/firestore`)*. Από την Α2 τον κάδο των **εταιρικών** αρχείων
 * τον γράφει ο **διακομιστής** *(`services/file-record/file-trash.service`)*, ενώ των **προσωπικών**
 * συνεχίζει ο πελάτης. Δύο γραφείς, **ένας** ορισμός του «είναι στον κάδο;» και του «πότε
 * εκκαθαρίζεται;» — αλλιώς η ιδεμποτία του ενός και το ρολόι του άλλου αποκλίνουν σιωπηλά.
 *
 * ⚠️ **Καθαρό**: κανένα `firebase/*`, κανένα `server-only` — φορτώνεται και από τις δύο πλευρές.
 */

import {
  DEFAULT_RETENTION_POLICIES,
  FILE_LIFECYCLE_STATES,
  TRASH_RETENTION_BY_CATEGORY,
  type FileCategory,
} from '@/config/domain-constants';

/** Πόσες ημέρες μένει στον κάδο αρχείο αυτής της κατηγορίας. */
export function trashRetentionDays(category: FileCategory): number {
  return TRASH_RETENTION_BY_CATEGORY[category] ?? DEFAULT_RETENTION_POLICIES.TRASH_RETENTION_DAYS;
}

/**
 * Calculate purge date based on category retention policy
 * @enterprise Uses TRASH_RETENTION_BY_CATEGORY from domain-constants
 */
export function calculatePurgeDate(category: FileCategory): Date {
  const purgeDate = new Date();
  purgeDate.setDate(purgeDate.getDate() + trashRetentionDays(category));
  return purgeDate;
}

/** Στον κάδο ήδη; — `lifecycleState` **ή** το legacy `isDeleted` (πάνε πάντα μαζί). */
export function isInTrash(data: Readonly<Record<string, unknown>>): boolean {
  return data.lifecycleState === FILE_LIFECYCLE_STATES.TRASHED || data.isDeleted === true;
}
