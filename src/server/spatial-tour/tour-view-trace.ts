import 'server-only';

/**
 * @fileoverview **ΙΧΝΟΣ ΘΕΑΣΗΣ** — «ο Χ είδε την περιήγηση 3 φορές, τελευταία χθες» (ADR-884 Φ0.13α · Κ3β).
 * @related `tour-view-session.ts` (ο μόνος καλών) · `server/sharing/share-access.ts` (το ίχνος του συνδέσμου)
 * @module server/spatial-tour/tour-view-trace
 *
 * 🏆 **Πέρα από το Google Drive**: ο κάτοχος αρχείου στο Drive δεν ξέρει ποιος το άνοιξε· ο Matterport δίνει μόνο
 * ανώνυμα σύνολα. Εδώ ο μεσίτης βλέπει **ανά εγκεκριμένο άνθρωπο** — σήμα ενδιαφέροντος.
 *
 * 🔑 **Μία επίσκεψη = μία μέτρηση**, όχι ένα πλακίδιο: η συνεδρία θέασης μετρά **μόνο** όταν ο browser δεν έχει
 * ήδη ζωντανό κουπόνι αυτής της περιήγησης (πρότυπο Google Drive / `share-resolve`: μετρά το άνοιγμα).
 *
 * 🔑 **Ποιος μετρά πού** — ένας μετρητής ανά βάση, κανένας διπλός:
 * | βάση | μετρητής |
 * |---|---|
 * | `request` | `viewCount` / `lastViewedAt` στο αίτημα (εδώ) |
 * | `link`    | `accessCount` / `lastAccessedAt` του συνδέσμου — τον μετρά **ήδη** το `/api/shares/resolve` |
 * | `public`  | η προβολή της **αγγελίας** (ADR-777 §8.72) — ⏳ «άνοιγμα περιήγησης» ως διάσταση εκεί (ADR-884 §9) |
 * | `manager` | κανένας — ο υπεύθυνος δεν είναι ενδιαφέρον αγοραστή (ίδιο δόγμα με ADR-777 §8.72) |
 *
 * ⚠️ **Ποτέ εξαίρεση**: αποτυχία ίχνους **δεν** αρνείται θέαση που κρίθηκε — καταγράφεται και προχωρά.
 */

import type { DocumentReference, Firestore } from 'firebase-admin/firestore';

import { nowISO } from '@/lib/date-local';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('tour-view-trace');

/**
 * Μία επίσκεψη εγκεκριμένου αιτούντος — ανάγνωση + `+1` **σε συναλλαγή** (ίδιο ιδίωμα με το `recordShareAccess`):
 * δύο ταυτόχρονες επισκέψεις γράφουν 2, ποτέ 1.
 */
export async function recordTourRequestVisit(db: Firestore, requestRef: DocumentReference): Promise<void> {
  try {
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(requestRef);
      if (!snap.exists) return;
      const count: unknown = snap.data()?.viewCount;
      const previous = Number.isInteger(count) && (count as number) >= 0 ? (count as number) : 0;
      tx.update(requestRef, { viewCount: previous + 1, lastViewedAt: nowISO() });
    });
  } catch (error) {
    logger.warn('Το ίχνος θέασης δεν γράφτηκε — η θέαση συνεχίζει', {
      path: requestRef.path,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
