/**
 * =============================================================================
 * SSoT: το ΠΡΟΧΕΙΡΟ της λειτουργικής κατάστασης ενός χώρου (ADR-777 §8.60.20)
 * =============================================================================
 *
 * Ό,τι χρειάζεται κάθε επιφάνεια που **επεξεργάζεται** την κατάσταση θέσης/αποθήκης — Γενική
 * καρτέλα, γρήγορη επεξεργασία του κτιρίου, φόρμες δημιουργίας:
 *
 * - **οι επιλογές** — το λεξιλόγιο των ακινήτων (`OPERATIONAL_STATUSES`), με τις **ίδιες** ετικέτες·
 * - **το πρόχειρο από το αποθηκευμένο** — μέσω του ΕΝΟΣ αναγνώστη, άρα και για παλιά έγγραφα·
 *   αδήλωτη κατάσταση ⇒ `''` (placeholder «Δεν έχει δηλωθεί»), **ποτέ** «Έτοιμο» από εικασία·
 * - **το patch** — μόνο όταν ο άνθρωπος **άλλαξε** κάτι (ιδεμπότητα: ίδιο πρόχειρο ⇒ κενό σώμα).
 *
 * Η **εμπορική** κατάσταση δεν ζει εδώ: έχει δικό της επεξεργαστή (`commercial-draft`, §8.60.18),
 * και η κράτηση/πώληση ανήκει στη συναλλαγή.
 *
 * @module lib/spaces/space-operational-draft
 */

import {
  OPERATIONAL_STATUSES,
  normalizeOperationalStatus,
  type OperationalStatus,
} from '@/constants/operational-statuses';
import {
  NEW_SPACE_STATUSES,
  resolveSpaceStatuses,
  type SpaceStatusSource,
} from '@/lib/spaces/space-status-split';

/** Το πρόχειρο: μία κατάσταση, ή `''` όταν δεν έχει δηλωθεί. */
export type OperationalStatusDraft = OperationalStatus | '';

/** Το «δεν έχει δηλωθεί» — ονομασμένο, όχι ωμό `''` σε κάθε καταναλωτή. */
export const UNDECLARED_OPERATIONAL_STATUS = '';

/**
 * Οι επιλογές του επιλογέα, με κλειδιά **ίδια** με τη φόρμα ακινήτου (`properties-enums`).
 * Το κλειδί φέρει το namespace του, ώστε κάθε μεταφραστής (parking · storage) να το λύνει.
 */
export const OPERATIONAL_STATUS_SELECT_OPTIONS: ReadonlyArray<{
  readonly value: OperationalStatus;
  readonly labelKey: string;
}> = OPERATIONAL_STATUSES.map((value) => ({
  value,
  labelKey: `properties-enums:operationalStatus.${value}`,
}));

/** Το πρόχειρο μιας **νέας** μονάδας — ο ίδιος κανόνας με τη γέννηση ακινήτου. */
export const NEW_SPACE_OPERATIONAL_STATUS: OperationalStatusDraft = NEW_SPACE_STATUSES.operationalStatus;

/** Αποθηκευμένος χώρος → πρόχειρο. */
export function operationalDraftOf(space: SpaceStatusSource): OperationalStatusDraft {
  return resolveSpaceStatuses(space).operationalStatus ?? UNDECLARED_OPERATIONAL_STATUS;
}

/** Ό,τι επιλέχθηκε στον επιλογέα → πρόχειρο (άγνωστη τιμή ⇒ αδήλωτο, ποτέ εικασία). */
export function parseOperationalDraft(value: string): OperationalStatusDraft {
  return normalizeOperationalStatus(value) ?? UNDECLARED_OPERATIONAL_STATUS;
}

/**
 * Πρόχειρο + αποθηκευμένος χώρος → το τμήμα του PATCH. Κενό όταν δεν δηλώθηκε ή δεν άλλαξε.
 * Η επιστροφή σε «αδήλωτο» **δεν** προσφέρεται: μια δηλωμένη κατάσταση αλλάζει σε άλλη, δεν σβήνεται.
 */
export function operationalPatchOf(
  draft: OperationalStatusDraft,
  stored: SpaceStatusSource,
): { operationalStatus?: OperationalStatus } {
  if (draft === UNDECLARED_OPERATIONAL_STATUS) return {};
  return draft === resolveSpaceStatuses(stored).operationalStatus ? {} : { operationalStatus: draft };
}
