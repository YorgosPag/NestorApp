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
import type { ImportPageReadingDefinition } from '@/subapps/catalog/types/catalog-import';

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
