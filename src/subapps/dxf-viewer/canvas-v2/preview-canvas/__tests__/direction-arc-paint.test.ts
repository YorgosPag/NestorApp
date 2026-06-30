/**
 * @module direction-arc-paint.test
 * @description ADR-397 §15 / ADR-508 §wall-direction-arc — τόξο φοράς γωνίας: πρόσημο→χρώμα (🟢/🔴) +
 * screen-space γεωμετρία (φορά Y-flip safe, αιχμή στον κέρσορα, ακτίνα/clamp, baseline 0°). Pure unit
 * tests — μηδέν canvas/DOM. Κοινό SSoT για rotation + wall drawing.
 */

import {
  resolveDirectionArcColor,
  resolveDirectionArc,
  DIRECTION_ARC_MIN_SWEEP_DEG,
} from '../direction-arc-paint';

const GREEN = '#2e9e44';
const RED = '#d23b3b';

describe('resolveDirectionArcColor — πρόσημο sweep → χρώμα (SSoT ghost-status)', () => {
  it('θετικό sweep (CCW/πάνω) → πράσινο', () => {
    expect(resolveDirectionArcColor(30)).toBe(GREEN);
    expect(resolveDirectionArcColor(0.5)).toBe(GREEN);
  });

  it('αρνητικό sweep (CW/κάτω) → κόκκινο', () => {
    expect(resolveDirectionArcColor(-30)).toBe(RED);
    expect(resolveDirectionArcColor(-0.5)).toBe(RED);
  });

  it('μηδέν → πράσινο (boundary ≥ 0)', () => {
    expect(resolveDirectionArcColor(0)).toBe(GREEN);
  });
});

describe('resolveDirectionArc — γεωμετρία screen-space', () => {
  const pivot = { x: 100, y: 100 };
  const anchorRight = { x: 200, y: 100 }; // άξονας αναφοράς → +X οθόνης (refAngle = 0)

  it('αμελητέο sweep → null', () => {
    const cursor = { x: 200, y: 100 };
    expect(
      resolveDirectionArc(pivot, anchorRight, cursor, DIRECTION_ARC_MIN_SWEEP_DEG / 2),
    ).toBeNull();
  });

  it('NaN sweep → null', () => {
    expect(resolveDirectionArc(pivot, anchorRight, { x: 100, y: 0 }, NaN)).toBeNull();
  });

  it('κέρσορας ΠΑΝΩ (screen up), world sweep θετικό → sign +1, αιχμή στον κέρσορα, ακτίνα = απόσταση', () => {
    const cursor = { x: 100, y: 0 }; // ευθεία πάνω: curAngle = -π/2
    const arc = resolveDirectionArc(pivot, anchorRight, cursor, 90);
    expect(arc).not.toBeNull();
    if (!arc) return;
    expect(arc.sign).toBe(1);
    expect(arc.radius).toBeCloseTo(100, 6);
    // αιχμή βέλους πέφτει πάνω στον κέρσορα
    expect(arc.tip.x).toBeCloseTo(cursor.x, 6);
    expect(arc.tip.y).toBeCloseTo(cursor.y, 6);
    // screenSweep = -π/2 → anticlockwise στην οθόνη
    expect(arc.anticlockwise).toBe(true);
    expect(arc.startAngle).toBeCloseTo(0, 6);
    expect(arc.endAngle).toBeCloseTo(-Math.PI / 2, 6);
    // baseline 0° = pivot → άξονας αναφοράς (refAngle=0) στην ακτίνα → (200, 100)
    expect(arc.baselineEnd.x).toBeCloseTo(200, 6);
    expect(arc.baselineEnd.y).toBeCloseTo(100, 6);
  });

  it('baseline 0° πάντα σε ακτινική απόσταση = radius κατά τον άξονα αναφοράς', () => {
    const anchorDiag = { x: 180, y: 20 }; // refAngle λοξός
    const arc = resolveDirectionArc(pivot, anchorDiag, { x: 60, y: 180 }, -40);
    expect(arc).not.toBeNull();
    if (!arc) return;
    const d = Math.hypot(arc.baselineEnd.x - pivot.x, arc.baselineEnd.y - pivot.y);
    expect(d).toBeCloseTo(arc.radius, 6);
    // η baseline δείχνει προς τον άξονα αναφοράς (ίδια γωνία με anchor−pivot)
    const refAngle = Math.atan2(anchorDiag.y - pivot.y, anchorDiag.x - pivot.x);
    const baseAngle = Math.atan2(arc.baselineEnd.y - pivot.y, arc.baselineEnd.x - pivot.x);
    expect(Math.atan2(Math.sin(baseAngle - refAngle), Math.cos(baseAngle - refAngle))).toBeCloseTo(0, 6);
  });

  it('χρώμα/πρόσημο ΑΝΕΞΑΡΤΗΤΑ από τη φορά οθόνης (decoupling world sweep ↔ screen)', () => {
    // Ίδια screen γεωμετρία, αρνητικό world sweep → sign −1 παρότι η οθόνη πάει anticlockwise.
    const cursor = { x: 100, y: 0 };
    const arc = resolveDirectionArc(pivot, anchorRight, cursor, -90);
    expect(arc?.sign).toBe(-1);
    expect(arc?.anticlockwise).toBe(true); // φορά οθόνης ίδια· μόνο το χρώμα/πρόσημο αλλάζει
  });

  it('ακτίνα clamp σε ελάχιστο όταν ο κέρσορας είναι κοντά στο pivot', () => {
    const cursor = { x: 103, y: 96 }; // ~5px από pivot, υπό γωνία (όχι colinear με τον άξονα)
    const arcNear = resolveDirectionArc(pivot, anchorRight, cursor, 45);
    expect(arcNear).not.toBeNull();
    expect(arcNear?.radius).toBeGreaterThanOrEqual(32);
  });

  it('αιχμή πάντα σε ακτινική απόσταση = radius από το pivot', () => {
    const cursor = { x: 40, y: 170 };
    const arc = resolveDirectionArc(pivot, anchorRight, cursor, -60);
    expect(arc).not.toBeNull();
    if (!arc) return;
    const d = Math.hypot(arc.tip.x - pivot.x, arc.tip.y - pivot.y);
    expect(d).toBeCloseTo(arc.radius, 6);
    // εφαπτομενικό διάνυσμα μοναδιαίο
    const len = Math.hypot(arc.tipDir.x, arc.tipDir.y);
    expect(len).toBeCloseTo(1, 6);
  });
});
