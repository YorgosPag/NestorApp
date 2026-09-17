/**
 * =============================================================================
 * Ο ΚΡΙΤΗΣ ΔΕΣΜΕΥΣΗΣ ΑΡΧΕΙΟΥ — καθαρός, χωρίς SDK (ADR-864 §21)
 * =============================================================================
 *
 * **Το ερώτημα**: *«επιτρέπεται να σβηστεί ΟΡΙΣΤΙΚΑ αυτό το αρχείο τώρα;»*
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔑 ΣΙΩΠΗΛΗ ΔΕΣΜΕΥΣΗ — ΟΠΩΣ ΤΑ GOOGLE VAULT · BOX GOVERNANCE · MICROSOFT PURVIEW
 * ─────────────────────────────────────────────────────────────────────────────
 * Η δέσμευση **δεν** απαγορεύει τον κάδο. Ο χρήστης που «σβήνει» αρχείο σε δέσμευση
 * το βλέπει να φεύγει· αυτό που **δεν** γίνεται ποτέ είναι η **οριστική** διαγραφή
 * (Firestore **και** bytes) ώσπου να αρθεί. Vault: *«the user can't access the file
 * anymore but the file isn't purged»*· Box: *«users can delete content under Legal
 * Hold … a silent legal hold»*. Γι' αυτό αυτός ο κριτής **δεν** ρωτιέται από τον κάδο —
 * ρωτιέται από **κάθε** διαδρομή οριστικής διαγραφής.
 *
 * ⚠️ **Χωρίς `server-only`, επίτηδες**: τον ρωτούν και ο διακομιστής (`isFileHeld`) και
 * το client module του κύκλου ζωής — ένας κριτής, όχι δύο αντίγραφα που αποκλίνουν.
 *
 * @module lib/files/file-hold
 * @see services/file-record/file-hold.service — ο ΕΝΑΣ γραφέας
 */

import { HOLD_TYPES, type HoldType } from '@/config/domain-constants';
import { normalizeToMillisOrNull } from '@/lib/date-local';

/**
 * **Τα κλειδιά της δέσμευσης** — έξοδος **μόνο** του γραφέα του διακομιστή (AIP-216
 * output-only). Ο `holdCustodyUnchanged()` του `firestore.rules` απαριθμεί **ακριβώς**
 * αυτά· η άγκυρα `file-hold.test.ts` κοκκινίζει σε απόκλιση.
 */
export const FILE_HOLD_FIELDS = [
  'hold',
  'holdPlacedBy',
  'holdPlacedAt',
  'holdReason',
  'holdReleasedBy',
  'holdReleasedAt',
  'retentionUntil',
] as const;

/** Οι δεσμεύσεις που **τοποθετούνται** — το `none` είναι η απουσία, όχι είδος. */
export type PlaceableHoldType = Exclude<HoldType, typeof HOLD_TYPES.NONE>;

const PLACEABLE_HOLD_TYPES: readonly PlaceableHoldType[] = [HOLD_TYPES.LEGAL, HOLD_TYPES.REGULATORY, HOLD_TYPES.ADMIN];

/** Φρουρός του σύρματος: `unknown → PlaceableHoldType`. */
export function isPlaceableHoldType(value: unknown): value is PlaceableHoldType {
  return typeof value === 'string' && (PLACEABLE_HOLD_TYPES as readonly string[]).includes(value);
}

/** Ανώτατο μήκος αιτιολογίας δέσμευσης — κείμενο συμμόρφωσης, όχι έγγραφο. */
export const HOLD_REASON_MAX_LENGTH = 500;

/**
 * **Η αιτιολογία από το σύρμα** — κομμένη, μη κενή, εντός ορίου — ή `null` (⇒ 400).
 * Κοινή σε **κάθε** δέσμευση (αρχείο · αποδεικτικό): Vault και Purview απαιτούν όνομα/λόγο.
 */
export function holdReasonOf(value: unknown): string | null {
  const reason = typeof value === 'string' ? value.trim() : '';
  return reason.length === 0 || reason.length > HOLD_REASON_MAX_LENGTH ? null : reason;
}

/** Το ελάχιστο σχήμα που χρειάζεται ο κριτής — δέχεται `FileRecord` ή ωμό έγγραφο. */
export interface FileHoldSubject {
  readonly hold?: HoldType | string | null;
  readonly retentionUntil?: unknown;
}

/** Υπάρχει ενεργή (μη `none`) δέσμευση; Απουσία ⇒ όχι. */
export function hasActiveHold(subject: FileHoldSubject): boolean {
  return typeof subject.hold === 'string' && subject.hold !== HOLD_TYPES.NONE;
}

/**
 * **Δεσμεύεται το αρχείο;** — δέσμευση **ή** διατήρηση που δεν έληξε.
 *
 * 🔒 **Fail-closed**: `retentionUntil` που **δεν διαβάζεται** ⇒ δεσμεύεται. Ο παλιός
 * έλεγχος (`new Date(x) > new Date()`) έδινε `false` σε άκυρη ημερομηνία, δηλαδή
 * αλλοιωμένη διατήρηση **άνοιγε** τη διαγραφή.
 */
export function isHoldActive(subject: FileHoldSubject, nowMillis: number): boolean {
  if (hasActiveHold(subject)) return true;
  const retention = subject.retentionUntil;
  if (retention === undefined || retention === null) return false;
  const retainUntil = normalizeToMillisOrNull(retention);
  return retainUntil === null || retainUntil > nowMillis;
}
