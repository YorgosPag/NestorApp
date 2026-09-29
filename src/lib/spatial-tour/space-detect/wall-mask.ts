/**
 * @fileoverview **ΠΟΙΑ PIXEL ΕΙΝΑΙ ΤΟΙΧΟΣ** — γκρι → κατώφλι Otsu → «μελάνι» → άνοιγμα (οι λεπτές γραμμές φεύγουν) →
 * νοητές διαχωριστικές γραμμές (ADR-884 §4.14 Γ3 · §12 Δ8.2). Καθαρό.
 * @module lib/spatial-tour/space-detect/wall-mask
 *
 * 🔑 **Γιατί άνοιγμα**: σε μια κάτοψη το «μελάνι» δεν είναι μόνο τοίχοι — είναι ονόματα χώρων, διαστάσεις, έπιπλα,
 * τόξα πορτών. Όλα αυτά είναι γραμμές **ενός-δύο pixel**· οι τοίχοι είναι **παχιοί**. Το άνοιγμα με ακτίνα μισού του
 * ελάχιστου πάχους τοίχου σβήνει τις λεπτές γραμμές και κρατά τους τοίχους. Κάτοψη σχεδιασμένη **μόνο** με λεπτές
 * γραμμές (σχέδιο γραμμής) χάνει έτσι και τους τοίχους ⇒ ο ανιχνευτής ξαναδοκιμάζει **χωρίς** άνοιγμα (`space-detect`).
 */

import { open } from '@/lib/geometry/raster/morphology';
import { grayHistogram, otsuThreshold, rgbaToGray } from '@/lib/geometry/raster/otsu-threshold';
import { rasterizeSegment } from '@/lib/geometry/raster/raster-segment';

import type { PlanRaster, SeparationSegment } from './space-detect-types';

/** Νοητή γραμμή: μισό πλάτος σε pixel (λεπτή, αλλά στεγανή στην 4-γειτονιά). */
const SEPARATION_HALF_WIDTH_PX = 1;

/** «Μελάνι» (`1`) = pixel πιο σκούρο ή ίσο με το κατώφλι Otsu. Μονόχρωμη εικόνα ⇒ κανένα μελάνι. */
export function inkMask(raster: PlanRaster): Uint8Array {
  const count = raster.width * raster.height;
  const gray = rgbaToGray(raster.rgba, count);
  const threshold = otsuThreshold(grayHistogram(gray));
  const ink = new Uint8Array(count);
  if (threshold < 0) return ink;
  for (let i = 0; i < count; i++) ink[i] = gray[i] <= threshold ? 1 : 0;
  return ink;
}

/**
 * Μάσκα τοίχων: μελάνι, προαιρετικά χωρίς γραμμές λεπτότερες από `2 × openRadiusPx`, **συν** οι νοητές γραμμές
 * (που μπαίνουν **μετά** το άνοιγμα — αλλιώς θα έσβηναν κι αυτές ως λεπτές).
 */
export function wallMask(
  ink: Uint8Array, cols: number, rows: number,
  openRadiusPx: number, separations: readonly SeparationSegment[],
): Uint8Array {
  const walls = openRadiusPx > 0 ? open(ink, cols, rows, openRadiusPx) : Uint8Array.from(ink);
  for (const line of separations) {
    rasterizeSegment(walls, cols, rows, line.a, line.b, SEPARATION_HALF_WIDTH_PX, 1);
  }
  return walls;
}
