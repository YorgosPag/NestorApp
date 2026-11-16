/**
 * @fileoverview ADR-942 Φ2 (Ε4) — **πότε** ανοίγει ο μηχανικός ό,τι του δόθηκε: η λήξη **παράγεται** από την ανάθεση,
 *   δεν πληκτρολογείται και δεν αποθηκεύεται. Κοινή σε server (πόρτα ανοίγματος) και όψη («λήγει στις …»).
 * @related issuance-request-catalog.ts (`ISSUANCE_FILE_ACCESS_GRACE_DAYS`) · issuance-assignment.ts (`isIssuanceFulfilled`)
 * @module lib/document-requests/issuance-file-access-window
 *
 * - **ολοκληρώθηκε** (νέο έγγραφο του είδους με έκδοση ≥ πρόταση) ⇒ ανοιχτό ως την έκδοση + 30 ημέρες (διορθώσεις ΠΕΑ)·
 * - αλλιώς ανοιχτό **μόνο** όσο η ανάθεση είναι αναληφθείσα (`accepted`)· ακύρωση/άρνηση ⇒ κλειστό **αμέσως**.
 * Ημέρες στην ώρα Ελλάδας (ένα ρολόι με το μητρώο, `conveyanceToday`).
 *
 * **Layering**: καθαρή συνάρτηση — μηδέν I/O.
 */

import { ISSUANCE_FILE_ACCESS_GRACE_DAYS } from '@/config/document-requests/issuance-request-catalog';
import { addDaysToDateKey } from '@/lib/calendar/date-key';
import { isIssuanceFulfilled, type IssuanceAssignmentRecord } from '@/lib/document-validity/issuance-assignment';
import { issuanceStageOf } from '@/lib/document-validity/issuance-stage';

/** Το στάδιο στο οποίο ο χώρος της ανάθεσης είναι ανοιχτός — το ίδιο με τον οικοδεσπότη έκδοσης. */
const ACCESS_OPEN_STAGE = 'accepted';

export type IssuanceFileAccessWindow =
  /** `lastDay` = τελευταία ημέρα πρόσβασης (μετά την ολοκλήρωση) · `null` ⇒ όσο διαρκεί η ανάθεση. */
  | { readonly open: true; readonly lastDay: string | null }
  /** `closed` = ακυρώθηκε/δεν αναλήφθηκε · `lapsed` = πέρασαν οι ημέρες μετά την ολοκλήρωση. */
  | { readonly open: false; readonly reason: 'closed' | 'lapsed' };

export function issuanceFileAccessWindow(
  record: IssuanceAssignmentRecord,
  latestIssuedOn: string | null,
  today: string,
): IssuanceFileAccessWindow {
  if (latestIssuedOn !== null && isIssuanceFulfilled(record, latestIssuedOn)) {
    const lastDay = addDaysToDateKey(latestIssuedOn, ISSUANCE_FILE_ACCESS_GRACE_DAYS);
    return lastDay !== null && today <= lastDay ? { open: true, lastDay } : { open: false, reason: 'lapsed' };
  }
  return issuanceStageOf(record) === ACCESS_OPEN_STAGE ? { open: true, lastDay: null } : { open: false, reason: 'closed' };
}
