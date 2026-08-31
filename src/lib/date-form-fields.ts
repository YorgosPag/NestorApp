/**
 * **ΗΜΕΡΟΜΗΝΙΑ + ΩΡΑ ΩΣ ΔΥΟ ΠΕΔΙΑ ΦΟΡΜΑΣ** — σύνθεση και αποσύνθεση.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΞΕΧΩΡΙΣΤΟ ΑΡΧΕΙΟ ΚΑΙ ΟΧΙ ΑΚΟΜΑ ΜΙΑ ΓΡΑΜΜΗ ΣΤΟ `date-local`
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το {@link module:lib/date-local} απαντά *«**τι στιγμή** είναι αυτό;»* — κανονικοποίηση,
 * σύγκριση, διαστήματα. Οι δύο συναρτήσεις εδώ απαντούν **άλλη** ερώτηση:
 * *«πώς **δείχνεται** μια στιγμή σε ΔΥΟ χωριστά πεδία που γεμίζει άνθρωπος, και πώς
 * ξαναγίνεται μία;»*. Είναι λεξιλόγιο **φόρμας**, όχι λεξιλόγιο **χρόνου** — γι' αυτό
 * οι τρεις καταναλωτές τους είναι όλοι διάλογοι CRM και **κανένας** μηχανή.
 *
 * ⚠️ Η αφορμή ήταν το όριο των **500 γραμμών** (N.7.1) — αλλά η **γραμμή κοπής** δεν
 * είναι το όριο: είναι η ευθύνη. Κόβεται **ολόκληρη η ερώτηση**, όχι όσες γραμμές
 * χρειάζονται για να πέσει ο αριθμός *(EXTRACT, ποτέ trim)*.
 *
 * @see ADR-584 — η κεντρικοποίηση που γέννησε τις δύο συναρτήσεις.
 */

import { normalizeToDate } from './date-local';

/**
 * Ημερομηνία + ώρα `"HH:MM"` → ένα Date.
 *
 * SSoT για το `time.split(':').map(Number)` + `setHours(h, m, 0, 0)` ζευγάρι, που
 * ήταν αντιγραμμένο σε 4 σημεία (CalendarCreateDialog, TaskEditDialog,
 * TaskDetailPanel ×2). Δεν μεταλλάσσει το `date` που του δίνεις.
 *
 * Μη έγκυρη ώρα → η ημερομηνία επιστρέφεται με μηδενισμένη ώρα, ποτέ `Invalid Date`.
 *
 * @see ADR-584
 */
export function combineDateAndTime(date: Date, time: string): Date {
  const [hours, minutes] = time.split(':').map(Number);
  const combined = new Date(date);
  combined.setHours(
    Number.isFinite(hours) ? hours : 0,
    Number.isFinite(minutes) ? minutes : 0,
    0,
    0
  );
  return combined;
}

/**
 * Timestamp / Date / string / number → `{ date, time: "HH:MM" }`.
 *
 * Η αντίστροφη του {@link combineDateAndTime}, για να γεμίζουν τα form fields από
 * ένα αποθηκευμένο `dueDate`. Χτίζει πάνω στο `normalizeToDate` αντί να
 * ξαναελέγχει μόνη της για `toDate` — έτσι πιάνει και τα JSON-serialised
 * Timestamps (`{ seconds }` / `{ _seconds }`) που η παλιά ad-hoc `parseDueDate`
 * έχανε.
 *
 * @see ADR-584
 */
export function splitDateAndTime(
  val: unknown,
  fallbackTime = '09:00'
): { date: Date; time: string } {
  const d = normalizeToDate(val);
  if (!d) return { date: new Date(), time: fallbackTime };
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return { date: d, time: `${hh}:${mm}` };
}
