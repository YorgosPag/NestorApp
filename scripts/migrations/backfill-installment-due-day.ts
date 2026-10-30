/**
 * =============================================================================
 * BACKFILL — η λήξη δόσης ως ΗΜΕΡΑ `YYYY-MM-DD` (`Installment.dueDate`, ADR-234 2026-10-29)
 * =============================================================================
 *
 * **Γιατί**: ως τις 2026-10-29 η λήξη γραφόταν ως ISO στιγμή (wizard: τοπική ώρα → `toISOString()` · φόρμα: μεσάνυχτα
 * UTC). Οι αναγνώστες τη διαβάζουν ήδη σωστά (`installmentDueDay` — στιγμή ⇒ η ημέρα της στην Αθήνα), άρα η
 * μετάπτωση **δεν αλλάζει καμία ημερομηνία που βλέπει ο άνθρωπος**: μετατρέπει την ερμηνεία σε αποθηκευμένη τιμή,
 * ώστε η βάση να έχει ΜΙΑ μορφή και να μπορεί να φύγει η μεταβατική ανοχή στιγμής του `installment-due-date.ts`.
 *
 * ┌─ ΣΥΜΒΟΛΑΙΟ ────────────────────────────────────────────────────────────────┐
 * │ 🔒 Απόφαση: ΑΠΟΚΛΕΙΣΤΙΚΑ `installmentDueDay` — ο ίδιος κανόνας με κάθε      │
 * │    αναγνώστη (ληξιπρόθεσμα · aging · ταμειακές ροές · φόρμα).              │
 * │ 🔒 Γράφει ΜΟΝΟ το `installments` (ίδιος πίνακας, μόνο το `dueDate` αλλαγμένο)│
 * │    — ούτε `updatedAt`, ούτε ποσά/καταστάσεις.                               │
 * │ 🔒 Ιδεμποτική: όλες οι λήξεις ήδη ημέρες ⇒ καμία γραφή.                     │
 * │ 🔒 Ταυτοχρονισμός: ο πίνακας ξαναγράφεται ΟΛΟΚΛΗΡΟΣ (το Firestore δεν      │
 * │    ενημερώνει στοιχείο πίνακα) ⇒ γραφή με προϋπόθεση `lastUpdateTime`.     │
 * │    Πληρωμή που καταγράφηκε στο ενδιάμεσο ⇒ η γραφή ΑΠΟΡΡΙΠΤΕΤΑΙ (σύγκρουση),│
 * │    ποτέ δεν χάνεται· ξανατρέξε (ιδεμποτική).                                │
 * │ ⛔ Μη αναγνώσιμη λήξη ⇒ ΑΝΑΦΟΡΑ, το πλάνο δεν αγγίζεται, ποτέ εικασία.      │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * Το αποθηκευμένο `commercial.paymentSummary.nextInstallmentDate` του ακινήτου ανανεώνεται στον επόμενο συγχρονισμό
 * περίληψης (βγαίνει πλέον πάντα ημέρα, `payment-plan-core`)· μέχρι τότε διαβάζεται σωστά και ως στιγμή.
 *
 * USAGE (μόνο με εντολή Giorgio — dry-run ΠΡΩΤΑ):
 * ```bash
 * npx tsx scripts/migrations/backfill-installment-due-day.ts            # dry-run (μέτρηση)
 * npx tsx scripts/migrations/backfill-installment-due-day.ts --execute  # εγγραφή
 * ```
 *
 * @see src/lib/payment-plan/installment-due-day.ts · ADR-234 §11 (2026-10-29)
 */

import admin from 'firebase-admin';

import { SUBCOLLECTIONS } from '../../src/config/firestore-collections';
import { isCalendarDay } from '../../src/lib/date/calendar-day';
import { installmentDueDay } from '../../src/lib/payment-plan/installment-due-day';
import { applyEnvLocal } from '../_shared/loadEnvLocal';
import { initAdminApp } from '../_shared/firebaseAdminOps';

/** Η απόφαση για ένα πλάνο — ονομασμένη, ποτέ boolean. */
export type DueDayPlan =
  | { readonly kind: 'write'; readonly installments: readonly Record<string, unknown>[]; readonly converted: number }
  | { readonly kind: 'noop' }
  | { readonly kind: 'unresolved'; readonly indexes: readonly number[] };

/** **Τι πρέπει να γραφτεί** σε αυτό το πλάνο — χωρίς δίσκο. */
export function planInstallmentDueDays(raw: Record<string, unknown>): DueDayPlan {
  const list = raw.installments;
  if (!Array.isArray(list) || list.length === 0) return { kind: 'noop' };

  const unreadable: number[] = [];
  let converted = 0;
  const installments = list.map((item: unknown, index): Record<string, unknown> => {
    const installment = (item ?? {}) as Record<string, unknown>;
    if (isCalendarDay(installment.dueDate)) return installment;
    const day = installmentDueDay(installment.dueDate);
    if (day === null) {
      unreadable.push(index);
      return installment;
    }
    converted += 1;
    return { ...installment, dueDate: day };
  });

  if (unreadable.length > 0) return { kind: 'unresolved', indexes: unreadable };
  return converted === 0 ? { kind: 'noop' } : { kind: 'write', installments, converted };
}

/** Το Firestore απορρίπτει τη γραφή με `FAILED_PRECONDITION` (κωδικός 9) όταν άλλαξε το `updateTime`. */
function isPreconditionFailure(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 9;
}

async function main(): Promise<void> {
  const execute = process.argv.includes('--execute');
  applyEnvLocal();
  const { db, projectId } = initAdminApp(admin);
  console.log(`\nΛήξη δόσης ως ημέρα (ADR-234) — ${execute ? 'EXECUTE (εγγραφή)' : 'DRY-RUN'} · ${projectId}\n`);

  const snapshot = await db.collectionGroup(SUBCOLLECTIONS.PROPERTY_PAYMENT_PLANS).get();
  const tally = { plans: 0, installments: 0, noop: 0, unresolved: 0, written: 0, conflicts: 0 };

  // Μία γραφή ανά πλάνο (όχι batch): μια σύγκρουση ταυτοχρονισμού χαλά ΜΟΝΟ το δικό της πλάνο.
  for (const doc of snapshot.docs) {
    const plan = planInstallmentDueDays(doc.data());
    if (plan.kind === 'noop') {
      tally.noop += 1;
      continue;
    }
    if (plan.kind === 'unresolved') {
      tally.unresolved += 1;
      console.log(`  ⛔ ${doc.ref.path}: μη αναγνώσιμη λήξη στις δόσεις [${plan.indexes.join(', ')}] — ΔΕΝ γράφεται`);
      continue;
    }
    tally.plans += 1;
    tally.installments += plan.converted;
    if (!execute) continue;
    try {
      await doc.ref.update({ installments: plan.installments }, { lastUpdateTime: doc.updateTime });
      tally.written += 1;
    } catch (error: unknown) {
      if (!isPreconditionFailure(error)) throw error;
      tally.conflicts += 1;
      console.log(`  ↻ ${doc.ref.path}: άλλαξε στο μεταξύ — δεν γράφτηκε, ξανατρέξε`);
    }
  }

  // Κάθε κάδος τυπώνεται, και τα μηδενικά: «0» που δεν φαίνεται διαβάζεται «δεν κοίταξα».
  console.log(
    `  ${SUBCOLLECTIONS.PROPERTY_PAYMENT_PLANS}: σύνολο ${snapshot.size} · προς μετατροπή ${tally.plans} πλάνα / ` +
      `${tally.installments} δόσεις · χωρίς αλλαγή ${tally.noop} · μη αναγνώσιμα ${tally.unresolved}` +
      (execute ? ` · γράφτηκαν ${tally.written} · συγκρούσεις ${tally.conflicts}` : ''),
  );
  console.log(execute ? '\nΓΡΑΦΤΗΚΑΝ.\n' : '\n(dry-run, τίποτα δεν γράφτηκε)\n');
  if (tally.unresolved > 0 || tally.conflicts > 0) process.exitCode = 1;
}

if (process.argv[1]?.includes('backfill-installment-due-day')) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
