/**
 * ADR-363 §5.6 — column-aspect SSoT (κολόνα↔τοιχίο βάσει αναλογίας πλευρών).
 *
 * Καλύπτει: rounded aspect (order-agnostic + degenerate), κατώφλι shear-wall
 * (ΑΥΣΤΗΡΑ > 4· ακριβώς 4 = κολόνα), edit-time crossing detector (guard μόνο στη
 * μετάβαση, μόνο ορθογώνιες) + footprint-preserving reclassify σε shear-wall.
 */

import {
  roundedRectAspect,
  isShearWallAspect,
  rectParamsAspect,
  detectRectColumnBecomesWall,
  detectColumnBecomesWall,
  reclassifyRectToShearWall,
} from '../column-aspect';
import {
  DEFAULT_COLUMN_BASE_BINDING,
  DEFAULT_COLUMN_TOP_BINDING,
} from '../../types/bim-binding';
import type { ColumnKind, ColumnParams } from '../../types/column-types';

function makeParams(over: Partial<ColumnParams> & { kind?: ColumnKind }): ColumnParams {
  return {
    kind: 'rectangular',
    position: { x: 0, y: 0, z: 0 },
    anchor: 'center',
    width: 400,
    depth: 400,
    height: 3000,
    rotation: 0,
    baseBinding: DEFAULT_COLUMN_BASE_BINDING,
    topBinding: DEFAULT_COLUMN_TOP_BINDING,
    ...over,
  };
}

describe('roundedRectAspect', () => {
  it('long/short στρογγυλεμένο σε 1dp', () => {
    expect(roundedRectAspect(400, 400)).toBe(1);
    expect(roundedRectAspect(2000, 400)).toBe(5);
    expect(roundedRectAspect(1000, 250)).toBe(4);
    expect(roundedRectAspect(1100, 250)).toBe(4.4);
  });

  it('order-agnostic (max/min)', () => {
    expect(roundedRectAspect(400, 2000)).toBe(5);
    expect(roundedRectAspect(2000, 400)).toBe(5);
  });

  it('εκφυλισμένο (μικρή πλευρά ≤ 0) → 0', () => {
    expect(roundedRectAspect(100, 0)).toBe(0);
    expect(roundedRectAspect(0, 0)).toBe(0);
  });

  it('float 4:1 → 4.0 (rounding κρατά «κολόνα», ΟΧΙ ψευδώς τοιχίο)', () => {
    expect(roundedRectAspect(1000.0000000004, 250)).toBe(4);
  });
});

describe('isShearWallAspect', () => {
  it('ΑΥΣΤΗΡΑ > 4 → τοιχίο· ακριβώς 4 = κολόνα', () => {
    expect(isShearWallAspect(4)).toBe(false);
    expect(isShearWallAspect(4.1)).toBe(true);
    expect(isShearWallAspect(3.9)).toBe(false);
    expect(isShearWallAspect(5)).toBe(true);
  });
});

describe('rectParamsAspect', () => {
  it('από width/depth ανεξαρτήτως σειράς', () => {
    expect(rectParamsAspect({ width: 2000, depth: 400 })).toBe(5);
    expect(rectParamsAspect({ width: 400, depth: 2000 })).toBe(5);
  });
});

describe('detectRectColumnBecomesWall', () => {
  it('rectangular κολόνα (aspect 1) → rectangular aspect 5 → crossing', () => {
    const prev = makeParams({ width: 400, depth: 400 });
    const next = makeParams({ width: 2000, depth: 400 });
    const res = detectRectColumnBecomesWall(prev, next);
    expect(res).not.toBeNull();
    expect(res?.aspect).toBe(5);
    expect(res?.longSideMm).toBe(2000);
    expect(res?.shortSideMm).toBe(400);
  });

  it('όριο: νέο aspect ακριβώς 4 → όχι crossing (μένει κολόνα)', () => {
    const prev = makeParams({ width: 400, depth: 400 });
    const next = makeParams({ width: 1000, depth: 250 });
    expect(detectRectColumnBecomesWall(prev, next)).toBeNull();
  });

  it('prev ήδη τοιχίο-aspect → null (καμία επανα-ειδοποίηση)', () => {
    const prev = makeParams({ width: 2000, depth: 400 });
    const next = makeParams({ width: 2500, depth: 400 });
    expect(detectRectColumnBecomesWall(prev, next)).toBeNull();
  });

  it('μη-ορθογώνιο prev (circular) → null (scope: μόνο ορθογώνιες)', () => {
    const prev = makeParams({ kind: 'circular', width: 400, depth: 400 });
    const next = makeParams({ kind: 'circular', width: 2000, depth: 400 });
    expect(detectRectColumnBecomesWall(prev, next)).toBeNull();
  });

  it('next kind όχι rectangular → null', () => {
    const prev = makeParams({ width: 400, depth: 400 });
    const next = makeParams({ kind: 'shear-wall', width: 2000, depth: 400 });
    expect(detectRectColumnBecomesWall(prev, next)).toBeNull();
  });
});

describe('detectColumnBecomesWall (ADR-363 §5.6c — ΓΕΝΙΚΟ, όλοι οι τύποι)', () => {
  it('ορθογώνιο επιμήκες → crossing + canReclassify=true', () => {
    const res = detectColumnBecomesWall(makeParams({ width: 400, depth: 400 }), makeParams({ width: 2000, depth: 400 }));
    expect(res?.aspect).toBe(5);
    expect(res?.canReclassify).toBe(true);
  });

  it('Τ επιμήκες (bbox aspect > 4) → crossing + canReclassify=false (advisory)', () => {
    const prev = makeParams({ kind: 'T-shape', width: 400, depth: 400 });
    const next = makeParams({ kind: 'T-shape', width: 2000, depth: 400 });
    const res = detectColumnBecomesWall(prev, next);
    expect(res).not.toBeNull();
    expect(res?.aspect).toBe(5);
    expect(res?.canReclassify).toBe(false);
  });

  it('Γ επιμήκες σε ΟΠΟΙΑΔΗΠΟΤΕ κατεύθυνση (depth) → crossing (advisory)', () => {
    const prev = makeParams({ kind: 'L-shape', width: 400, depth: 400 });
    const next = makeParams({ kind: 'L-shape', width: 400, depth: 2200 });
    expect(detectColumnBecomesWall(prev, next)?.canReclassify).toBe(false);
  });

  it('circular/polygon (συμμετρικά) → null (ποτέ wall-like)', () => {
    const c = detectColumnBecomesWall(makeParams({ kind: 'circular', width: 400 }), makeParams({ kind: 'circular', width: 2000 }));
    const p = detectColumnBecomesWall(makeParams({ kind: 'polygon', width: 400 }), makeParams({ kind: 'polygon', width: 2000 }));
    expect(c).toBeNull();
    expect(p).toBeNull();
  });

  it('shear-wall (ΗΔΗ τοιχίο) → null (καλύπτεται από §5.6b extent)', () => {
    const prev = makeParams({ kind: 'shear-wall', width: 400, depth: 400 });
    const next = makeParams({ kind: 'shear-wall', width: 2000, depth: 400 });
    expect(detectColumnBecomesWall(prev, next)).toBeNull();
  });

  it('prev ήδη επιμήκες → null (μηδέν re-nag)', () => {
    const prev = makeParams({ kind: 'T-shape', width: 2000, depth: 400 });
    const next = makeParams({ kind: 'T-shape', width: 2500, depth: 400 });
    expect(detectColumnBecomesWall(prev, next)).toBeNull();
  });
});

describe('reclassifyRectToShearWall', () => {
  it('landscape (width ≥ depth) → kind shear-wall, ίδιες διαστάσεις/γωνία', () => {
    const res = reclassifyRectToShearWall(makeParams({ width: 2000, depth: 400, rotation: 30 }));
    expect(res.kind).toBe('shear-wall');
    expect(res.width).toBe(2000);
    expect(res.depth).toBe(400);
    expect(res.rotation).toBe(30);
  });

  it('portrait (width < depth) → swap width↔depth + rotation +90° (ίδιο footprint)', () => {
    const res = reclassifyRectToShearWall(makeParams({ width: 400, depth: 2000, rotation: 0 }));
    expect(res.kind).toBe('shear-wall');
    expect(res.width).toBe(2000);
    expect(res.depth).toBe(400);
    expect(res.rotation).toBe(90);
  });
});
