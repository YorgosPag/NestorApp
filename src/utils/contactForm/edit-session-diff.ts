/**
 * @module edit-session-diff
 * @description **Η συνεδρία επεξεργασίας κρατά ΜΟΝΟ ό,τι διαφέρει από τη βάση** (ADR-323 · ADR-327 §8.5.4).
 *
 * 🔴 **ΓΙΑΤΙ ΥΠΑΡΧΕΙ — μετρημένο ζωντανά 2026-10-29** (`/test-harness/contact-mutation?scenario=server-company`):
 * αλλαγή **ενός** πεδίου (τύπος τηλεφώνου) έστελνε στον γραφέα **~120 κλειδιά** ως «dirty diff». Οι ενότητες
 * της φόρμας γράφουν `setFormData({ ...formData, phones })` όπου `formData` είναι η **συγχωνευμένη** προβολή,
 * οπότε ο setter που ήταν σκέτο `useState` αποθήκευε **ολόκληρη** τη φόρμα. Το Ιστορικό της MACON χρέωσε
 * στον άνθρωπο `activityType`, διευθύνσεις και οικισμό που δεν άγγιξε.
 *
 * ✅ **Η πρακτική των μεγάλων**: «αλλαγμένο» = **διαφέρει από τη βάση**, όχι «πέρασε από τον setter»
 * (React Hook Form `dirtyFields`, Formik `dirty`, Google People API `updatePersonFields`). Άρα και ένα πεδίο
 * που ο άνθρωπος **επαναφέρει** στην αρχική τιμή παύει να είναι αλλαγή — η ερώτηση «θα χαθούν αλλαγές;» λέει
 * την αλήθεια.
 *
 * ⚠️ **Το σύνορο είναι ο setter, όχι οι ενότητες**: διορθώνει όλες τις τωρινές `{ ...formData, x }` κλήσεις
 * **και** όσες γραφτούν αύριο, χωρίς να αγγίξει καμία.
 *
 * **Layering**: καθαρή — καμία εξάρτηση από React ή Firebase.
 */

import { dequal } from 'dequal';
import { isClearedFormValue } from '@/utils/contactForm/utils/data-cleaning';

/** «Απόν» και «αδειασμένο» είναι η ΙΔΙΑ κατάσταση για τον γραφέα (ADR-323 — `deleteField()` ή τίποτα). */
function isAbsentFormValue(value: unknown): boolean {
  return value === undefined || isClearedFormValue(value);
}

/** Ίδια τιμή για τον γραφέα; Δύο «κενά» είναι ίσα, αλλιώς βαθιά σύγκριση (`dequal`, το SSoT του έργου). */
export function isSameFormValue(a: unknown, b: unknown): boolean {
  if (isAbsentFormValue(a) && isAbsentFormValue(b)) return true;
  return dequal(a, b);
}

/** Τα κλειδιά του `next` που **διαφέρουν** από τη βάση — τίποτα άλλο. */
export function diffAgainstBaseline<T extends object>(baseline: T, next: Partial<T>): Partial<T> {
  const diff: Partial<T> = {};
  for (const key of Object.keys(next) as Array<keyof T>) {
    if (!isSameFormValue(next[key], baseline[key])) {
      diff[key] = next[key];
    }
  }
  return diff;
}

/** Ό,τι δέχεται ο setter της συνεδρίας: ολόκληρη προβολή φόρμας, ή updater πάνω στη συγχωνευμένη προβολή. */
export type EditSessionAction<T extends object> = Partial<T> | ((merged: T) => Partial<T>);

function isEditSessionUpdater<T extends object>(
  action: EditSessionAction<T>,
): action is (merged: T) => Partial<T> {
  return typeof action === 'function';
}

/**
 * Η επόμενη διαφορά της συνεδρίας. Ο updater παίρνει τη **συγχωνευμένη** προβολή (βάση + αλλαγές) —
 * αυτό που οι ενότητες ήδη υπέθεταν ότι είναι το `prev`. Το αποτέλεσμα, ό,τι σχήμα κι αν έχει
 * (ολόκληρη φόρμα ή μόνο τα αλλαγμένα), περνά από τη σύγκριση με τη βάση. Κλειδί που λείπει
 * από το αποτέλεσμα = «δεν αλλάχτηκε» (π.χ. `setEditedData({})` = άδεια συνεδρία).
 */
export function nextEditSessionDiff<T extends object>(
  baseline: T,
  current: Partial<T>,
  action: EditSessionAction<T>,
): Partial<T> {
  const next = isEditSessionUpdater(action) ? action({ ...baseline, ...current }) : action;
  return diffAgainstBaseline(baseline, next);
}
