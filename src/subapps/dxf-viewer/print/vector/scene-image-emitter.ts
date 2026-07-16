/**
 * ADR-608 (hybrid image compositing) — sync raster placement στο vector PDF.
 *
 * Παίρνει μια προ-resolved εικόνα (`ResolvedSceneImage`: data URL + alias + world placements από
 * το `scene-image-resolver`) και τη συνθέτει με `pdf.addImage(...)`. Το placement math είναι
 * **ο ίδιος** μηχανισμός με τον on-screen `ImageRenderer` (eu/ev basis), μεταφρασμένος στο
 * built-in `addImage(x, y, w, h, alias, compression, rotation)` του jsPDF:
 *
 *   jsPDF `writeImageToPDF` (rotation branch) = translate(pivot) → rotate(r, CCW σε PDF Y-up) →
 *   scale(w, h) γύρω από την **κάτω-αριστερή** γωνία. Άρα από τις 3 paper corners (BL/BR/TL):
 *     • pivot = BL  ⇒ x = BL.x, y = BL.y − hMm  (jsPDF μεταφράζει σε `y + height`)
 *     • wMm/hMm = μήκη ακμών σε paper mm (κουβαλούν το zoom)
 *     • r = atan2(−rightY, rightX)  — η paper-Ydown κατεύθυνση της δεξιάς ακμής ισοδυναμεί με
 *       (cos r, −sin r) στο PDF Y-up, οπότε οι 3 γωνίες προσγειώνονται ακριβώς (μηδέν mirror).
 *
 * Καθαρό coordinate mapping μέσω του injected `toPaper` (ίδιο με τον vector emitter) — καμία
 * υπόθεση για τον print transform εδώ. Πολλαπλά placements μοιράζονται το `alias` ⇒ ο jsPDF
 * ενσωματώνει τα bytes ΜΙΑ φορά.
 *
 * ⚠️ **Πεδίο (ADR-667 Φ2): ΜΟΝΟ «γυμνές» εικόνες** (`ImageEntity` — δέντρα/ταπετσαρίες). Οι
 * γραμμοσκιάσεις με γέμισμα «Εικόνα» **δεν στρώνουν πλέον πλακάκια**: πάνε από το
 * `pdf-tiling-pattern.ts` ως **native PDF Tiling Pattern** (κόστος σταθερό ως προς το εμβαδόν).
 * Μαζί τους έφυγαν και το `emitClippedImage`/`clipToBoundary` — το pattern κόβεται **μόνο του**
 * στο path, χωρίς clip.
 *
 * @module subapps/dxf-viewer/print/vector/scene-image-emitter
 * @see rendering/entities/ImageRenderer.ts — το on-screen eu/ev SSoT (canvas ctx.transform)
 * @see docs/centralized-systems/reference/adrs/ADR-667-pdf-native-tiling-patterns.md
 * @see docs/centralized-systems/reference/adrs/ADR-608-vector-pdf-export.md
 */

import type { jsPDF } from 'jspdf';
import type { Point2D } from '../../rendering/types/Types';
// SSoT degree normalization into [0, 360) (normalize-angle-deg module, ADR-294 ratchet).
import { normalizeAngleDeg } from '../../rendering/entities/shared/geometry-angle-utils';
import type { ResolvedImagePlacement, ResolvedSceneImage } from './scene-image-resolver';

const RAD_TO_DEG = 180 / Math.PI;

/** Συνθέτει κάθε placement μιας resolved εικόνας ως `addImage` (κοινό alias → 1 embed). */
export function emitResolvedImage(
  pdf: jsPDF, resolved: ResolvedSceneImage, toPaper: (p: Point2D) => Point2D,
): void {
  for (const pl of resolved.placements) {
    placeOne(pdf, resolved.dataUrl, resolved.alias, pl, toPaper);
  }
}

/** Ένα rect placement → `pdf.addImage` με σωστό x/y/w/h/rotation (pivot = κάτω-αριστερά). */
function placeOne(
  pdf: jsPDF, dataUrl: string, alias: string,
  pl: ResolvedImagePlacement, toPaper: (p: Point2D) => Point2D,
): void {
  const bl = toPaper(pl.bl);
  const br = toPaper(pl.br);
  const tl = toPaper(pl.tl);
  const rightX = br.x - bl.x;
  const rightY = br.y - bl.y;
  const wMm = Math.hypot(rightX, rightY);
  const hMm = Math.hypot(tl.x - bl.x, tl.y - bl.y);
  if (!isFinitePoint(bl) || !(wMm > 0) || !(hMm > 0)) return;

  // Κανονικοποίηση σε [0, 360) — ο jsPDF θέλει 0-359 (αρνητικά δουλεύουν, αλλά μένουμε ασφαλείς).
  // `+ 0` → coerce το -0 (από `atan2(-0, +x)`) σε +0 (καθαρό output, ίδια σημασιολογία).
  const rotationDeg = normalizeAngleDeg(Math.atan2(-rightY, rightX) * RAD_TO_DEG) + 0;
  // pivot (κάτω-αριστερά) = (x, y + hMm) στο top-down space του jsPDF ⇒ y = bl.y − hMm.
  pdf.addImage(dataUrl, 'PNG', bl.x, bl.y - hMm, wMm, hMm, alias, 'FAST', rotationDeg);
}

function isFinitePoint(p: Point2D): boolean {
  return Number.isFinite(p.x) && Number.isFinite(p.y);
}
