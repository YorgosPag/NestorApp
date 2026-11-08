import 'server-only';

/**
 * Η **φύλαξη κάθε απάντησης του μοντέλου** (ADR-923 §5.5.1 Ε6), ο ένας γραφέας του `catalog_import_page_readings`. Η δεύτερη δοκιμή έδωσε
 * 0/140 επιβεβαιωμένα, και η αιτία δεν μπορούσε να μετρηθεί χωρίς νέα πληρωμένη κλήση, γιατί η απάντηση δεν κρατιόταν.
 *
 * Αποτέλεσμα μηχανής, όπως το `catalog_publication_runs`: καμία αναθεώρηση, κανένα ίχνος, όχι είδος της μηχανής του καταλόγου. Ένα
 * έγγραφο ανά ανάγνωση, γιατί μέσα στην παρτίδα το 1 MiB θα έσπαγε στις 60 σελίδες. Δευτερεύουσα εργασία: αποτυχία εδώ δεν ρίχνει
 * ανάγνωση που έχει ήδη πληρωθεί. Ξαναδιάβασμα ίδιας σελίδας ξαναγράφει ίδιο έγγραφο: η τελευταία ανάγνωση είναι η αλήθεια.
 * @module server/catalog/import-page-reading.server
 */

import { COLLECTIONS } from '@/config/firestore-collections';
import type { AuthContext } from '@/lib/auth';
import { nowISO } from '@/lib/date-local';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { createModuleLogger } from '@/lib/telemetry';
import { generateDeterministicCatalogImportPageReadingId } from '@/services/enterprise-id.service';
import { importPageReadingKey } from '@/subapps/catalog/import/import-keys';
import type { ImportPageReadingDefinition, ImportPageRoute } from '@/subapps/catalog/types/catalog-import';
import { IMPORT_PAGE_READ_ATTEMPTS } from '@/subapps/catalog/vocabulary/catalog-import';

const logger = createModuleLogger('CatalogImportPageReading');

/** Χαρακτήρες, όχι bytes: ακόμη και όλα ελληνικά μένουν πολύ κάτω από το 1 MiB. */
const MAX_RAW_TEXT = 200_000;

export async function recordPageReading(ctx: AuthContext, reading: ImportPageReadingDefinition): Promise<void> {
  const key = importPageReadingKey(reading.batchId, reading.page, reading.route, reading.attempt);
  const id = generateDeterministicCatalogImportPageReadingId(ctx.companyId, key);
  const clipped = reading.rawText !== null && reading.rawText.length > MAX_RAW_TEXT;
  const rawText = clipped ? (reading.rawText ?? '').slice(0, MAX_RAW_TEXT) : reading.rawText;
  const stored = { ...reading, rawText, rawTextClipped: clipped, id, companyId: ctx.companyId, createdAt: nowISO(), createdBy: ctx.uid };
  try {
    await getAdminFirestore().collection(COLLECTIONS.CATALOG_IMPORT_PAGE_READINGS).doc(id).set(stored);
  } catch (error) {
    logger.warn('Page reading was not kept', { batchId: reading.batchId, page: reading.page, error: String(error) });
  }
}

/** Ό,τι φυλάχτηκε, με τη σφραγίδα του γραφέα. */
export interface StoredPageReading extends ImportPageReadingDefinition {
  readonly rawTextClipped: boolean;
  readonly createdAt: string;
}

const PAGE_ROUTES: readonly ImportPageRoute[] = ['table', 'vision'];

/**
 * Όλες οι φυλαγμένες απαντήσεις μιας σελίδας, νεότερη πρώτη (§5.5.2 Β3 Γ3). Τα ids είναι ντετερμινιστικά και φραγμένα
 * (διαδρομή × δοκιμή): ανάγνωση με `getAll`, χωρίς ερώτημα, άρα χωρίς δείκτη. 🔑 Νεότερη κατά **`createdAt`**, όχι κατά δοκιμή: νέα
 * ανάγνωση με μία δοκιμή αφήνει ζωντανή την παλιά δεύτερη.
 */
export async function readPageReadings(ctx: AuthContext, batchId: string, page: number): Promise<StoredPageReading[]> {
  const db = getAdminFirestore();
  const refs = PAGE_ROUTES.flatMap((route) => Array.from({ length: IMPORT_PAGE_READ_ATTEMPTS }, (_, attempt) => {
    const id = generateDeterministicCatalogImportPageReadingId(ctx.companyId, importPageReadingKey(batchId, page, route, attempt));
    return db.collection(COLLECTIONS.CATALOG_IMPORT_PAGE_READINGS).doc(id);
  }));
  const snapshots = await db.getAll(...refs);
  const readings = snapshots.flatMap((snapshot) => {
    const data = snapshot.exists ? (snapshot.data() as StoredPageReading & { readonly companyId?: string }) : null;
    return data !== null && data.companyId === ctx.companyId ? [data] : [];
  });
  return readings.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || readingOrder(b) - readingOrder(a));
}

/** Ισοπαλία χρόνου: η ροή διαβάζει πρώτα πίνακα και μετά όραση, και τη δοκιμή 1 μετά τη 0. */
const readingOrder = (reading: Pick<StoredPageReading, 'route' | 'attempt'>): number => PAGE_ROUTES.indexOf(reading.route) * IMPORT_PAGE_READ_ATTEMPTS + reading.attempt;
