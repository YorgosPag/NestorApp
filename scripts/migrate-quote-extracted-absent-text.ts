/**
 * =============================================================================
 * ΜΕΤΑΠΤΩΣΗ — «null» ως ΚΕΙΜΕΝΟ στο αποθηκευμένο `quotes.extractedData` (ADR-327 §8.5.4)
 * =============================================================================
 *
 * **Γιατί**: πριν τις 2026-10-28 ο αναλυτής αποθήκευε το κείμενο `"null"` / `"N/A"` / `"—"` του μοντέλου ως τιμή
 * (μετρημένο: QT-0004, MACON ATEE, 8 πεδία). Η διόρθωση της εγγραφής καθαρίζει μόνο νέες σαρώσεις· ο έλεγχος σάρωσης
 * των παλιών δείχνει ακόμη «null» μέσα στα πεδία. Μοτίβο «schema versioning» (eager): κάθε εξαγωγή φέρει
 * `normalizationVersion`, και αυτή η μετάπτωση φέρνει τις παλιότερες στην τρέχουσα — με τον ΙΔΙΟ μετασχηματισμό
 * που αποδεικνύεται ισοδύναμος με την εγγραφή (άγκυρα σημείου-σταθερότητας Α2).
 *
 * ┌─ ΣΥΜΒΟΛΑΙΟ ────────────────────────────────────────────────────────────────┐
 * │ 🔒 Μετασχηματισμός: ΑΠΟΚΛΕΙΣΤΙΚΑ `normalizeStoredExtractedData`.             │
 * │ 🔒 Γράφει ΜΟΝΟ το `extractedData` (ούτε `updatedAt`: δεν άλλαξε η προσφορά). │
 * │ 🔒 Ιδεμποτική: έκδοση ≥ τρέχουσας ⇒ καμία γραφή.                              │
 * │ 🔒 Confidence αμετάβλητη (provenance).                                       │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * USAGE (μόνο με εντολή Giorgio):
 * ```bash
 * npx tsx scripts/migrate-quote-extracted-absent-text.ts            # dry-run (μέτρηση, ανά πεδίο)
 * npx tsx scripts/migrate-quote-extracted-absent-text.ts --execute  # εγγραφή
 * ```
 *
 * @see src/subapps/procurement/services/external/quote-extraction-version.ts
 */

import admin from 'firebase-admin';

import { COLLECTIONS } from '../src/config/firestore-collections';
import {
  extractionNeedsUpgrade,
  normalizeStoredExtractedData,
} from '../src/subapps/procurement/services/external/quote-extraction-version';
import type { ExtractedQuoteData } from '../src/subapps/procurement/types/quote';
import { applyEnvLocal } from './_shared/loadEnvLocal';
import { initAdminApp } from './_shared/firebaseAdminOps';

/**
 * Η απόφαση για ένα έγγραφο — ονομασμένη, ποτέ boolean.
 * `clean` = αλλάζουν τιμές (`changedFields`)· `stamp` = μόνο η σφραγίδα έκδοσης (καμία ορατή αλλαγή).
 */
export type AbsentTextPlan =
  | { readonly kind: 'clean'; readonly extractedData: ExtractedQuoteData; readonly changedFields: readonly string[] }
  | { readonly kind: 'stamp'; readonly extractedData: ExtractedQuoteData }
  | { readonly kind: 'noop' };

function isExtraction(value: unknown): value is ExtractedQuoteData {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Τα πεδία πρώτου επιπέδου που άλλαξαν — για αναφορά ανά πεδίο στο dry-run. */
function changedTopLevelFields(before: ExtractedQuoteData, after: ExtractedQuoteData): string[] {
  return Object.keys(after)
    .filter((key) => key !== 'normalizationVersion')
    .filter((key) => JSON.stringify(before[key as keyof ExtractedQuoteData]) !== JSON.stringify(after[key as keyof ExtractedQuoteData]));
}

/** **Τι πρέπει να γραφτεί** σε αυτή την προσφορά — χωρίς δίσκο. */
export function planAbsentText(raw: Record<string, unknown>): AbsentTextPlan {
  const extracted = raw.extractedData;
  if (!isExtraction(extracted) || !extractionNeedsUpgrade(extracted)) return { kind: 'noop' };
  const next = normalizeStoredExtractedData(extracted);
  const changedFields = changedTopLevelFields(extracted, next);
  return changedFields.length > 0
    ? { kind: 'clean', extractedData: next, changedFields }
    : { kind: 'stamp', extractedData: next };
}

/** Firestore επιτρέπει έως 500 πράξεις ανά batch· κρατάμε περιθώριο. */
const BATCH_SIZE = 400;

async function main(): Promise<void> {
  const execute = process.argv.includes('--execute');
  applyEnvLocal();
  const { db, projectId } = initAdminApp(admin);
  console.log(`\n«null»-κείμενο στο extractedData — ${execute ? 'EXECUTE (εγγραφή)' : 'DRY-RUN'} · ${projectId}\n`);

  const snapshot = await db.collection(COLLECTIONS.QUOTES).get();
  const tally = { clean: 0, stamp: 0, noop: 0 };
  const perField = new Map<string, number>();
  let batch = db.batch();
  let pending = 0;

  for (const doc of snapshot.docs) {
    const plan = planAbsentText(doc.data());
    tally[plan.kind] += 1;
    if (plan.kind === 'clean') {
      for (const f of plan.changedFields) perField.set(f, (perField.get(f) ?? 0) + 1);
      console.log(`  ✎ ${doc.id} (${String(doc.get('displayNumber') ?? '—')}): ${plan.changedFields.join(' · ')}`);
    }
    if (plan.kind === 'noop' || !execute) continue;
    batch.update(doc.ref, { extractedData: plan.extractedData });
    pending += 1;
    if (pending === BATCH_SIZE) {
      await batch.commit();
      batch = db.batch();
      pending = 0;
    }
  }
  if (execute && pending > 0) await batch.commit();

  // Κάθε κάδος τυπώνεται, και τα μηδενικά: «0» που δεν φαίνεται διαβάζεται «δεν κοίταξα».
  console.log(
    `\n  ${COLLECTIONS.QUOTES}: σύνολο ${snapshot.size} · με «null»-κείμενο ${tally.clean} · ` +
      `μόνο σφραγίδα έκδοσης ${tally.stamp} · ήδη τρέχουσα/χωρίς εξαγωγή ${tally.noop}`,
  );
  for (const [field, count] of [...perField].sort()) console.log(`    ${field}: ${count}`);
  console.log(execute ? '\nΓΡΑΦΤΗΚΑΝ.\n' : '\n(dry-run, τίποτα δεν γράφτηκε)\n');
}

if (process.argv[1]?.includes('migrate-quote-extracted-absent-text')) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
