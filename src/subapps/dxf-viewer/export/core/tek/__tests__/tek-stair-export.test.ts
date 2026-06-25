/**
 * ADR-526 ΦΑΣΗ 3 (Tekton .TEK EXPORT — σκάλες) — stair `<record>` (type 21) writer + collector.
 *
 * Επαληθεύει: point2d/intlist σειριοποίηση (κενά + γεμάτα)· πλήρες record (scalars +
 * point2d/intlist σειρά + μηδέν placeholder leftover)· collectTekStairs με ΠΡΑΓΜΑΤΙΚΗ
 * `StairGeometry` (SSoT factory) → scene→μέτρα + Τέκτων `<steps>` = ρίχτια − 1.
 *
 * Καθρέφτης του import (ADR-526 Φ1, `tek-stair-extract`/`tek-stair-to-bim`).
 */

import {
  buildStairPoint2dXml, buildStairIntlistXml, buildStairRecordXml,
} from '../tek-xml-writer';
import { collectTekStairs } from '../bim-to-tek';
import { sceneXYToTekMeters } from '../tek-geometry';
import type { TekStair } from '../tek-types';
import {
  buildDefaultStairParams, buildStairEntity,
} from '../../../../hooks/drawing/stair-completion';
import type { Entity } from '../../../../types/entities';

describe('buildStairPoint2dXml', () => {
  it('κενή πολυγραμμή → <point2d>\\n</point2d>', () => {
    expect(buildStairPoint2dXml([])).toBe('<point2d>\n</point2d>');
  });
  it('κορυφές → <record><pX>/<pY> (μηδέν εκθετική, trimmed)', () => {
    const xml = buildStairPoint2dXml([{ x: 1.5, y: -2.25 }, { x: 3, y: 0 }]);
    expect((xml.match(/<record>/g) ?? []).length).toBe(2);
    expect(xml).toContain('<pX>1.5</pX><pY>-2.25</pY>');
    expect(xml).toContain('<pX>3</pX><pY>0</pY>');
    expect(xml.startsWith('<point2d>')).toBe(true);
    expect(xml.endsWith('</point2d>')).toBe(true);
  });
});

describe('buildStairIntlistXml', () => {
  it('κενή λίστα → <intlist>\\n</intlist>', () => {
    expect(buildStairIntlistXml([])).toBe('<intlist>\n</intlist>');
  });
  it('segment types → <i> items (στρογγυλοποίηση)', () => {
    expect(buildStairIntlistXml([2, 2, 1])).toBe('<intlist>\n<i>2</i><i>2</i><i>1</i></intlist>');
  });
});

describe('sceneXYToTekMeters (Y-flip SSoT)', () => {
  it('scene (x,y, Y-down) → μέτρα (Y-up), |0| αντί −0', () => {
    expect(sceneXYToTekMeters(1000, 2000, 0.001)).toEqual({ x: 1, y: -2 });
    expect(sceneXYToTekMeters(0, 0, 0.001)).toEqual({ x: 0, y: 0 }); // 0, όχι −0
  });
});

describe('buildStairRecordXml', () => {
  const stair: TekStair = {
    id: 1,
    startElevationM: 0,
    endElevationM: 2.9,
    steps: 16,
    landings: 0,
    stairWidthM: 0.8,
    treadGoingM: 0.274,
    riserHeightM: 0.17,
    waistThicknessM: 0.15,
    walklineLengthM: 4.389,
    minStepWidthM: 0,
    stepsNumbering: true,
    arrow: [{ x: 0, y: 0 }, { x: 4, y: 0 }],
    stepLines: [{ x: 0, y: 0 }, { x: 0, y: -0.8 }, { x: 0.274, y: 0 }, { x: 0.274, y: -0.8 }],
    innerContour: [{ x: 0, y: 0 }, { x: 4, y: 0 }],
    outerContour: [{ x: 0, y: -0.8 }, { x: 4, y: -0.8 }],
    walkline: [{ x: 0, y: -0.4 }, { x: 4, y: -0.4 }],
  };

  it('type 21 + id + κανένα {{…}} leftover', () => {
    const xml = buildStairRecordXml(stair);
    expect(xml).not.toMatch(/\{\{/);
    expect(xml).toContain('<type>21</type>');
    expect(xml).toContain('<n>1</n>');
  });

  it('scalars (στάθμες/πλήθος/διαστάσεις/μήκος πορείας) γεμίζονται από το TekStair', () => {
    const xml = buildStairRecordXml(stair);
    expect(xml).toContain('<start_elevation>0</start_elevation>');
    expect(xml).toContain('<end_elevation>2.9</end_elevation>');
    expect(xml).toContain('<steps>16</steps>');
    expect(xml).toContain('<landings>0</landings>');
    expect(xml).toContain('<stair_width>0.8</stair_width>');
    expect(xml).toContain('<horiz_b>0.274</horiz_b>');
    expect(xml).toContain('<vert_b>0.17</vert_b>');
    expect(xml).toContain('<slope_h>0.15</slope_h>');
    expect(xml).toContain('<wlength>4.389</wlength>');
    expect(xml).toContain('<steps_numbering>1</steps_numbering>');
    expect(xml).toContain('<min_step_width>0</min_step_width>');
  });

  it('FESPA-fixed schema: 8 point2d (3+5) + 7 intlist, σωστή σειρά', () => {
    const xml = buildStairRecordXml(stair);
    expect((xml.match(/<point2d>/g) ?? []).length).toBe(8);
    expect((xml.match(/<intlist>/g) ?? []).length).toBe(7);
    // η ουρά (start_elevation) έρχεται ΜΕΤΑ τα point2d (σειρά στοιχείων όπως το δείγμα).
    expect(xml.indexOf('<point2d>')).toBeLessThan(xml.indexOf('<start_elevation>'));
  });

  it('walkline/contour κορυφές σειριοποιούνται (μέτρα, Y-flipped)', () => {
    const xml = buildStairRecordXml(stair);
    expect(xml).toContain('<pX>0</pX><pY>-0.4</pY>'); // walkline
    expect(xml).toContain('<pX>4</pX><pY>-0.8</pY>'); // outer contour
  });

  it('intlist segment-count = κορυφές/2 (ανεξάρτητα τμήματα, ΟΧΙ N−1) — αλλιώς ο Τέκτων δεν ανοίγει', () => {
    // stepLines = 4 κορυφές → 2 γραμμές × 2 σημεία = "2 2" (ΟΧΙ "2 2 2"· ground-truth: 8 σημεία→4).
    const xml = buildStairRecordXml(stair);
    expect(xml).toContain('<intlist>\n<i>2</i><i>2</i></intlist>'); // stepLines: 4/2 = 2
    expect(xml).toContain('<intlist>\n<i>2</i></intlist>');         // arrow: 2/2 = 1
    // Καμία intlist με 3 "2" (το παλιό N−1 bug θα έβγαζε 3 → parser overrun).
    expect(xml).not.toContain('<i>2</i><i>2</i><i>2</i>');
  });

  it('stepsNumbering false → 0', () => {
    expect(buildStairRecordXml({ ...stair, stepsNumbering: false }))
      .toContain('<steps_numbering>0</steps_numbering>');
  });
});

// ── collectTekStairs με ΠΡΑΓΜΑΤΙΚΗ γεωμετρία (SSoT factory) ──
function makeStraightStair(): Entity {
  const params = buildDefaultStairParams(
    { x: 1000, y: 1000, z: 0 }, 0,
    { rise: 181.25, tread: 274, width: 800, stepCount: 16 }, 'mm',
  );
  return buildStairEntity(params, 'level-1') as unknown as Entity;
}

describe('collectTekStairs', () => {
  it('μία StairEntity (mm scene) → ένα <record> type 21, scalars σε μέτρα', () => {
    const r = collectTekStairs([makeStraightStair()], 0.001);
    expect(r.stairCount).toBe(1);
    expect(r.stairsXml).toContain('<type>21</type>');
    expect(r.stairsXml).toContain('<stair_width>0.8</stair_width>'); // 800mm → 0.8m
    expect(r.stairsXml).toContain('<horiz_b>0.274</horiz_b>');       // 274mm → 0.274m
    // Τέκτων <steps> = πατήματα = ρίχτια(stepCount=16) − 1 = 15.
    expect(r.stairsXml).toContain('<steps>15</steps>');
  });

  it('3Δ consistency: (steps+1) × vert_b == end − start ΑΚΡΙΒΩΣ — αλλιώς ο Τέκτων δεν χτίζει 3Δ', () => {
    const xml = collectTekStairs([makeStraightStair()], 0.001).stairsXml;
    const num = (tag: string): number =>
      Number((xml.match(new RegExp(`<${tag}>([^<]*)</${tag}>`)) ?? [])[1]);
    const steps = num('steps');
    const vertB = num('vert_b');
    const span = num('end_elevation') - num('start_elevation');
    expect((steps + 1) * vertB).toBeCloseTo(span, 6);
  });

  it('περίγραμμα/πορεία ΠΥΚΝΩΜΕΝΑ (ένας κόμβος ανά βαθμίδα) — όχι 2 άκρα (αλλιώς ο Τέκτων κολλάει στο 3Δ)', () => {
    const r = collectTekStairs([makeStraightStair()], 0.001);
    // 3 πυκνά slots (inner/outer/walkline) × ~stepCount(16) + stepLines + arrow → πολλά σημεία.
    // (Με μόνο 2-σημεία περιγράμματα θα ήταν ~6· τώρα ≥ 3×16.)
    expect((r.stairsXml.match(/<pX>/g) ?? []).length).toBeGreaterThanOrEqual(48);
  });

  it('μη-stair entity αγνοείται', () => {
    const line = { id: 'l', type: 'line' } as unknown as Entity;
    expect(collectTekStairs([line], 0.001).stairCount).toBe(0);
  });

  it('χωρίς σκάλες → κενό stairsXml', () => {
    expect(collectTekStairs([], 0.001)).toEqual({ stairsXml: '', stairCount: 0 });
  });
});
