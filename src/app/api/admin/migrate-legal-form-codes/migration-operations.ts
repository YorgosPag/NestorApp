/**
 * =============================================================================
 * LEGAL FORM MIGRATION — παλαιό λεξιλόγιο νομικής μορφής ➜ κωδικός της ρίζας (ADR-948 §8 · CHECK 3.73)
 * =============================================================================
 *
 * ΤΙ ΔΙΟΡΘΩΝΕΙ
 * Η φόρμα εταιρείας έγραφε `legalForm` με `toUpperCase()` (`AE`, `SOLE_PROPRIETORSHIP`), ενώ κάθε αναγνώστης —
 * ο χάρτης ΓΕΜΗ, η σύγκριση, ο report-builder — ρωτά τον κωδικό της ρίζας (`ae`). Μετρημένο 2026-11-22: 6 από 12
 * εταιρείες με κεφαλαία, 0 πεζά.
 *
 * ΤΙ ΓΡΑΦΕΙ
 * Τον κωδικό του `canonicalLegalForm` (`lib/contact/legal-form-vocabulary.ts`) — **η ίδια** συνάρτηση που διαβάζει
 * η φόρμα, ώστε μετάπτωση και ανάγνωση να μη διαφωνούν ποτέ. Τιμή που η ρίζα δεν αναγνωρίζει ⇒ **μένει ανέγγιχτη** και
 * αναφέρεται (`unrecognized`): ποτέ μαντεψιά πάνω σε δεδομένα πελάτη.
 *
 * ΙΔΙΟΤΡΟΠΙΑ (N.7.2 #3): γράφονται μόνο έγγραφα που η τιμή τους **διαφέρει** από τον κωδικό· δεύτερη εκτέλεση = 0.
 *
 * AUDIT: όπως στο `migrate-address-labels` — τα `contacts` έχουν CDC trigger (`auditContactWrite`), άρα κάθε εγγραφή
 * γράφει μόνη της γραμμή Ιστορικού· ο envelope (`runMigration`, ADR-704) καταγράφει την εκτέλεση. Ο `performer`
 * σφραγίζει κάθε επαφή, αλλιώς ο CDC γράφει `cdc_unknown`.
 *
 * @module app/api/admin/migrate-legal-form-codes/migration-operations
 * @see ./../migrate-address-labels/migration-operations — το πρότυπο
 */

import 'server-only';

import type { Firestore } from 'firebase-admin/firestore';
import { flushInBatches, type BatchUpdate } from '@/lib/admin-batch-utils';
import type { ResolvedPerformer } from '@/server/lib/performer-stamp';
import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';
import { canonicalLegalForm, type LegalForm } from '@/lib/contact/legal-form-vocabulary';

const logger = createModuleLogger('MigrateLegalFormCodes');

/** Τι κάνει η μετάπτωση σε μία επαφή — καθαρή κρίση, χωρίς I/O (άγκυρες). */
export type LegalFormPlan =
  | { readonly kind: 'none' }
  | { readonly kind: 'rewrite'; readonly from: string; readonly to: LegalForm }
  | { readonly kind: 'unrecognized'; readonly value: string };

/** Κενό/απόν ή ήδη κωδικός ⇒ τίποτα· γνωστή παλαιά μορφή ⇒ ξαναγράφεται· άγνωστη ⇒ αναφέρεται, δεν αγγίζεται. */
export function planLegalForm(stored: unknown): LegalFormPlan {
  if (typeof stored !== 'string' || stored.trim() === '') return { kind: 'none' };
  const code = canonicalLegalForm(stored);
  if (code === null) return { kind: 'unrecognized', value: stored };
  return code === stored ? { kind: 'none' } : { kind: 'rewrite', from: stored, to: code };
}

export interface LegalFormMigrationEntry {
  readonly contactId: string;
  readonly companyId: string | null;
  readonly from: string;
  readonly to: LegalForm;
}

export interface LegalFormMigrationReport {
  readonly success: true;
  readonly dryRun: boolean;
  readonly scannedContacts: number;
  readonly affectedContacts: number;
  readonly entries: LegalFormMigrationEntry[];
  /** Τιμές που η ρίζα δεν αναγνωρίζει — **ανέγγιχτες**, για ανθρώπινη απόφαση. */
  readonly unrecognized: Array<{ readonly contactId: string; readonly value: string }>;
  readonly batchErrors?: string[];
}

interface Scan {
  readonly entries: LegalFormMigrationEntry[];
  readonly unrecognized: Array<{ readonly contactId: string; readonly value: string }>;
}

function scanContacts(docs: ReadonlyArray<{ id: string; data: () => Record<string, unknown> }>): Scan {
  const entries: LegalFormMigrationEntry[] = [];
  const unrecognized: Scan['unrecognized'] = [];
  for (const docSnap of docs) {
    const data = docSnap.data();
    const plan = planLegalForm(data.legalForm);
    if (plan.kind === 'unrecognized') unrecognized.push({ contactId: docSnap.id, value: plan.value });
    if (plan.kind !== 'rewrite') continue;
    const companyId = typeof data.companyId === 'string' ? data.companyId : null;
    entries.push({ contactId: docSnap.id, companyId, from: plan.from, to: plan.to });
  }
  return { entries, unrecognized };
}

/**
 * Σαρώνει τις επαφές και επιστρέφει τι θα άλλαζε (και το αλλάζει αν `dryRun === false`).
 *
 * @param companyId ο οργανισμός του `resolveTenantListScopeFromUrl`· `undefined` = όλοι (μόνο bypass role, ADR-702).
 */
export async function migrateLegalFormCodes(
  db: Firestore,
  dryRun: boolean,
  performer: ResolvedPerformer,
  companyId?: string,
): Promise<LegalFormMigrationReport> {
  // Admin SDK παρακάμπτει τους Firestore rules — το tenant scope εφαρμόζεται ΕΔΩ, ρητά.
  const baseQuery = companyId
    ? db.collection(COLLECTIONS.CONTACTS).where('companyId', '==', companyId)
    : db.collection(COLLECTIONS.CONTACTS);
  const snapshot = await baseQuery.get();
  const { entries, unrecognized } = scanContacts(snapshot.docs);

  let batchErrors: string[] | undefined;
  if (!dryRun && entries.length > 0) {
    const updates: BatchUpdate[] = entries.map((entry) => ({
      ref: db.collection(COLLECTIONS.CONTACTS).doc(entry.contactId),
      data: { legalForm: entry.to },
    }));
    const { written, errors } = await flushInBatches(db, updates, { collections: [COLLECTIONS.CONTACTS], performer });
    batchErrors = errors.length > 0 ? errors : undefined;
    logger.info('Legal forms migrated', { affectedContacts: written, companyId: companyId ?? 'ALL', failedBatches: errors.length });
  }

  return {
    success: true,
    dryRun,
    scannedContacts: snapshot.size,
    affectedContacts: entries.length,
    entries: dryRun ? entries : entries.slice(0, 50),
    unrecognized,
    ...(batchErrors ? { batchErrors } : {}),
  };
}
