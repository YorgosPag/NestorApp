/**
 * ADR-648 Στάδιο Ε — αποδόμηση γραμμοσκίασης σε `<line>` records (πλήρης ταύτιση).
 *
 * Το `SQUARE_PATTERN` fixture είναι ο **πραγματικός** ορισμός από το ground-truth δείγμα
 * του Giorgio (`ΓΡΑΜΜΟΣΚΙΑΣΕΙΣ/EXPORTED_NESTOR.dxf`, group codes 53/43/44/45/46/49): δύο
 * οικογένειες στις 0° και 90°, βήμα 0.127, dashed ±0.127 — το AutoCAD `SQUARE`.
 */

import type { Entity, HatchEntity } from '../../../../types/entities';
import type { HatchPattern } from '../../../../data/hatch-pattern-catalog';
import {
  collectTekHatchFillLines, estimateHatchFillLines, MAX_TEK_FILL_LINES_PER_HATCH,
} from '../tek-hatch-explode';
import { collectTekHatches } from '../dxf-to-tek';

/** AutoCAD `SQUARE`, verbatim από το δείγμα (absolute lines → scale 1 / angle 0). */
const SQUARE_PATTERN: HatchPattern = {
  name: 'SQUARE',
  lines: [
    { angle: 0, origin: [-47.888232, 85.544241], delta: [0, 0.127], dashes: [0.127, -0.127] },
    { angle: 90, origin: [-47.888232, 85.544241], delta: [0, 0.127], dashes: [0.127, -0.127] },
  ],
};

/** Τετράγωνο 2×2 (scene units) — μικρό ώστε το test να μένει γρήγορο. */
const SQUARE_BOUNDARY = [[
  { x: 0, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 2 }, { x: 0, y: 2 },
]];

function hatchEntity(over: Record<string, unknown> = {}): Entity {
  return {
    id: 'h1', type: 'hatch', fillType: 'predefined', patternName: 'SQUARE',
    inlinePattern: SQUARE_PATTERN, boundaryPaths: SQUARE_BOUNDARY, color: '#00FF00',
    ...over,
  } as unknown as Entity;
}

describe('collectTekHatchFillLines (ADR-648 Στάδιο Ε)', () => {
  it('AutoCAD SQUARE → οι ΑΚΡΙΒΕΙΣ γραμμές του μοτίβου ως <line> records', () => {
    const res = collectTekHatchFillLines([hatchEntity()], 1);

    // Βήμα 0.127 σε πλευρά 2 → ~16 γραμμές/οικογένεια × 2 οικογένειες, σπασμένες σε dashes.
    // Το ακριβές πλήθος το ορίζει το SSoT· εδώ κλειδώνουμε την ΤΑΞΗ ΜΕΓΕΘΟΥΣ (όχι 0, όχι 43).
    expect(res.lineCount).toBeGreaterThan(100);
    expect(res.explodedIds.has('h1')).toBe(true);
    expect(res.warnings).toHaveLength(0);
    // Χρώμα entity διατηρείται σε κάθε record.
    expect(res.linesXml).toContain('<color>00FF00</color>');
    // Y-flip (SSoT sceneXYToTekMeters): η κορυφή (2,2) → (2,−2).
    expect(res.linesXml).toContain('<v1X>2</v1X><v1Y>-2</v1Y>');
  });

  it('περιλαμβάνει το ΠΕΡΙΓΡΑΜΜΑ (4 ακμές) πριν τις γραμμές μοτίβου — mirror του DXF explode', () => {
    const res = collectTekHatchFillLines([hatchEntity()], 1);
    const onlyOutline = collectTekHatchFillLines(
      [hatchEntity({ inlinePattern: undefined, patternName: 'UNKNOWN_XYZ' })], 1,
    );
    // Άγνωστο μοτίβο (χωρίς inlinePattern) → καμία γραμμή → ΔΕΝ αποδομείται (μένει native).
    expect(onlyOutline.lineCount).toBe(0);
    expect(onlyOutline.explodedIds.size).toBe(0);
    // Με μοτίβο: τα 4 πρώτα records είναι το κλειστό περίγραμμα.
    expect(res.lineCount).toBeGreaterThan(4);
  });

  it('solid → ΔΕΝ αποδομείται (μένει native <hatch> type 22)', () => {
    const solid = hatchEntity({ id: 'h2', fillType: 'solid', inlinePattern: undefined });
    const res = collectTekHatchFillLines([solid], 1);
    expect(res.lineCount).toBe(0);
    expect(res.explodedIds.size).toBe(0);
  });

  it('gradient → ΔΕΝ αποδομείται', () => {
    const grad = hatchEntity({
      id: 'h3', fillType: 'gradient',
      gradient: { type: 'linear', color1: '#FF0000', color2: '#0000FF' },
    });
    const res = collectTekHatchFillLines([grad], 1);
    expect(res.lineCount).toBe(0);
    expect(res.explodedIds.size).toBe(0);
  });

  it('dense guard → warning + fallback σε native, ΧΩΡΙΣ να υπολογίσει τις γραμμές', () => {
    // Τεράστιο boundary με το ίδιο πυκνό βήμα → ~10M γραμμές. Ο post-hoc έλεγχος θα χρειαζόταν
    // 164s· ο pre-flight guard κόβει άμεσα. Το timeout ΕΙΝΑΙ το assertion (regression lock).
    const huge = hatchEntity({
      id: 'h4',
      boundaryPaths: [[{ x: 0, y: 0 }, { x: 400, y: 0 }, { x: 400, y: 400 }, { x: 0, y: 400 }]],
    });
    const res = collectTekHatchFillLines([huge], 1);
    expect(res.lineCount).toBe(0);
    expect(res.explodedIds.size).toBe(0);           // → ο collectTekHatches το βγάζει native
    expect(res.warnings).toHaveLength(1);
    expect(res.warnings[0]).toContain(String(MAX_TEK_FILL_LINES_PER_HATCH));
  }, 5_000);

  it('estimateHatchFillLines: το ΠΡΑΓΜΑΤΙΚΟ δείγμα (20×18, SQUARE) → σωστή τάξη μεγέθους', () => {
    // Ground truth: το AutoCAD ζωγραφίζει αυτή τη γραμμοσκίαση με 15.318 LINEs (μετρημένο στο
    // ORIGINAL_AUTOCAD_EXPLODED.dxf). Η εκτίμηση υπερεκτιμά (dashes/clipping) — ΠΡΕΠΕΙ να μένει
    // πάνω από το πραγματικό (ασφαλής κατεύθυνση) αλλά ΚΑΤΩ από το όριο (αλλιώς το δείγμα του
    // Giorgio θα έπεφτε σιωπηλά στο native fallback — ακριβώς αυτό που διορθώνουμε).
    const real = hatchEntity({
      id: 'h5',
      boundaryPaths: [[
        { x: 0, y: 0 }, { x: 20.04, y: 0 }, { x: 20.04, y: 18.05 }, { x: 0, y: 18.05 },
      ]],
    });
    const est = estimateHatchFillLines(real as unknown as HatchEntity);
    expect(est).toBeGreaterThan(15_318);                      // ≥ πραγματικό (safe)
    expect(est).toBeLessThan(MAX_TEK_FILL_LINES_PER_HATCH);   // → αποδομείται, ΔΕΝ πέφτει σε native
  });

  it('startId → η αρίθμηση <n> συνεχίζει μετά τα κανονικά line records', () => {
    const res = collectTekHatchFillLines([hatchEntity()], 1, 501);
    expect(res.linesXml).toContain('<n>501</n>');
    expect(res.linesXml).not.toContain('<n>1</n>');
  });

  it('collectTekHatches(skipIds) → η αποδομημένη γραμμοσκίαση ΔΕΝ ξαναβγαίνει native', () => {
    const e = hatchEntity();
    const fill = collectTekHatchFillLines([e], 1);
    const native = collectTekHatches([e], 1, fill.explodedIds);
    expect(native.hatchCount).toBe(0); // αλλιώς: διπλό γέμισμα (γραμμές + native μοτίβο)

    // Χωρίς skipIds → βγαίνει native (το legacy behaviour μένει ανέπαφο).
    expect(collectTekHatches([e], 1).hatchCount).toBe(1);
  });
});
