/**
 * ⚓ ADR-929 §6.21.4 — **αιτία γ**: η διάσταση 2.05 του ΤΕΣΤ2 χανόταν στην παραγωγή γιατί το πάχος πινελιάς μετριόταν
 * στη **δυαδική** μάσκα.
 *
 * 🔴 Μετρημένο (§6.21.3): στην εικόνα του Chrome η πάνω πλευρά του ορθογωνίου (1,13 px) δυαδοποιείται σε 1 px, στο Node
 * σε 2 ⇒ `strokeWidthPx` 1 αντί 2 ⇒ όριο λεπτότητας 1,25 ⇒ οι βοηθητικές της 2.05 (1,00 px πάνω στο όριο δύο στηλών ⇒
 * **2** px στη μάσκα) «δεν είναι λεπτές» ⇒ `dimension-line` αντί για `extension-line` ⇒ καμία άγκυρα ⇒ κανένα άνοιγμα.
 *
 * Η εικόνα εδώ είναι **ακριβώς** η απόδοση του Chrome στην παραγωγή (`fixtures/test2-chrome-render.rle.txt`, μεταφερμένη
 * pixel προς pixel, άθροισμα ελέγχου 3914516178). Μόνο pixels, χωρίς τα metadata του PDF.
 * 🔑 **Φάση**: η ίδια εικόνα μετατοπίζεται κατά ¼ και ½ px (διγραμμικά). Η μετατόπιση αλλάζει τη δυαδική μάσκα, όχι τη
 *   μάζα του μελανιού: το πάχος από την κάλυψη και η αναγνώριση πρέπει να μένουν ίδια.
 */

import { describe, expect, it } from '@jest/globals';
import { inkLevels } from '@/lib/geometry/raster/coverage-width';
import { alignPlan } from '../alignment/align-plan';
import { extensionAnchorMap, segmentRoleMap, textLinkMap } from '../classify/segment-roles';
import { fusePlan } from '../fusion/plan-fusion';
import { DEFAULT_PLAN_SEGMENTS, extractPlanSegments } from '../segments/plan-segments';
import { TEST2_CHROME_RENDERING, loadCapturedRendering } from '../testing/captured-renderings';
import { grayChecksum, grayToPlanRaster } from '../testing/gray-rle-raster';

const { width: WIDTH, height: HEIGHT, checksum: CHECKSUM } = TEST2_CHROME_RENDERING;
/** Η αληθινή πινελιά του ορθογωνίου (PDF: 4,72 μονάδες ⇒ ×0,24 px), η τυπική πινελιά του σχεδίου. */
const TRUE_STROKE_PX = 4.72 * 0.24;
/** Οι αληθινές αποστάσεις του PDF στην κλίμακα ×2 (handoff §2.1): 967 · 0,24 και 1945 · 0,24 μονάδες. */
const TRUE_2_05_PX = 967 * 0.24;
const TRUE_4_12_PX = 1945 * 0.24;

/** Διγραμμική μετατόπιση κατά `(dx, dy)` px (έξω από την εικόνα ⇒ χαρτί): νέα φάση, ίδια μάζα μελανιού. */
function shifted(gray: Uint8Array, dx: number, dy: number): Uint8Array {
  if (dx === 0 && dy === 0) return gray;
  const at = (x: number, y: number): number => (x < 0 || y < 0 || x >= WIDTH || y >= HEIGHT ? 255 : gray[y * WIDTH + x]);
  const out = new Uint8Array(gray.length);
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      const top = at(x - 1, y - 1) * dx * dy + at(x, y - 1) * (1 - dx) * dy;
      const bottom = at(x - 1, y) * dx * (1 - dy) + at(x, y) * (1 - dx) * (1 - dy);
      out[y * WIDTH + x] = Math.round(top + bottom);
    }
  }
  return out;
}

/** Η αλυσίδα του Worker (`handlePlanAlign` → `fusePlan`), κλίμακα άγνωστη όπως στην παραγωγή. */
function recognise(gray: Uint8Array) {
  const alignment = alignPlan(grayToPlanRaster({ gray, width: WIDTH, height: HEIGHT }));
  const extraction = extractPlanSegments(alignment, DEFAULT_PLAN_SEGMENTS);
  const verdicts = extraction.classification.verdicts;
  const fusion = fusePlan({
    kind: 'multipage-pdf', drawing: { choice: null, medium: 'vector' }, alignment, segments: extraction.segments, reading: null,
    knownScale: null, sourceDpi: null,
    segmentRoles: segmentRoleMap(verdicts), extensionAnchors: extensionAnchorMap(verdicts), textLinks: textLinkMap(verdicts),
    roomAreaProbe: () => null,
  });
  const { paper, ink } = inkLevels(alignment.darkness, alignment.ink);
  return {
    strokeWidthPx: extraction.strokeWidthPx,
    contrast: (paper - ink) / 255,
    extensions: verdicts.filter((v) => v.role === 'extension-line').length,
    gaps: fusion.dimensionSpans.map((s) => s.gapPx).sort((a, b) => a - b),
  };
}

const CHROME = loadCapturedRendering(TEST2_CHROME_RENDERING).gray;

describe('ADR-929 §6.21.4 — ΤΕΣΤ2, η απόδοση του Chrome της παραγωγής', () => {
  it('η εικόνα είναι αυτή της παραγωγής (άθροισμα ελέγχου)', () => {
    expect(grayChecksum(CHROME)).toBe(CHECKSUM);
  });

  it.each([[0, 0], [0.25, 0.25], [0.5, 0.5], [0, 0.5]])(
    'μετατόπιση (%f, %f) px: πινελιά 1,13 px, τέσσερις βοηθητικές και ΔΥΟ ανοίγματα — 2.05 και 4.12',
    (dx, dy) => {
      const { strokeWidthPx, contrast, extensions, gaps } = recognise(shifted(CHROME, dx, dy));
      expect(extensions).toBe(4);
      expect(gaps).toHaveLength(2);
      expect(Math.abs(gaps[0] - TRUE_2_05_PX)).toBeLessThan(2);
      expect(Math.abs(gaps[1] - TRUE_4_12_PX)).toBeLessThan(2);
      // Η θόλωση της μετατόπισης σβήνει τα πλήρως μαύρα pixel (στάθμη μελανιού 0 → 38 στο ½,½): όλα τα πάχη μεγαλώνουν
      // με τον ΙΔΙΟ συντελεστή 255 / (χαρτί − μελάνι). Ανηγμένο στην αντίθεση, το πάχος είναι το αληθινό.
      expect((strokeWidthPx ?? 0) * contrast).toBeCloseTo(TRUE_STROKE_PX, 1);
    },
  );
});
