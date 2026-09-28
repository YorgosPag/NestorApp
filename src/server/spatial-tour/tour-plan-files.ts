import 'server-only';

/**
 * @fileoverview **ΠΟΙΕΣ ΚΑΤΟΨΕΙΣ ΜΠΟΡΕΙ ΝΑ ΠΑΡΕΙ Η ΠΕΡΙΗΓΗΣΗ** — ο ΕΝΑΣ κριτής, και η λίστα που βγαίνει από αυτόν (ADR-884
 * Φ2στ-β · §4.13 · §12 Δ7.1).
 * @related `tour-plan-prepare.ts` (κρίνει την επιλογή με τον ίδιο κριτή) · `app/api/spatial-tours/[kind]/[subjectId]/floorplans`
 *   (η λίστα της οθόνης) · `lib/listings/listing-file-deliverability.ts` («φεύγει ως εικόνα;»)
 * @module server/spatial-tour/tour-plan-files
 *
 * 🔑 **Ένας κριτής, δύο ερωτήσεις**: «τι να δείξει η οθόνη;» και «δέχομαι αυτή την επιλογή;» απαντώνται από το **ίδιο**
 *   `tourPlanFileOf`. Αλλιώς η οθόνη θα πρόσφερε αρχείο που ο γραφέας αρνείται — ή, χειρότερα, το ανάποδο.
 * 🔑 **Κάτοψη ΑΥΤΟΥ του ακινήτου**: κατηγορία `floorplans`, ίδια οντότητα με τη ρίζα, ίδιος κάτοχος, έτοιμη αποκωδικοποιήσιμη
 *   εικόνα. PDF/DXF δεν περνούν ακόμη (η απόδοση PDF σε εικόνα είναι επόμενο βήμα).
 * 🔑 **Ερώτημα στο διαμέρισμα του κατόχου, με το πεδίο του κατόχου** (CHECK 3.10/3.35): `companyId` για εταιρικά,
 *   `userId` για προσωπικά — ποτέ ερώτημα χωρίς φράχτη μισθωτή.
 */

import type { Firestore } from 'firebase-admin/firestore';

import { FILE_CATEGORIES, FILE_STATUS } from '@/config/domain-constants';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FILE_COLLECTION } from '@/lib/files/file-custody';
import { normalizeFileRecord } from '@/lib/files/file-record-read';
import { isDeliverableListingImage } from '@/lib/listings/listing-file-deliverability';
import { tourSubjectFileEntityType } from '@/lib/spatial-tour/tour-subject-of-listing';
import { isRecord } from '@/lib/type-guards';
import { custodyKindOfScope, isOwnedByCustody } from '@/lib/workspace/custody-scope';
import type { FileRecord } from '@/types/file-record';
import type { TourActor } from '@/lib/spatial-tour/tour-authority';
import type { TourPlanCandidate } from '@/lib/spatial-tour/tour-graph-edit';
import type { SpatialTour, TourSubject } from '@/types/spatial-tour';

import { locateManagedTour, type TourAccessRefused } from './tour-access-shared';

/** **Ο κριτής**: το έγγραφο ως αρχείο κάτοψης **αυτής** της περιήγησης — ή `null`. */
export function tourPlanFileOf(raw: unknown, fileId: string, tour: Pick<SpatialTour, 'custody' | 'subject'>): FileRecord | null {
  if (!isRecord(raw)) return null;
  const file = normalizeFileRecord(raw, fileId);
  if (file === null || !isOwnedByCustody(raw, tour.custody)) return null;
  if (file.category !== FILE_CATEGORIES.FLOORPLANS || file.entityId !== tour.subject.id) return null;
  return isDeliverableListingImage(file, tourSubjectFileEntityType(tour.subject)) ? file : null;
}

function filesOf(db: Firestore, tour: Pick<SpatialTour, 'custody'>) {
  return db.collection(COLLECTIONS[FILE_COLLECTION[custodyKindOfScope(tour.custody)]]);
}

/** Το αρχείο που διάλεξε ο άνθρωπος, κριμένο — `null` όταν δεν υπάρχει ή δεν περνά τον κριτή. */
export async function readTourPlanFile(db: Firestore, tour: Pick<SpatialTour, 'custody' | 'subject'>, fileId: string): Promise<FileRecord | null> {
  const snap = await filesOf(db, tour).doc(fileId).get();
  return snap.exists ? tourPlanFileOf(snap.data(), fileId, tour) : null;
}

function candidateOf(file: FileRecord): TourPlanCandidate {
  return {
    fileId: file.id,
    name: file.displayName,
    previewUrl: file.thumbnailUrl ?? file.downloadUrl ?? null,
    levelFloorId: file.levelFloorId ?? null,
  };
}

/** **Οι κατόψεις του ακινήτου που περνούν τον κριτή** — για την οθόνη επιλογής του υπευθύνου. */
export async function listTourPlanFiles(db: Firestore, tour: Pick<SpatialTour, 'custody' | 'subject'>): Promise<TourPlanCandidate[]> {
  const entityType = tourSubjectFileEntityType(tour.subject);
  const base = filesOf(db, tour);
  // Ίδιο σχήμα με τους υπάρχοντες δείκτες: εταιρικά (companyId · entityType · entityId · category), προσωπικά
  // (userId · entityType · entityId · status). Η υπόλοιπη κρίση γίνεται από τον κριτή, όχι από το ερώτημα.
  const query = tour.custody.userId !== undefined
    ? base.where('userId', '==', tour.custody.userId).where('entityType', '==', entityType)
      .where('entityId', '==', tour.subject.id).where('status', '==', FILE_STATUS.READY)
    : base.where('companyId', '==', tour.custody.companyId).where('entityType', '==', entityType)
      .where('entityId', '==', tour.subject.id).where('category', '==', FILE_CATEGORIES.FLOORPLANS);
  const snap = await query.get();
  return snap.docs.flatMap((doc) => {
    const file = tourPlanFileOf(doc.data(), doc.id, tour);
    return file === null ? [] : [candidateOf(file)];
  });
}

export type TourPlanFilesListing = { readonly kind: 'listed'; readonly plans: readonly TourPlanCandidate[] } | TourAccessRefused;

/** **Η λίστα για την οθόνη** — μόνο ο υπεύθυνος (ίδια πόρτα με τον γραφέα του γράφου). */
export async function listTourPlanFilesForManager(
  db: Firestore,
  input: { readonly subject: TourSubject; readonly actor: TourActor },
): Promise<TourPlanFilesListing> {
  const managed = await locateManagedTour(db, input.subject, input.actor);
  if (managed.kind === 'refused') return managed;
  return { kind: 'listed', plans: await listTourPlanFiles(db, managed.tour) };
}
