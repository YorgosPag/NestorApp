import 'server-only';

/**
 * @fileoverview **Ο ΕΝΑΣ ΓΡΑΦΕΑΣ ΤΗΣ ΠΑΡΑΔΟΣΗΣ** — φέρνει τις παραδόσεις ενός ακινήτου στην αλήθεια της πώλησης.
 * @related ADR-916 §5.3 · lib/property-handover/handover-plan.ts (η απόφαση) · ADR-195 (ίχνος)
 * @module services/property-handover/property-handover-write.service
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 Ο ΓΡΑΦΕΑΣ ΔΕΝ ΑΠΟΦΑΣΙΖΕΙ
 * ────────────────────────────────────────────────────────────────────────────
 * Διαβάζει ακίνητο + υπάρχουσες παραδόσεις **μέσα** σε συναλλαγή, ζητά το σχέδιο από το καθαρό
 * `planPropertyHandovers` και το εφαρμόζει. Δύο ταυτόχρονες κλήσεις (PATCH · `legalPhase`) ⇒ η δεύτερη
 * συναλλαγή ξαναπαίζει, βλέπει την πρώτη και γράφει **τίποτα** (ADR-916 Π5).
 *
 * 🛡️ **ΠΟΤΕ ΔΕΝ ΠΕΤΑ**: η πώληση **δεν** αποτυγχάνει επειδή απέτυχε η παράδοση. Αποτυχία = γραμμή στο
 * ημερολόγιο + `failed` στον καλούντα — και το νυχτερινό δίχτυ (`property-handover-reconcile`) ξαναπερνά
 * από **εδώ** (ίδιος κώδικας, όχι δεύτερη μηχανή).
 *
 * 📜 **Ίχνος μετά το commit** (ADR-195 · πρότυπο `property-dossier-write.service.ts`): το σώμα της
 * συναλλαγής ξανατρέχει σε σύγκρουση, άρα παρενέργεια μέσα του θα γραφόταν δύο φορές.
 */

import type { Firestore as AdminFirestore, Query } from 'firebase-admin/firestore';

import { PROPERTY_HANDOVER_TRACKED_FIELDS } from '@/config/audit-tracked-fields';
import { COLLECTIONS } from '@/config/firestore-collections';
import { nowISO } from '@/lib/date-local';
import { getErrorMessage } from '@/lib/error-utils';
import {
  planPropertyHandovers,
  propertyHandoverSnapshotOf,
  type PropertyHandoverWrite,
} from '@/lib/property-handover/handover-plan';
import { propertyHandoverFromDocument } from '@/lib/property-handover/property-handover-from-document';
import { createModuleLogger } from '@/lib/telemetry';
import { recordTrackedEntityWrite } from '@/services/entity-audit-tracked-write';
import type { PropertyHandover } from '@/types/property-handover';

const logger = createModuleLogger('PropertyHandoverWrite');

/** Ποιος ζήτησε τη συμφιλίωση — μόνο για το ημερολόγιο· το αποτέλεσμα **δεν** εξαρτάται από αυτό. */
export type PropertyHandoverSyncCause = 'property-write' | 'legal-phase' | 'reconcile';

export interface PropertyHandoverSyncRequest {
  readonly cause: PropertyHandoverSyncCause;
  /** uid του δρώντα — `'system'` για δίχτυ και γραφέα νομικής φάσης χωρίς άνθρωπο. */
  readonly performedBy: string;
}

export type PropertyHandoverSyncOutcome =
  | { readonly kind: 'synced'; readonly writes: number }
  | { readonly kind: 'failed' };

/**
 * Οι αποθηκευμένες παραδόσεις ενός ακινήτου — **πάντα** με τον μισθωτή (CHECK 3.10/3.35), μόνο ισότητες (3.91).
 * Το ΕΝΑ ερώτημα: το διαβάζουν ο γραφέας (μέσα σε συναλλαγή) **και** η προεπισκόπηση.
 */
export function propertyHandoversQuery(adminDb: AdminFirestore, companyId: string, propertyId: string): Query {
  return adminDb
    .collection(COLLECTIONS.PROPERTY_HANDOVERS)
    .where('companyId', '==', companyId)
    .where('propertyId', '==', propertyId);
}

/** Το έγγραφο όπως αποθηκεύεται — η ταυτότητα είναι το id του εγγράφου, όχι πεδίο. */
function storedHandover(handover: PropertyHandover): Omit<PropertyHandover, 'id'> {
  return {
    companyId: handover.companyId,
    propertyId: handover.propertyId,
    recipientContactId: handover.recipientContactId,
    lifecycle: handover.lifecycle,
    completion: handover.completion,
    createdAt: handover.createdAt,
    updatedAt: handover.updatedAt,
  };
}

async function recordHandoverWrite(write: PropertyHandoverWrite, performedBy: string): Promise<void> {
  await recordTrackedEntityWrite({
    entityType: 'property_handover',
    entityId: write.after.id,
    entityName: null,
    trackedFields: PROPERTY_HANDOVER_TRACKED_FIELDS,
    before: write.kind === 'update' ? write.before : null,
    after: write.after,
    performedBy,
    ledger: { companyId: write.after.companyId },
  });
}

/** Η συναλλαγή: ανάγνωση → σχέδιο → εγγραφές. Επιστρέφει ό,τι γράφτηκε, για το ίχνος. */
function applyPlan(adminDb: AdminFirestore, propertyId: string): Promise<readonly PropertyHandoverWrite[]> {
  return adminDb.runTransaction(async (tx) => {
    const propertySnap = await tx.get(adminDb.collection(COLLECTIONS.PROPERTIES).doc(propertyId));
    const snapshot = propertySnap.exists ? propertyHandoverSnapshotOf(propertyId, propertySnap.data() ?? {}) : null;
    if (!snapshot) return [];

    const existing = (await tx.get(propertyHandoversQuery(adminDb, snapshot.companyId, propertyId))).docs.flatMap((doc) => {
      const handover = propertyHandoverFromDocument(doc.data(), doc.id);
      return handover ? [handover] : [];
    });
    const writes = planPropertyHandovers(snapshot, existing, nowISO());
    for (const write of writes) {
      const ref = adminDb.collection(COLLECTIONS.PROPERTY_HANDOVERS).doc(write.after.id);
      // `create` στη γέννηση: αν το ντετερμινιστικό έγγραφο υπάρχει ήδη χωρίς να το είδε το ερώτημα
      // (π.χ. αλλοιωμένο), η συναλλαγή αποτυγχάνει δυνατά — ποτέ σιωπηλή αντικατάσταση.
      if (write.kind === 'create') tx.create(ref, storedHandover(write.after));
      else tx.set(ref, storedHandover(write.after));
    }
    return writes;
  });
}

/**
 * **Συμφιλιώνει** τις παραδόσεις ενός ακινήτου. Ιδεμπότητο · ποτέ δεν πετά · ίχνος μόνο για ό,τι άλλαξε.
 */
export async function syncPropertyHandovers(
  adminDb: AdminFirestore,
  propertyId: string,
  request: PropertyHandoverSyncRequest,
): Promise<PropertyHandoverSyncOutcome> {
  try {
    const writes = await applyPlan(adminDb, propertyId);
    await Promise.all(writes.map((write) => recordHandoverWrite(write, request.performedBy)));
    if (writes.length > 0) logger.info('Property handovers synced', { propertyId, cause: request.cause, writes: writes.length });
    return { kind: 'synced', writes: writes.length };
  } catch (error) {
    logger.error('Property handover sync failed', { propertyId, cause: request.cause, error: getErrorMessage(error) });
    return { kind: 'failed' };
  }
}
