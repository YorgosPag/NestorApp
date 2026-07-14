/**
 * ADR-651 Φάση Γ — **έξυπνη πρόταση χαρτιού** (Απόφαση Giorgio #2 / §8 #9).
 *
 * «Ποιο φύλλο χρειάζεται αυτό το σχέδιο;» — η απάντηση είναι καθαρή αριθμητική:
 *
 *   απαιτούμενο χαρτί (mm) = μέγεθος σχεδίου (mm μοντέλου) ÷ συντελεστής κλίμακας
 *
 * π.χ. κτίριο 12m × 8m στο 1:50 ⇒ 12000/50 × 8000/50 = **240 × 160 mm** χαρτιού ⇒ το
 * μικρότερο φύλλο του οποίου η **κορνίζα ISO 5457** (όχι το χαρτί!) χωράει αυτό το ορθογώνιο
 * ⇒ **A3 πλαγιαστό** (κορνίζα 267 × 277… στην πραγματικότητα 267 × 400 landscape).
 *
 * **Πρόταση, όχι κλείδωμα** (Giorgio): ο χρήστης αλλάζει ελεύθερα μέγεθος/προσανατολισμό από
 * το ribbon — η πρόταση εφαρμόζεται μόνο όσο δεν έχει επιλέξει ο ίδιος (βλ.
 * `title-block-options-store`). Ίδια λογική με το «Fit to page» των μεγάλων.
 *
 * Reuse: **paper SSoT** (`PAPER_SIZE_ORDER`, A4→A0) + οι ίδιες μετρικές ISO 5457 που χτίζουν
 * την κορνίζα — άρα «χωράει» σημαίνει ακριβώς «χωράει σε αυτό που θα ζωγραφιστεί».
 */

import { PAPER_SIZE_ORDER } from '../../print/config/paper-constants';
import type { PaperOrientation, PaperSize, PaperSpec } from '../../print/config/paper-types';
import { createBoundsFromEntities } from '../../systems/zoom/utils/bounds';
import type { Entity } from '../../types/entities';
import { mmToSceneUnits, type SceneUnits } from '../../utils/scene-units';
import { computeSheetFrameMetrics, usableAreaRects } from './sheet-frame';

/** Το μέγεθος του σχεδίου σε **μονάδες μοντέλου** (canonical mm, ADR-462). */
export interface DrawingExtentMm {
  readonly widthMm: number;
  readonly heightMm: number;
}

/**
 * ADR-651 §8 #9 — το bbox ενός σχεδίου σε **mm**, από τις οντότητές του.
 *
 * Δεύτερος καταναλωτής της πρότασης χαρτιού (ο διάλογος εκτύπωσης) ⇒ η μετατροπή μονάδων
 * πρέπει να ζει **εδώ**, όχι στο UI: το scene μπορεί να είναι σε μέτρα (ελληνικά DXF, ADR-368)
 * ενώ ο `suggestPaperSpec` μιλά **πάντα** mm. Ίδια αριθμητική με το print pipeline
 * (`mmPerSceneUnit = 1 / mmToSceneUnits(units)`, `capture-2d.ts`) ⇒ η πρόταση αφορά **αυτό** που
 * θα τυπωθεί. Κενό σχέδιο (κανένα bbox) ⇒ `null` = «καμία πρόταση» (ποτέ ψεύτικο A0).
 *
 * @param units Οι μονάδες του scene (`resolveSceneUnits` / `userDrawingUnits` SSoT).
 */
export function drawingExtentMmOf(
  entities: readonly Entity[],
  units: SceneUnits,
): DrawingExtentMm | null {
  const bounds = createBoundsFromEntities(entities);
  if (!bounds) return null;
  const mmPerSceneUnit = 1 / mmToSceneUnits(units);
  return {
    widthMm: (bounds.max.x - bounds.min.x) * mmPerSceneUnit,
    heightMm: (bounds.max.y - bounds.min.y) * mmPerSceneUnit,
  };
}

/** Το μεγαλύτερο φύλλο — η ασφαλής απάντηση όταν τίποτα δεν χωράει (ποτέ «καμία πρόταση»). */
export const LARGEST_PAPER_SPEC: PaperSpec = { size: 'A0', orientation: 'landscape' };

/**
 * Τυπικό πλήθος γραμμών πινακίδας, για να έχει η πρόταση ρεαλιστικό «χαμένο» χώρο ακόμη κι αν
 * ο χρήστης αλλάξει preset μετά (η πρόταση δεν κλειδώνει τίποτα — απλώς δεν πρέπει να είναι
 * αισιόδοξη κατά ένα μέγεθος χαρτιού).
 */
const TYPICAL_TITLE_BLOCK_ROWS = 10;

/**
 * Χωράει το σχέδιο στην **ωφέλιμη** περιοχή αυτού του φύλλου;
 *
 * Τα δύο μέγιστα ορθογώνια του Γ-σχήματος (κορνίζα μείον πινακίδα) τα ορίζει το
 * `sheet-frame.ts` — **ο ίδιος** ορισμός που χρησιμοποιεί η εκτύπωση για να τοποθετήσει το
 * σχέδιο (ADR-651 Φάση ΣΤ). Άρα «χωράει» σημαίνει ακριβώς «χωράει εκεί που θα τυπωθεί»· το
 * σχέδιο δεν επιτρέπεται ποτέ να κρυφτεί κάτω από την πινακίδα.
 */
function fitsInFrame(size: PaperSize, orientation: PaperOrientation, needed: DrawingExtentMm): boolean {
  const metrics = computeSheetFrameMetrics({
    paper: { size, orientation },
    rowCount: TYPICAL_TITLE_BLOCK_ROWS,
    withStampBox: false,
  });
  return usableAreaRects(metrics).some(
    (rect) => needed.widthMm <= rect.w && needed.heightMm <= rect.h,
  );
}

/**
 * Το μικρότερο φύλλο (A4→A0) που χωράει το σχέδιο στην τρέχουσα κλίμακα.
 *
 * Ο **προσανατολισμός δοκιμάζεται πρώτος αυτός που ταιριάζει στην αναλογία** του σχεδίου
 * (φαρδύ σχέδιο ⇒ πλαγιαστό), και μόνο αν δεν χωρά δοκιμάζεται ο άλλος — έτσι ένα φαρδύ
 * σχέδιο δεν καταλήγει ποτέ σε όρθιο φύλλο «επειδή τυχαία χωρούσε».
 *
 * @param extent Μέγεθος σχεδίου σε μονάδες μοντέλου (mm).
 * @param scaleFactor Ενεργός συντελεστής κλίμακας (1:50 ⇒ 50· ViewportStore SSoT).
 */
export function suggestPaperSpec(extent: DrawingExtentMm, scaleFactor: number): PaperSpec {
  if (!Number.isFinite(scaleFactor) || scaleFactor <= 0) return LARGEST_PAPER_SPEC;
  if (!Number.isFinite(extent.widthMm) || !Number.isFinite(extent.heightMm)) return LARGEST_PAPER_SPEC;

  const needed: DrawingExtentMm = {
    widthMm: Math.abs(extent.widthMm) / scaleFactor,
    heightMm: Math.abs(extent.heightMm) / scaleFactor,
  };
  const preferred: PaperOrientation = needed.widthMm >= needed.heightMm ? 'landscape' : 'portrait';
  const fallback: PaperOrientation = preferred === 'landscape' ? 'portrait' : 'landscape';

  for (const size of PAPER_SIZE_ORDER) {
    if (fitsInFrame(size, preferred, needed)) return { size, orientation: preferred };
    if (fitsInFrame(size, fallback, needed)) return { size, orientation: fallback };
  }
  return LARGEST_PAPER_SPEC;
}
