/**
 * Unit tests — radial-ring-logic (ADR-513): TAB-order, lock-highlight, live μήκος/γωνία
 * και οι μετατροπές μονάδων του «Δαχτυλιδιού Εντολών».
 */

import {
  RING_TAB_ORDER,
  nextRingField,
  isRingFieldLocked,
  computeLiveLengthAngle,
  lengthDisplayToSceneLock,
  normalizeAngleDeg,
  WEDGE_ANGLES,
  RING_OPACITY,
  RING_HOVER_OPACITY,
  RING_INNER_R,
  RING_OUTER_R,
  polarPoint,
  pieSectorPath,
  wedgeAtAngle,
  cursorZone,
  pushWheelCenter,
  advanceWheelCenter,
  RING_INSIDE_FOLLOW_RATIO,
} from '../radial-ring-logic';

describe('RING_TAB_ORDER', () => {
  it('is Μήκος → Γωνία → Πάχος → Ύψος (locked decision)', () => {
    expect(RING_TAB_ORDER).toEqual(['length', 'angle', 'thickness', 'height']);
  });
});

describe('nextRingField', () => {
  it('cycles forward', () => {
    expect(nextRingField('length', false)).toBe('angle');
    expect(nextRingField('angle', false)).toBe('thickness');
    expect(nextRingField('thickness', false)).toBe('height');
  });
  it('wraps forward from the last field', () => {
    expect(nextRingField('height', false)).toBe('length');
  });
  it('cycles backward with Shift', () => {
    expect(nextRingField('angle', true)).toBe('length');
    expect(nextRingField('length', true)).toBe('height');
  });
});

describe('isRingFieldLocked', () => {
  it('highlights only the matching geometry field', () => {
    expect(isRingFieldLocked('length', 'length')).toBe(true);
    expect(isRingFieldLocked('angle', 'angle')).toBe(true);
  });
  it('never highlights thickness/height (override-driven, not lock)', () => {
    expect(isRingFieldLocked('thickness', 'length')).toBe(false);
    expect(isRingFieldLocked('height', 'angle')).toBe(false);
  });
  it('is false when nothing is locked', () => {
    expect(isRingFieldLocked('length', null)).toBe(false);
  });
});

describe('computeLiveLengthAngle (mm scene = identity factor)', () => {
  const START = { x: 100, y: 100 };
  it('measures a horizontal segment', () => {
    const r = computeLiveLengthAngle(START, { x: 400, y: 100 }, 'mm');
    expect(r.lengthMm).toBeCloseTo(300);
    expect(r.angleDeg).toBeCloseTo(0);
  });
  it('normalizes a downward (−y) segment into 0..360', () => {
    const r = computeLiveLengthAngle(START, { x: 100, y: 0 }, 'mm');
    expect(r.lengthMm).toBeCloseTo(100);
    expect(r.angleDeg).toBeCloseTo(270);
  });
  it('converts scene→mm for a metre scene (×1000)', () => {
    const r = computeLiveLengthAngle({ x: 0, y: 0 }, { x: 3, y: 0 }, 'm');
    expect(r.lengthMm).toBeCloseTo(3000);
  });
});

describe('lengthDisplayToSceneLock', () => {
  it('mm display + mm scene = identity', () => {
    expect(lengthDisplayToSceneLock(3000, 'mm', 'mm')).toBeCloseTo(3000);
  });
  it('metre display + mm scene → mm', () => {
    expect(lengthDisplayToSceneLock(3, 'm', 'mm')).toBeCloseTo(3000);
  });
  it('metre display + metre scene → scene metres', () => {
    expect(lengthDisplayToSceneLock(3, 'm', 'm')).toBeCloseTo(3);
  });
});

describe('normalizeAngleDeg', () => {
  it('wraps negatives into [0,360)', () => expect(normalizeAngleDeg(-90)).toBeCloseTo(270));
  it('wraps values ≥360', () => expect(normalizeAngleDeg(450)).toBeCloseTo(90));
  it('keeps in-range values', () => expect(normalizeAngleDeg(30)).toBeCloseTo(30));
});

describe('NavWheel specs', () => {
  it('inner (visible) circle is smaller than outer (deadzone) circle', () => {
    expect(RING_INNER_R).toBeLessThan(RING_OUTER_R);
  });
  it('wedges are translucent· hover πιο αδιαφανές', () => {
    expect(RING_OPACITY).toBeLessThan(0.5); // «ακόμη πιο διαφανή» (Giorgio)
    expect(RING_HOVER_OPACITY).toBeGreaterThan(RING_OPACITY);
  });
});

describe('wedgeAtAngle (cardinal sectors)', () => {
  it('270° → Μήκος (top)', () => expect(wedgeAtAngle(270)).toBe('length'));
  it('0° → Γωνία (right)', () => expect(wedgeAtAngle(0)).toBe('angle'));
  it('180° → Πάχος (left)', () => expect(wedgeAtAngle(180)).toBe('thickness'));
  it('90° → Ύψος (bottom)', () => expect(wedgeAtAngle(90)).toBe('height'));
  it('wraps negatives/over-360 (−10° → Γωνία)', () => expect(wedgeAtAngle(-10)).toBe('angle'));
});

describe('cursorZone (two concentric circles)', () => {
  it('inside the visible circle', () => expect(cursorZone(10, 52, 96)).toBe('inside'));
  it('in the deadzone annulus', () => expect(cursorZone(70, 52, 96)).toBe('annulus'));
  it('beyond the outer circle', () => expect(cursorZone(120, 52, 96)).toBe('outside'));
  it('on the inner boundary = inside', () => expect(cursorZone(52, 52, 96)).toBe('inside'));
});

describe('pushWheelCenter (finger-in-ring deadzone)', () => {
  const C = { x: 100, y: 100 };
  it('does NOT move while the cursor stays within the outer circle', () => {
    expect(pushWheelCenter(C, { x: 140, y: 100 }, 96)).toEqual(C); // d=40 ≤ 96
  });
  it('drags so the cursor sits exactly on the outer rim once it overshoots', () => {
    const out = pushWheelCenter(C, { x: 300, y: 100 }, 96); // d=200 > 96, along +x
    expect(out.x).toBeCloseTo(300 - 96); // cursor stays 96px from new center
    expect(out.y).toBeCloseTo(100);
    expect(Math.hypot(300 - out.x, 100 - out.y)).toBeCloseTo(96);
  });
});

describe('advanceWheelCenter (zone-based, Giorgio: inside = half-speed)', () => {
  const C = { x: 100, y: 100 };
  it('RING_INSIDE_FOLLOW_RATIO is 0.5 (cursor 1 → wheel 1/2)', () => {
    expect(RING_INSIDE_FOLLOW_RATIO).toBeCloseTo(0.5);
  });
  it('inside → wheel follows at half the cursor delta', () => {
    const out = advanceWheelCenter(C, { x: 100, y: 100 }, { x: 120, y: 100 }, 'inside');
    expect(out.x).toBeCloseTo(110); // cursor moved +20 → wheel +10
    expect(out.y).toBeCloseTo(100);
  });
  it('annulus → wheel stays put (deadzone)', () => {
    expect(advanceWheelCenter(C, { x: 100, y: 100 }, { x: 120, y: 100 }, 'annulus')).toEqual(C);
  });
  it('outside → pushed onto the outer rim', () => {
    const out = advanceWheelCenter(C, { x: 100, y: 100 }, { x: 300, y: 100 }, 'outside', 0.5, 96);
    expect(Math.hypot(300 - out.x, 100 - out.y)).toBeCloseTo(96);
  });
});

describe('WEDGE_ANGLES', () => {
  it('places Μήκος top, Γωνία right, Πάχος left, Ύψος bottom', () => {
    expect(WEDGE_ANGLES.length.centerDeg).toBe(270);
    expect(WEDGE_ANGLES.angle.centerDeg).toBe(0);
    expect(WEDGE_ANGLES.thickness.centerDeg).toBe(180);
    expect(WEDGE_ANGLES.height.centerDeg).toBe(90);
  });
  it('every wedge spans exactly 90° (4 wedges = full circle, no overlap)', () => {
    for (const w of Object.values(WEDGE_ANGLES)) expect(w.a1 - w.a0).toBe(90);
  });
});

describe('polarPoint (y-down screen space)', () => {
  it('0° → +x', () => expect(polarPoint(0, 0, 10, 0)).toEqual({ x: 10, y: 0 }));
  it('90° → +y (down)', () => {
    const p = polarPoint(0, 0, 10, 90);
    expect(p.x).toBeCloseTo(0);
    expect(p.y).toBeCloseTo(10);
  });
  it('270° → −y (up)', () => {
    const p = polarPoint(0, 0, 10, 270);
    expect(p.y).toBeCloseTo(-10);
  });
});

describe('pieSectorPath (full sector, ΧΩΡΙΣ hub)', () => {
  const d = pieSectorPath(96, 96, 52, 225, 315);
  it('starts at the CENTER (πλήρης τομέας, χωρίς τρύπα)', () => {
    expect(d.startsWith('M 96 96')).toBe(true);
  });
  it('is a closed sector path (M center L … A … Z)', () => {
    expect(d).toContain(' L ');
    expect((d.match(/A /g) ?? []).length).toBe(1); // ένα τόξο (περιφέρεια)
    expect(d.endsWith('Z')).toBe(true);
  });
  it('draws the rim to the edge of a1', () => {
    const p1 = polarPoint(96, 96, 52, 315);
    expect(d).toContain(`${p1.x} ${p1.y}`);
  });
  it('uses large-arc-flag 0 for a 90° wedge', () => {
    expect(d).toContain('A 52 52 0 0 1');
  });
});
