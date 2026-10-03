/**
 * =============================================================================
 * Conveyance — «από ΠΟΙΑ πόρτα ανεβαίνει η νέα έκδοση ενός σταλμένου;» (ADR-901 Φ4.5 · §14.6)
 * =============================================================================
 *
 * Η διαδοχή απαιτεί **ίδια θέση** (`lib/files/succession-identity`: οντότητα · τομέας · κατηγορία · σκοπός). Η θέση
 * ενός αρχείου υπόθεσης ορίζεται από το entry point με το οποίο ανέβηκε. Άρα η νέα έκδοση πρέπει να ανέβει από το
 * entry point της γραμμής **του οποίου ο σκοπός είναι ο σκοπός του σταλμένου** — όχι από το «πρώτο» της γραμμής.
 *
 * Το αντίστροφο ερώτημα του server (`conveyance-case-evidence.server.ts` → `newerVersionOf`: entry point της αποστολής
 * → σκοπός). Απουσία ⇒ `undefined` ⇒ η οθόνη **δεν** προσφέρει νέα έκδοση· ποτέ μαντεψιά που θα έβγαινε
 * `identity-mismatch` από τον κριτή.
 *
 * ⚠️ Ξεχωριστό φύλλο από το `contribution-policy`: φέρνει το μητρώο entry points, που φορτώνεται μόνο στον
 *    δυναμικό διάλογο — όχι στο route slice της γραμμής (ADR-744 · CHECK 3.34).
 *
 * @module lib/conveyance/contribution-revision
 */

import { ENTITY_TYPES } from '@/config/domain-constants';
import type { ChecklistItem } from '@/config/conveyance-checklist/types';
import { findEntryPoint } from '@/config/upload-entry-points/queries';
import type { UploadEntryPoint } from '@/config/upload-entry-points/types';
import { contributionEntryPointIds } from './contribution-policy';

/** Το entry point της γραμμής με τον **ίδιο** σκοπό με το σταλμένο αρχείο — ή `undefined`. */
export function revisionEntryPoint(item: ChecklistItem, purpose: string): UploadEntryPoint | undefined {
  return contributionEntryPointIds(item)
    .map((id) => findEntryPoint(ENTITY_TYPES.CONVEYANCE_CASE, id))
    .find((entryPoint): entryPoint is UploadEntryPoint => entryPoint !== undefined && entryPoint.purpose === purpose);
}
