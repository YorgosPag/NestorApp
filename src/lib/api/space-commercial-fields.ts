/**
 * =============================================================================
 * SSoT: η ΕΓΓΡΑΦΗ εμπορικών στοιχείων ενός χώρου — PATCH (ADR-777 §8.60.18)
 * =============================================================================
 *
 * Θέσεις στάθμευσης και αποθήκες δηλώνουν διάθεση (πώληση · ενοικίαση · και τα δύο) και
 * **τιμή ανά ρόλο** με το **ΙΔΙΟ** λεξιλόγιο με τα ακίνητα (`COMMERCIAL_STATUSES`). Ως τις
 * 2026-09-18 το PATCH τα **πετούσε σιωπηλά**: το `.passthrough()` τα άφηνε να περάσουν τον
 * έλεγχο και ο mapper δεν τα διάβαζε ποτέ — κανείς δεν μπορούσε να δηλώσει θέση προς ενοικίαση.
 *
 * Τρεις κανόνες, και ο server τους επιβάλλει — όχι μόνο το UI:
 *
 * 1. **Ο επεξεργαστής δηλώνει μόνο καταστάσεις αγοράς** (`EDITOR_COMMERCIAL_STATUSES`).
 *    Κράτηση · πώληση · μίσθωση είναι **συναλλαγές** με αγοραστή, και γράφονται από τη δική
 *    τους διαδρομή (`appurtenance-sync`, ADR-199).
 * 2. **Ό,τι κατέχει συναλλαγή δεν αλλάζει από φόρμα** — ούτε κατάσταση ούτε τιμή. Αλλιώς μια
 *    γρήγορη επεξεργασία θα «ξεπουλούσε» σιωπηλά μια πωλημένη θέση, με τον αγοραστή γραμμένο.
 * 3. **Γράφονται διαδρομές, όχι το αντικείμενο** (`commercial.rentPrice`) — ιδιοκτήτες,
 *    προκαταβολή, ημερομηνίες και σύνδεση με ακίνητο μένουν ανέγγιχτα.
 *
 * ⚠️ Καθαρό (χωρίς `server-only`), για τον ίδιο λόγο με το `space-entity-fields.ts`: να
 * ελέγχεται σε απλό jest.
 *
 * @module lib/api/space-commercial-fields
 * @see ADR-777 §8.60.18 · ADR-199 (παρακολουθήματα) · ADR-696 (space-entity route SSoT)
 */

import { z } from 'zod';
import {
  isEditorCommercialStatus,
  isTransactionOwnedCommercialStatus,
  normalizeCommercialStatus,
  type CommercialStatus,
} from '@/constants/commercial-statuses';
import type { CommercialPriceField } from '@/lib/properties/commercial-draft';

/** Ένα ποσό: θετικό ή ρητό `null` («δεν δηλώνεται πια»). Ίδιο ανώτατο όριο με το παλιό `price`. */
const amount = z.number().positive().max(999_999_999).nullable().optional();

/**
 * Το σχήμα των εμπορικών πεδίων σε κάθε PATCH χώρου — προστίθεται δίπλα στο
 * `SPACE_COMMON_UPDATE_FIELDS`. Το `commercial` είναι **`strict`**: ιδιοκτήτες, τελική τιμή ή
 * προκαταβολή **δεν** γράφονται από εδώ (είναι της συναλλαγής).
 */
export const SPACE_COMMERCIAL_UPDATE_FIELDS = {
  commercialStatus: z.string().max(50).optional(),
  commercial: z.object({ askingPrice: amount, rentPrice: amount }).strict().optional(),
} as const;

/** Το αποτέλεσμα — κλειστή ένωση: ο handler **δεν μπορεί** να ξεχάσει την άρνηση. */
export type SpaceCommercialWrite =
  | { readonly kind: 'none' }
  | { readonly kind: 'write'; readonly fields: Readonly<Record<string, CommercialStatus | number | null>> }
  | { readonly kind: 'rejected'; readonly status: 400 | 409; readonly reason: SpaceCommercialRejection };

/** Γιατί αρνήθηκε — σταθερά ονόματα για logs και tests, όχι κείμενο οθόνης. */
export type SpaceCommercialRejection = 'not-editor-status' | 'transaction-owned';

/** Μήνυμα HTTP ανά άρνηση (αγγλικά, όπως κάθε μήνυμα API του έργου). */
export const SPACE_COMMERCIAL_REJECTION_MESSAGE: Readonly<Record<SpaceCommercialRejection, string>> = {
  'not-editor-status': 'Commercial status can only be set to a market status here; reservations and sales go through the sales flow',
  'transaction-owned': 'This space is held by a reservation, sale or lease; revert the transaction before editing its commercial data',
};

/** Τα πεδία ποσού που δέχεται ο επεξεργαστής — ίδια με το `strict` σχήμα παραπάνω. */
const EDITOR_AMOUNT_FIELDS: readonly CommercialPriceField[] = ['askingPrice', 'rentPrice'];

/**
 * Οι εγγραφές ποσών ως διαδρομές — **μόνο** όσα ζητήθηκαν ρητά.
 *
 * Το σώμα έχει ήδη περάσει το σχήμα zod· εδώ διαβάζεται **ξανά** με φρουρό τύπου, γιατί ο
 * handler είναι γενικός (`Record<string, unknown>`) και ένα `as` θα έκρυβε ακριβώς το είδος
 * λάθους που αυτό το αρχείο υπάρχει για να σταματά.
 */
function amountPaths(commercial: unknown, stored: unknown): Record<string, number | null> {
  const paths: Record<string, number | null> = {};
  if (!isRecord(commercial)) return paths;
  const current = isRecord(stored) ? stored : {};
  for (const field of EDITOR_AMOUNT_FIELDS) {
    const value = commercial[field];
    const valid = value === null || (typeof value === 'number' && value > 0);
    // Ίδιο ποσό με το αποθηκευμένο ⇒ δεν είναι αλλαγή (απουσία ≡ `null`).
    if (valid && value !== (current[field] ?? null)) paths[`commercial.${field}`] = value;
  }
  return paths;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Σώμα PATCH + αποθηκευμένο έγγραφο → τι γράφεται.
 *
 * 🔑 **Ιδεμπότητα**: κατάσταση ίδια με την αποθηκευμένη και κανένα ποσό ⇒ `none` — ακόμη και
 * σε χώρο που κατέχει συναλλαγή (δεν αρνούμαστε ένα «τίποτα»).
 */
export function mapSpaceCommercialFields(
  body: Readonly<Record<string, unknown>>,
  existing: Readonly<Record<string, unknown>>,
): SpaceCommercialWrite {
  const fields: Record<string, CommercialStatus | number | null> = amountPaths(body.commercial, existing.commercial);
  const currentStatus = normalizeCommercialStatus(existing.commercialStatus);

  if (body.commercialStatus !== undefined) {
    const requested = normalizeCommercialStatus(body.commercialStatus);
    // Ίδια με την αποθηκευμένη ⇒ δεν είναι αίτημα αλλαγής (ιδεμπότητα — ακόμη κι αν είναι «sold»).
    if (requested === null || requested !== currentStatus) {
      if (!requested || !isEditorCommercialStatus(requested)) {
        return { kind: 'rejected', status: 400, reason: 'not-editor-status' };
      }
      fields.commercialStatus = requested;
    }
  }

  if (Object.keys(fields).length === 0) return { kind: 'none' };
  if (isTransactionOwnedCommercialStatus(currentStatus)) {
    return { kind: 'rejected', status: 409, reason: 'transaction-owned' };
  }
  return { kind: 'write', fields };
}
