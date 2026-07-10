/**
 * ADR-526 — tests για τον mapper `TekStairRecord` → `StairEntity`. Επαληθεύει
 * μονάδες (μέτρα→mm), Y-flip, διατήρηση ύψους ορόφου, και επιλογή variant.
 */

import { tekStairToEntity } from '../tek-stair-to-bim';
import type { TekStairRecord, TekPoint2D } from '../tek-import-types';

/** Σκάλα-δείγμα: 90° στροφή (winder), ΔΥψος 2.9m, ρίχτι 0.17059 → 17 βαθμίδες. */
function sampleRecord(overrides: Partial<TekStairRecord> = {}): TekStairRecord {
  const walkline: TekPoint2D[] = [
    { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 1 }, { x: 2, y: 2 },
    { x: -49, y: 60 }, // outlier label anchor (~78m μακριά) — πρέπει να φιλτράρεται
  ];
  return {
    rawXml: '<record><type>21</type></record>',
    polylines: [walkline],
    startElevationM: 0,
    endElevationM: 2.9,
    steps: 16,
    landings: 0,
    stairWidthM: 0.8,
    treadGoingM: 0.27433959051075801,
    riserHeightM: 0.17058823529411801,
    waistThicknessM: 0.15,
    walklineLengthM: 4.38943344817213,
    minStepWidthM: 0.07,
    stepsNumbering: true,
    ...overrides,
  };
}

/**
 * Ρεαλιστική ΕΥΘΕΙΑ σκάλα όπως πραγματικό `.tek` (ΣΚΑΛΑ-2): πολλαπλές `<point2d>` ομάδες
 * (2-point overall rails + 17-point per-step ακμές αριστερά/δεξιά/κέντρο) + sentinel `(0,0)`.
 * Πλάτος 1.2m (x: 6.55→7.75), 16 πατήματα, ΔΥψος 3m, πάτημα 0.275, landings 0.
 */
function realStraightRecord(overrides: Partial<TekStairRecord> = {}): TekStairRecord {
  const ys: number[] = [];
  for (let i = 0; i < 17; i += 1) ys.push(11.2 - i * 0.275);
  const sentinel: TekPoint2D = { x: 0, y: 0 };
  const edge = (x: number): TekPoint2D[] => [...ys.map((y) => ({ x, y })), sentinel];
  return {
    rawXml: '<record><type>21</type></record>',
    polylines: [
      [{ x: 6.55, y: 11.2 }, { x: 6.55, y: 6.8 }],
      [{ x: 7.75, y: 11.2 }, { x: 7.75, y: 6.8 }],
      [{ x: 7.15, y: 11.2 }, { x: 7.15, y: 6.8 }],
      edge(6.55), edge(7.75), edge(7.15),
    ],
    startElevationM: 0,
    endElevationM: 3,
    steps: 16,
    landings: 0,
    stairWidthM: 1.2,
    treadGoingM: 0.275,
    riserHeightM: 3 / 17,
    waistThicknessM: 0.15,
    walklineLengthM: 4.4,
    minStepWidthM: 0.07,
    stepsNumbering: true,
    ...overrides,
  };
}

describe('tekStairToEntity — ρεαλιστική ευθεία σκάλα (ΣΚΑΛΑ-2)', () => {
  it('landings=0 + καθαρή γραμμή πορείας → straight (ΟΧΙ winder από sentinel (0,0))', () => {
    const e = tekStairToEntity(realStraightRecord(), 'level-1');
    expect(e.params.variant.kind).toBe('straight');
  });

  it('basePoint στο ΚΕΝΤΡΟ της σκάλας (7.15m), όχι στην ακμή — Y-flip → (7150, -11200)mm', () => {
    const e = tekStairToEntity(realStraightRecord());
    expect(e.params.basePoint.x).toBeCloseTo(7150, 1);
    expect(e.params.basePoint.y).toBeCloseTo(-11200, 1);
  });

  it('κατεύθυνση κατά μήκος της σκάλας (~90°) και σωστές διαστάσεις', () => {
    const e = tekStairToEntity(realStraightRecord());
    expect(e.params.direction).toBeCloseTo(90, 0);
    expect(e.params.stepCount).toBe(17);
    expect(e.params.tread).toBeCloseTo(275, 1);
    expect(e.params.width).toBeCloseTo(1200, 1);
    expect(e.params.totalRise).toBeCloseTo(3000, 3);
  });
});

describe('tekStairToEntity', () => {
  it('παράγει stair entity με σωστό type/levelId', () => {
    const e = tekStairToEntity(sampleRecord(), 'level-1');
    expect(e.type).toBe('stair');
    expect(e.levelId).toBe('level-1');
    expect(e.id).toMatch(/.+/);
    expect(e.visible).toBe(true);
  });

  it('stepCount από το ρίχτι (round(2.9/0.17059) = 17), όχι από steps=16', () => {
    const e = tekStairToEntity(sampleRecord());
    expect(e.params.stepCount).toBe(17);
  });

  it('preserve-and-replay: κρατά το αυθεντικό record στο sourceTekRecord (ADR-526 Φ3)', () => {
    const e = tekStairToEntity(sampleRecord({ rawXml: '<record><type>21</type><n>1</n></record>' }));
    expect(e.sourceTekRecord).toBe('<record><type>21</type><n>1</n></record>');
  });

  it('διατηρεί ΑΚΡΙΒΩΣ το ύψος ορόφου (totalRise === 2900mm)', () => {
    const e = tekStairToEntity(sampleRecord());
    expect(e.params.totalRise).toBeCloseTo(2900, 3);
    expect(e.params.rise).toBeCloseTo(2900 / 17, 3);
  });

  it('πάτημα/πλάτος σε mm (μέτρα × 1000)', () => {
    const e = tekStairToEntity(sampleRecord());
    expect(e.params.tread).toBeCloseTo(274.34, 1);
    expect(e.params.width).toBeCloseTo(800, 1);
  });

  it('Y-flip: το basePoint έχει αρνητικό Y στον καμβά (Τέκτων Y-up → καμβάς Y-down)', () => {
    // walkline ξεκινά στο (0,0) → base (0, -0) ≈ 0· δοκιμή με μη-μηδενικό Y.
    const e = tekStairToEntity(sampleRecord({
      polylines: [[{ x: 1, y: 5 }, { x: 2, y: 5 }, { x: 2, y: 6 }]],
    }));
    expect(e.params.basePoint.x).toBeCloseTo(1000, 3);
    expect(e.params.basePoint.y).toBeCloseTo(-5000, 3);
  });

  it('ανιχνεύει winder στη στροφή 90° με winderCount ≈ 3', () => {
    const e = tekStairToEntity(sampleRecord());
    expect(e.params.variant.kind).toBe('winder');
    if (e.params.variant.kind === 'winder') {
      expect(Math.abs(e.params.variant.turnAngle)).toBeCloseTo(90, 0);
      expect(e.params.variant.winderCount).toBe(3);
    }
  });

  it('ευθεία walkline → straight variant', () => {
    const straight = sampleRecord({
      polylines: [[{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }]],
    });
    const e = tekStairToEntity(straight);
    expect(e.params.variant.kind).toBe('straight');
  });

  it('μεταφέρει το πάχος μηρού (slope_h) σε waistThickness mm', () => {
    const e = tekStairToEntity(sampleRecord());
    expect(e.params.waistThickness).toBeCloseTo(150, 3);
  });
});
