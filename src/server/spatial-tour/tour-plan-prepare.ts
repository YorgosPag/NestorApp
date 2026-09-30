import 'server-only';

/**
 * @fileoverview **Η ΚΑΤΟΨΗ ΠΟΥ ΔΙΑΛΕΞΕ Ο ΑΝΘΡΩΠΟΣ, ΕΤΟΙΜΗ ΓΙΑ ΤΗΝ ΠΕΡΙΗΓΗΣΗ** — κρίση καταλληλότητας του αρχείου και
 * παράγωγα WebP στα μέσα της περιήγησης (ADR-884 Φ2στ-β · §4.13 · §12 Δ7.1).
 * @related `tour-graph-write.ts` (ο καλών — **πριν** τη συναλλαγή) · `lib/spatial-tour/tileset/tour-plan-layout.ts` (ονόματα) ·
 *   `tour-plan-files.ts` (ο ΕΝΑΣ κριτής του αρχείου) · `tour-tileset-baker.ts` (ο αδελφός)
 * @module server/spatial-tour/tour-plan-prepare
 *
 * 🔑 **Κάτοψη ΑΥΤΟΥ του ακινήτου, και μόνο**: κατηγορία `floorplans`, ίδια οντότητα με τη ρίζα της περιήγησης, ίδιος
 *   κάτοχος, έτοιμη αποκωδικοποιήσιμη εικόνα. Ένα `fileId` από άλλο ακίνητο (ή άλλον χώρο) **δεν** γίνεται ποτέ κάτοψη
 *   αυτής της περιήγησης, ό,τι κι αν στείλει ο πελάτης.
 * 🔑 **Έξω από τη συναλλαγή**: η εικόνα κατεβαίνει και επεξεργάζεται **πριν** ανοίξει η συναλλαγή του γράφου (μια
 *   συναλλαγή Firestore δεν περιμένει δευτερόλεπτα εικόνας). Ιδεμπότητο: ίδια bytes ⇒ ίδια ονόματα ⇒ τα υπάρχοντα
 *   παράγωγα δεν ξαναγράφονται.
 * 🔑 **Διαστάσεις ΜΕΤΑ τον προσανατολισμό EXIF**: κάτοψη φωτογραφημένη με κινητό έχει συχνά EXIF «στραμμένη 90°». Τα pixel
 *   που δείχνει ο άνθρωπος είναι της **όρθιας** εικόνας — αλλιώς κάθε τελεία θα έπεφτε σε άλλο δωμάτιο.
 */

import { createHash } from 'node:crypto';

import type { Firestore } from 'firebase-admin/firestore';
import sharp from 'sharp';

import { fileRecordBucket } from '@/server/files/file-record-bucket';
import {
  TOUR_PLAN_CONTENT_TYPE,
  TOUR_PLAN_WEBP_QUALITY,
  planDerivativeWidths,
  planImageSegments,
} from '@/lib/spatial-tour/tileset/tour-plan-layout';
import type { TourFloorPlanPick } from '@/lib/spatial-tour/tour-graph-edit';
import { tourMediaObjectPath } from '@/lib/spatial-tour/tour-media-path';
import type { FloorPlanChoice } from '@/lib/spatial-tour/tour-plan-edit';
import type { SpatialTour } from '@/types/spatial-tour';

import { refuseTourAccess, type TourAccessRefused } from './tour-access-shared';
import { tourMediaBucket } from './tour-media-store';
import { readTourPlanFile } from './tour-plan-files';

/** Τα παράγωγα είναι αμετάβλητα (η διαδρομή φέρει hash + έκδοση). Ίδια πολιτική με τα πλακίδια. */
const PLAN_CACHE_CONTROL = 'private, max-age=31536000, immutable';

async function uploadDerivative(tour: SpatialTour, contentHash: string, width: number, upright: Buffer): Promise<void> {
  const path = tourMediaObjectPath(tour.id, planImageSegments(contentHash, width));
  if (path === null) throw new Error(`Plan derivative path rejected: ${contentHash}/${width}`);
  // Τα παράγωγα ζουν δίπλα στα πλακίδια, στον κάδο μέσων της περιήγησης (ζ5)· η κάτοψη-πηγή είναι `FileRecord` (κανονικός).
  const object = tourMediaBucket(tour.mediaPlacement).file(path);
  const [exists] = await object.exists();
  if (exists) return;
  const body = await sharp(upright).resize({ width, withoutEnlargement: true }).webp({ quality: TOUR_PLAN_WEBP_QUALITY }).toBuffer();
  await object.save(body, { contentType: TOUR_PLAN_CONTENT_TYPE, resumable: false, metadata: { cacheControl: PLAN_CACHE_CONTROL } });
}

/** Η **όρθια** εικόνα (EXIF εφαρμοσμένο) και οι διαστάσεις της — `null` όταν τα bytes δεν αποκωδικοποιούνται. */
async function uprightImage(bytes: Buffer): Promise<{ readonly upright: Buffer; readonly width: number; readonly height: number } | null> {
  try {
    const { data, info } = await sharp(bytes).rotate().png().toBuffer({ resolveWithObject: true });
    return { upright: data, width: info.width, height: info.height };
  } catch {
    return null;
  }
}

/**
 * **Κρίνε και ετοίμασε** την κάτοψη που διάλεξε ο άνθρωπος. Επιστρέφει ό,τι θα γράψει ο γραφέας (αρχείο + δηλωμένη πηγή +
 * εικόνα), ή την άρνηση `plan-not-eligible`.
 */
export async function prepareTourFloorPlan(db: Firestore, tour: SpatialTour, pick: TourFloorPlanPick): Promise<FloorPlanChoice | TourAccessRefused> {
  const file = await readTourPlanFile(db, tour, pick.fileId);
  if (file === null) return refuseTourAccess('plan-not-eligible');
  // ADR-895 Α2 — η ανάγνωση της κάτοψης-πηγής ρωτά την εγγραφή, ποτέ σιωπηλά τον κανονικό κάδο.
  const [bytes] = await fileRecordBucket(file).file(file.storagePath).download();
  const contentHash = createHash('sha256').update(bytes).digest('hex');
  const image = await uprightImage(bytes);
  if (image === null) return refuseTourAccess('plan-not-eligible');
  for (const width of planDerivativeWidths(image.width)) {
    await uploadDerivative(tour, contentHash, width, image.upright);
  }
  return { fileId: pick.fileId, source: pick.source, image: { width: image.width, height: image.height, contentHash } };
}
