/**
 * =============================================================================
 * ΜΕΤΑΠΤΩΣΗ Τ.Κ. — «546 24» ➜ «54624» σε κάθε αποθηκευμένη διεύθυνση (ADR-332 D16)
 * =============================================================================
 *
 * ΤΙ ΔΙΟΡΘΩΝΕΙ
 * Η μορφή με κενό είναι η **επίσημη** ελληνική (ΕΛΤΑ) — δεν είναι αλλοίωση,
 * είναι **ασυνέπεια**: ο χρήστης πληκτρολογούσε 5 ψηφία, η μάσκα και ο geocoder
 * έγραφαν τη μορφή με κενό, και κάθε σύγκριση έσπαγε σιωπηλά:
 *   - `administrative-hierarchy.json`: 949 Τ.Κ., **0 με κενό** ⇒ η αναζήτηση
 *     οικισμού από Τ.Κ. δεν επέστρεφε ποτέ τίποτα.
 *   - Οι επικυρωτές `/^[1-9]\d{4}$/` και `/^\d{5}$/` **απέρριπταν** τιμές που
 *     ήταν ήδη αποθηκευμένες.
 * Ο κώδικας γράφει πλέον κανονική μορφή· εδώ καθαρίζεται ό,τι γράφτηκε πριν.
 *
 * ΓΙΑΤΙ ΟΧΙ ΤΥΦΛΟ `replace(/\s/g,'')`
 * Δύο δικλείδες: (α) η κανονικοποίηση αφορά **μόνο** την ακριβή μορφή
 * `\d{3} \d{2}`, (β) εφαρμόζεται **μόνο σε ελληνική διεύθυνση**. Η Σουηδία
 * γράφει κι αυτή «123 45» και το Ηνωμένο Βασίλειο «SW1A 1AA» — καμία ξένη
 * εγγραφή δεν αγγίζεται.
 *
 * ΙΔΙΟΤΡΟΠΙΑ (N.7.2 #3)
 * Γράφονται μόνο τα documents όπου κάτι πραγματικά αλλάζει. Δεύτερη εκτέλεση
 * βρίσκει 0 και δεν γράφει τίποτα.
 *
 * AUDIT (γιατί ΔΕΝ καλείται εδώ `EntityAuditService.recordChange`)
 * Τα `contacts` έχουν CDC trigger (`auditContactWrite`) — κάθε `batch.update`
 * παράγει από μόνο του εγγραφή στο `entity_audit_trail`. Μια service-side κλήση
 * θα ήταν ακριβώς το διπλότυπο που αφαίρεσε η Φάση 3 του ADR-195. Η εκτέλεση
 * της μετάπτωσης καταγράφεται ξεχωριστά από τον envelope (ADR-704).
 *
 * @module app/api/admin/migrate-postal-codes/migration-operations
 * @enterprise ADR-332 D16 — κανονικός Τ.Κ. στη βάση, μάσκα στην οθόνη
 * @see ADR-704 — flushInBatches/BATCH_WRITE_LIMIT· ο `db` έρχεται από τον envelope
 * @see ADR-195 §Φάση 3 — CDC coverage για contacts
 */

import 'server-only';

import type { Firestore } from 'firebase-admin/firestore';
import { flushInBatches, type BatchUpdate } from '@/lib/admin-batch-utils';
import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';
import { isGreekAddressCountry } from '@/utils/address/country-codes';
import { toCanonicalGreekPostalCode } from '@/utils/address/postal-code';

const logger = createModuleLogger('MigratePostalCodes');

/**
 * Πού ζουν πίνακες διευθύνσεων. Πίνακας, όχι αντιγραμμένοι βρόχοι — μια νέα
 * συλλογή είναι μία γραμμή.
 *
 * Το `AddressWithHierarchy` (η πηγή της μορφής με κενό) το χρησιμοποιούν Επαφές,
 * Έργα **και** Κτίρια· περιορισμός στις επαφές θα άφηνε το μισό πρόβλημα ζωντανό.
 */
const TARGETS: ReadonlyArray<{
  readonly collection: string;
  /** Διαδρομή προς τον πίνακα μέσα στο έγγραφο (dot-notation στην εγγραφή). */
  readonly arrayPaths: readonly (readonly string[])[];
}> = [
  {
    collection: COLLECTIONS.CONTACTS,
    // Αυθεντική εγγραφή ΚΑΙ παράγωγο — αν καθαριστεί μόνο το ένα, η επόμενη
    // αποθήκευση ξαναγράφει το άλλο από πάνω.
    arrayPaths: [['addresses'], ['customFields', 'companyAddresses']],
  },
  { collection: COLLECTIONS.PROJECTS, arrayPaths: [['addresses']] },
  { collection: COLLECTIONS.BUILDINGS, arrayPaths: [['addresses']] },
];

interface StoredAddress {
  postalCode?: unknown;
  country?: unknown;
  [key: string]: unknown;
}

export interface PostalCodeMigrationChange {
  /** Διαδρομή του πίνακα, π.χ. `customFields.companyAddresses`. */
  path: string;
  index: number;
  from: string;
  to: string;
}

export interface PostalCodeMigrationEntry {
  collection: string;
  documentId: string;
  companyId: string | null;
  changes: PostalCodeMigrationChange[];
}

export interface PostalCodeMigrationReport {
  dryRun: boolean;
  scannedDocuments: number;
  affectedDocuments: number;
  affectedAddresses: number;
  /** Πλήρης λίστα στο preview· στο execute περιορίζεται για να μη φουσκώσει η απόκριση. */
  entries: PostalCodeMigrationEntry[];
  /** Μηνύματα από batches που απέτυχαν (per-batch resilience, ADR-704). */
  batchErrors?: string[];
}

/** Η νέα τιμή Τ.Κ., ή `null` όταν δεν αλλάζει τίποτα. */
function nextPostalCode(address: StoredAddress): string | null {
  const current = address.postalCode;
  if (typeof current !== 'string' || current === '') return null;

  const country = typeof address.country === 'string' ? address.country : undefined;
  if (!isGreekAddressCountry(country)) return null;

  const canonical = toCanonicalGreekPostalCode(current);
  return canonical === current ? null : canonical;
}

/** Διαβάζει έναν εμφωλευμένο πίνακα διευθύνσεων από το έγγραφο. */
function readArrayAt(data: Record<string, unknown>, path: readonly string[]): StoredAddress[] | null {
  let cursor: unknown = data;
  for (const segment of path) {
    if (typeof cursor !== 'object' || cursor === null) return null;
    cursor = (cursor as Record<string, unknown>)[segment];
  }
  return Array.isArray(cursor) ? (cursor as StoredAddress[]) : null;
}

/** Σαρώνει ΕΝΑ έγγραφο· επιστρέφει τι αλλάζει και το payload εγγραφής. */
function planDocument(
  data: Record<string, unknown>,
  arrayPaths: readonly (readonly string[])[],
): { changes: PostalCodeMigrationChange[]; update: Record<string, unknown> } {
  const changes: PostalCodeMigrationChange[] = [];
  const update: Record<string, unknown> = {};

  for (const path of arrayPaths) {
    const addresses = readArrayAt(data, path);
    if (!addresses) continue;

    const fieldPath = path.join('.');
    let touched = false;

    const nextAddresses = addresses.map((address, index) => {
      const to = nextPostalCode(address);
      if (to === null) return address;
      touched = true;
      changes.push({ path: fieldPath, index, from: String(address.postalCode), to });
      return { ...address, postalCode: to };
    });

    if (touched) update[fieldPath] = nextAddresses;
  }

  return { changes, update };
}

/**
 * Σαρώνει όλες τις συλλογές-στόχους και κανονικοποιεί τους ελληνικούς Τ.Κ.
 *
 * @param db Admin Firestore από τον envelope (`runMigration`, ADR-704).
 * @param dryRun όταν `true`, καμία εγγραφή — μόνο αναφορά.
 */
export async function migratePostalCodes(
  db: Firestore,
  dryRun: boolean,
): Promise<PostalCodeMigrationReport> {
  const entries: PostalCodeMigrationEntry[] = [];
  const updates: BatchUpdate[] = [];
  let scannedDocuments = 0;

  for (const target of TARGETS) {
    const snapshot = await db.collection(target.collection).get();
    scannedDocuments += snapshot.size;

    for (const docSnap of snapshot.docs) {
      const data = docSnap.data() as Record<string, unknown>;
      const { changes, update } = planDocument(data, target.arrayPaths);
      if (changes.length === 0) continue;

      entries.push({
        collection: target.collection,
        documentId: docSnap.id,
        companyId: typeof data.companyId === 'string' ? data.companyId : null,
        changes,
      });
      updates.push({ ref: docSnap.ref, data: update });
    }
  }

  const affectedAddresses = entries.reduce((sum, e) => sum + e.changes.length, 0);
  let batchErrors: string[] | undefined;

  if (!dryRun && updates.length > 0) {
    const { written, errors } = await flushInBatches(db, updates);
    batchErrors = errors.length > 0 ? errors : undefined;

    logger.info('Postal codes normalised', {
      affectedDocuments: written,
      affectedAddresses,
      failedBatches: errors.length,
    });
  }

  return {
    dryRun,
    scannedDocuments,
    affectedDocuments: entries.length,
    affectedAddresses,
    entries: dryRun ? entries : entries.slice(0, 50),
    ...(batchErrors ? { batchErrors } : {}),
  };
}
