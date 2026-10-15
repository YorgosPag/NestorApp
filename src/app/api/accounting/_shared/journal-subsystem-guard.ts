/**
 * Φρουροί της γενικής διαδρομής Βιβλίου Ε-Ε για εγγραφές υποσυστήματος (ADR-ACC-010 §2.1.1 Φάση 5).
 *
 * Ο ΚΑΝΟΝΑΣ ζει στο SSoT `journal-subsystem-ownership.ts`· εδώ μόνο η μετάφρασή του σε απάντηση HTTP με `errorCode`
 * (ADR-284 — ο πελάτης μεταφράζει τον κωδικό, όχι το κείμενο του διακομιστή, N.11).
 */

import 'server-only';

import { ApiError } from '@/lib/api/ApiErrorHandler';
import type { JournalEntry } from '@/subapps/accounting/types';
import {
  isManualPostingAllowed,
  isSubsystemOwnedEntry,
} from '@/subapps/accounting/services/journal/journal-subsystem-ownership';

/** Εγγραφή υποσυστήματος (π.χ. απόσβεση) ⇒ 403: αλλάζει / σβήνεται ΜΟΝΟ από το υποσύστημά της. */
export function assertNotSubsystemOwned(entry: Pick<JournalEntry, 'source' | 'category'>): void {
  if (isSubsystemOwnedEntry(entry)) {
    throw new ApiError(403, 'Journal entry is owned by a subsystem and cannot be changed here', 'JOURNAL_ENTRY_SUBSYSTEM_OWNED');
  }
}

/** Χειροκίνητη εγγραφή σε κατηγορία υποσυστήματος ή με δηλωμένη προέλευση ⇒ 422. */
export function assertManualPostingAllowed(body: { readonly category: string; readonly source?: unknown }): void {
  if (!isManualPostingAllowed(body)) {
    throw new ApiError(422, 'This category is posted only by its subsystem', 'JOURNAL_CATEGORY_SUBSYSTEM_OWNED');
  }
}
