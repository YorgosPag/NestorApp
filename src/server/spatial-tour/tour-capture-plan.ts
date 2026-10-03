import 'server-only';

/**
 * @fileoverview **Η ΚΑΤΟΨΗ ΓΙΑ ΤΗ ΛΗΨΗ** — ποιο παράγωγο κάτοψης μπορεί να κατεβάσει ο συνδεδεμένος για να πατήσει το σημείο
 * του (ADR-904 Κ9 · Α8).
 * @related `capture-plans/[contentHash]/route.ts` · `tour-capture-upload.ts` (`judgeUploader` — ο ΙΔΙΟΣ κριτής) ·
 *   `lib/spatial-tour/tour-capture-placement-hint.ts` (`captureLevelChoices` — η ίδια επιλογή με τη λίστα) ·
 *   `lib/spatial-tour/tileset/tour-plan-layout.ts` (πού ζει το παράγωγο)
 * @module server/spatial-tour/tour-capture-plan
 *
 * 🔴 **ΚΑΜΙΑ ΝΕΑ ΑΡΧΗ ΕΞΟΥΣΙΟΔΟΤΗΣΗΣ** (CHECK 3.68): όποιος μπορεί να **ανεβάσει** λήψη σε αυτό το ακίνητο (υπεύθυνος ή ενεργή
 *   άδεια φωτογράφου) βλέπει τις κατόψεις του — κανείς άλλος. Το κουπόνι θέασης **δεν** δίνεται: θα άνοιγε όλα τα πανοράματα.
 * 🔑 **Μόνο ό,τι υπόσχεται η λίστα**: το hash πρέπει να είναι η **ενεργή, βαθμονομημένη** κάτοψη κάποιου ορόφου — ακριβώς το
 *   `CaptureLevel.calibratedPlan`. Παλιό hash ⇒ `plan-absent` (409): η κάτοψη άλλαξε, η εφαρμογή ξαναζητά τη λίστα.
 * 🔑 **Το μεγαλύτερο παράγωγο**: ο φωτογράφος μεγεθύνει για να πατήσει με ακρίβεια· ένα αρχείο ανά hash, αμετάβλητο ⇒ η
 *   εφαρμογή το κρατά για λήψη χωρίς σήμα.
 */

import type { Bucket } from '@google-cloud/storage';
import type { Firestore } from 'firebase-admin/firestore';

import { planDerivativeWidths, planImageSegments } from '@/lib/spatial-tour/tileset/tour-plan-layout';
import { captureLevelChoices } from '@/lib/spatial-tour/tour-capture-placement-hint';
import { tourMediaObjectPath } from '@/lib/spatial-tour/tour-media-path';
import type { TourActor } from '@/lib/spatial-tour/tour-authority';
import type { TourSubject } from '@/types/spatial-tour';

import { refuseTourAccess } from './tour-access-shared';
import { judgeUploader, type TourUploadRefused } from './tour-capture-upload';
import { tourMediaBucket } from './tour-media-store';

export type CapturePlanLocation =
  | { readonly kind: 'found'; readonly objectPath: string; readonly bucket: Bucket; readonly tourId: string }
  | TourUploadRefused;

/** **Πού ζει η κάτοψη `contentHash`** για αυτόν τον δράστη — ή γιατί όχι. */
export async function locateCapturePlan(
  db: Firestore,
  input: { readonly subject: TourSubject; readonly actor: TourActor; readonly contentHash: string },
): Promise<CapturePlanLocation> {
  const standing = await judgeUploader(db, input.subject, input.actor, false);
  if ('kind' in standing) return standing;
  const plan = captureLevelChoices(standing.tour.levels)
    .map((level) => level.calibratedPlan)
    .find((candidate) => candidate?.image.contentHash === input.contentHash);
  if (plan == null) return refuseTourAccess('plan-absent');
  const widths = planDerivativeWidths(plan.image.width);
  const objectPath = tourMediaObjectPath(standing.tour.id, planImageSegments(plan.image.contentHash, widths[widths.length - 1]));
  if (objectPath === null) return refuseTourAccess('plan-absent');
  return { kind: 'found', objectPath, bucket: tourMediaBucket(standing.mediaPlacement), tourId: standing.tour.id };
}
