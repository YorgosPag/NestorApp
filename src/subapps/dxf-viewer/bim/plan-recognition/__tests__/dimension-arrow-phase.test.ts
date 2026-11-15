/**
 * ⚓ ADR-929 §6.21.6 — **το βέλος δεν εξαρτάται από τη φάση του πλέγματος pixel.**
 *
 * 🔴 Μετρημένο (Π2): στα 0,06 px/mm η οριζόντια διάσταση 6.25 είχε άξονα στο y = 332,00 — **όριο** δύο σειρών. Χωρίς
 * εξομάλυνση η πινελιά 1 px αποδόθηκε μόνο στη σειρά 332 ⇒ το άκρο του τμήματος κάθεται στο 332,5, ενώ οι βραχίονες είναι
 * συμμετρικοί γύρω από το 332,00. Από εκείνο το άκρο ο ένας βραχίονας φαίνεται στις ~10° και ο άλλος στις ~13°: κανένα
 * κοινό 0,75 (9,5°: 0,81/0,22 · 15°: 0/0,87) ⇒ «διασταύρωση», κανένα κείμενο αγκυρωμένο, καμία διάσταση. Με μετατόπιση
 * ½ px χανόταν η **κατακόρυφη** αντί για την οριζόντια· στο ¼ px έμενε βέλος σε μία μόνο άκρη, και η βάση της άλλης
 * γινόταν άγκυρα (ανοίγματα 18 px).
 *
 * Η κάτοψη μετακινείται ανά ¼ px μέσω του περιθωρίου (`marginMm`): ίδιο σχέδιο, άλλη φάση. Το αποτέλεσμα πρέπει να είναι ίδιο.
 * Οι φύλακες μονάδας: η κορυφή μισό pixel έξω από το άκρο **βρίσκεται**, ένα **ασύμμετρο** σχήμα **δεν** γίνεται βέλος.
 */

import { describe, expect, it } from '@jest/globals';
import type { PlanePoint } from '@/lib/geometry/homography';
import type { InkMask } from '@/lib/geometry/raster/ink-probe';
import { mmToSceneUnits } from '../../../utils/scene-units';
import { alignPlan } from '../alignment/align-plan';
import { detectTerminator } from '../classify/dimension-terminators';
import type { FramedSegment } from '../classify/segment-frame';
import { extensionAnchorMap, segmentRoleMap, textLinkMap } from '../classify/segment-roles';
import { fusePlan } from '../fusion/plan-fusion';
import { DEFAULT_PLAN_SEGMENTS, extractPlanSegments, minFillPxFor } from '../segments/plan-segments';
import type { SyntheticDimension } from '../testing/synthetic-dimensions';
import { renderSyntheticPlan, SAMPLE_HOUSE_WALLS, type SyntheticPlanSpec } from '../testing/synthetic-plan-raster';

const PX_PER_MM = 0.06;
const OUT = 125;
const MARGIN_MM = 400;
/** Ένα pixel σε mm κάτοψης. */
const PX_MM = 1 / PX_PER_MM;
/**
 * Οι φάσεις (px). ⚠️ Το ½ **ακριβώς** είναι ισοπαλία του συνθετικού ραστεροποιητή: η βοηθητική με άξονα στο y = 280,00
 * απέχει **ακριβώς** μισή πινελιά από τα κέντρα και των δύο σειρών, το `<=` του `isDimensionInk` τις βάφει και τις δύο ⇒
 * γραμμή 2 px που όντως **δεν** είναι λεπτή (μετρημένο: `wall-face`). Κανένας πραγματικός ραστεροποιητής (κανόνας πλήρωσης)
 * δεν το κάνει· γι' αυτό η φάση είναι 2·10⁻⁶ px πριν από το ½, όπου η απόδοση είναι μία σειρά.
 */
const PHASES_PX = [0, 0.25, 0.5 - 2e-6, 0.75] as const;
/** Από βοηθητική σε βοηθητική: 6000 + 2·125 και 4000 + 2·125 mm. */
const SPANS_PX = [(4000 + 2 * OUT) * PX_PER_MM, (6000 + 2 * OUT) * PX_PER_MM];

const STYLE = {
  terminator: 'arrow', arrowStyle: 'closed-blank', arrowHalfWidthMm: (3 * 12) / 57, text: 'interrupt', stubMm: 7.5,
  extensionAroundLineMm: 2, offsetMm: -875,
} as const;
const DIMENSIONS: SyntheticDimension[] = [
  { ...STYLE, from: { x: -OUT, y: -OUT }, to: { x: 6000 + OUT, y: -OUT }, label: '6.25' },
  { ...STYLE, from: { x: 6000 + OUT, y: -OUT }, to: { x: 6000 + OUT, y: 4000 + OUT }, label: '4.25' },
];

function recognise(marginMm: number) {
  const spec: SyntheticPlanSpec = {
    walls: SAMPLE_HOUSE_WALLS, pxPerMm: PX_PER_MM, marginMm, wallStyle: 'outlined', strokePx: 1, rotationDeg: 0,
    degradation: null, dimensions: DIMENSIONS,
  };
  const alignment = alignPlan(renderSyntheticPlan(spec).image);
  const metresPerPixel = mmToSceneUnits('m') / PX_PER_MM;
  const minFillPx = minFillPxFor(alignment, { metresPerPixelX: metresPerPixel, metresPerPixelY: metresPerPixel, source: 'gallery-scale' });
  const extraction = extractPlanSegments(alignment, { ...DEFAULT_PLAN_SEGMENTS, minFillPx });
  const verdicts = extraction.classification.verdicts;
  const fusion = fusePlan({
    kind: 'scan', alignment, segments: extraction.segments, reading: null, knownScale: null, sourceDpi: null,
    segmentRoles: segmentRoleMap(verdicts), extensionAnchors: extensionAnchorMap(verdicts), textLinks: textLinkMap(verdicts),
    roomAreaProbe: () => null,
  });
  return { verdicts, gaps: fusion.dimensionSpans.map((s) => s.gapPx).sort((a, b) => a - b) };
}

describe('ADR-929 §6.21.6 — ίδιο σχέδιο, τέσσερις φάσεις: ίδια αναγνώριση', () => {
  it.each(PHASES_PX)('μετατόπιση %f px: τέσσερα βέλη, δύο ανοίγματα 6.25 και 4.25, κανένα κολοβό', (phase) => {
    const { verdicts, gaps } = recognise(MARGIN_MM + phase * PX_MM);
    const arrowEnds = verdicts.filter((v) => v.role === 'dimension-line')
      .reduce((acc, v) => acc + v.terminators.filter((k) => k === 'arrow').length, 0);
    expect(arrowEnds).toBe(4);
    expect(gaps).toHaveLength(2);
    gaps.forEach((g, i) => expect(Math.abs(g - SPANS_PX[i])).toBeLessThanOrEqual(2));
  });
});

// ── Μονάδα: μάσκα ζωγραφισμένη με το χέρι ─────────────────────────────────────────────────────────────────────────────
const COLS = 80;
const ROWS = 60;
/** Ο άξονας συμμετρίας στο y = 30,00: όριο ανάμεσα στις σειρές 29 και 30. Η γραμμή σχεδιάζεται μόνο στη σειρά 30. */
const AXIS_Y = 30;
const APEX_X = 10;
const ARM_PX = 18;

function maskOf(lines: readonly (readonly [PlanePoint, PlanePoint])[]): InkMask {
  const mask = new Uint8Array(COLS * ROWS);
  for (const [a, b] of lines) {
    const steps = Math.ceil(4 * Math.hypot(b.x - a.x, b.y - a.y));
    for (let i = 0; i <= steps; i++) {
      const x = Math.floor(a.x + ((b.x - a.x) * i) / steps);
      const y = Math.floor(a.y + ((b.y - a.y) * i) / steps);
      if (x >= 0 && y >= 0 && x < COLS && y < ROWS) mask[y * COLS + x] = 1;
    }
  }
  return { mask, cols: COLS, rows: ROWS };
}

/** Η γραμμή διάστασης όπως τη δίνει η ζώνη: στο κέντρο της σειράς 30, μισό pixel κάτω από τον άξονα του βέλους. */
const LINE: FramedSegment = {
  id: 'dim', a: { x: APEX_X + 0.5, y: AXIS_Y + 0.5 }, b: { x: APEX_X + 60.5, y: AXIS_Y + 0.5 },
  u: { x: 1, y: 0 }, n: { x: 0, y: 1 }, length: 60, width: 1, style: 'stroke',
};
const SCALE = { strokePx: 1, reachPx: 16 };

/** Βέλος με κορυφή στον άξονα y = 30,00 και βραχίονες σε μισές γωνίες `upDeg` / `downDeg`. */
function arrowMask(upDeg: number, downDeg: number): InkMask {
  const apex = { x: APEX_X + 0.5, y: AXIS_Y };
  const arm = (deg: number, sign: 1 | -1): PlanePoint => ({
    x: apex.x + ARM_PX * Math.cos((deg * Math.PI) / 180), y: apex.y + sign * ARM_PX * Math.sin((deg * Math.PI) / 180),
  });
  return maskOf([[LINE.a, LINE.b], [apex, arm(upDeg, -1)], [apex, arm(downDeg, 1)], [arm(upDeg, -1), arm(downDeg, 1)]]);
}

describe('ADR-929 §6.21.6 — η κορυφή μέσα στο σφάλμα κβάντισης', () => {
  it('συμμετρικό βέλος 12° με άξονα στο όριο σειρών: βέλος, κορυφή ½ px πάνω από το άκρο', () => {
    const t = detectTerminator(arrowMask(12, 12), LINE, 'start', SCALE);
    expect(t.kind).toBe('arrow');
    expect(t.arrowBody?.apexOffsetPx).toBeLessThan(0);
    expect(t.arrowBody?.apexOffsetPx).toBeGreaterThanOrEqual(-0.5);
  });

  it('ΑΣΥΜΜΕΤΡΟ σχήμα (7° πάνω, 20° κάτω): ΔΕΝ είναι βέλος — η συμμετρία δεν χαλάρωσε', () => {
    expect(detectTerminator(arrowMask(7, 20), LINE, 'start', SCALE).kind).not.toBe('arrow');
  });
});
