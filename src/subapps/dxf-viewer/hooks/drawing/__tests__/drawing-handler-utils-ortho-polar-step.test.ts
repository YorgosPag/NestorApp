/**
 * Tests for the shared ORTHO(F8) → POLAR(F10) → fixed-step(F9+Q) constraint SSoT
 * (`resolveOrthoPolarStep` + `worldPolarSnapConfig`) — the ONE pipeline the preview
 * (`drawing-hover-handler`) and BOTH commit paths (`onDrawingPoint` generic +
 * `applyBimDrawingConstraint` BIM) feed through, so the rubber-band equals the
 * committed geometry. Here we pin the deterministic routing + the step delegation.
 */

import { resolveOrthoPolarStep, worldPolarSnapConfig } from '../drawing-handler-utils';
import { cadToggleState } from '../../../systems/constraints/cad-toggle-state';
import { immediateSceneScale } from '../../../systems/cursor/ImmediateSceneScaleStore';
import { QKeyTracker } from '../../../keyboard/QKeyTracker';
import { polarTrackingStore } from '../../../systems/constraints/polar-tracking-store';

const REF = { x: 0, y: 0 };

afterEach(() => {
  cadToggleState.setSnap(false, 0);
  immediateSceneScale.set(1);
  QKeyTracker._setForTest(false);
});

describe('worldPolarSnapConfig — SSoT polar config (was copy-pasted ~4×)', () => {
  it('mirrors the live polar-tracking store + fixed 3° tolerance', () => {
    const cfg = worldPolarSnapConfig();
    expect(cfg.angleTolerance).toBe(3);
    expect(cfg.incrementAngle).toBe(polarTrackingStore.incrementAngle);
    expect(cfg.additionalAngles).toBe(polarTrackingStore.additionalAngles);
  });
});

describe('resolveOrthoPolarStep — ORTHO → POLAR → step routing', () => {
  it('free (no ortho/polar): constrained == raw point, no polar result', () => {
    const p = { x: 137, y: 212 };
    const r = resolveOrthoPolarStep(p, REF, { ortho: false, polar: false });
    expect(r.constrained).toEqual(p);
    expect(r.polarResult).toBeNull();
  });

  it('ORTHO locks to the dominant axis (H when |dx| >= |dy|)', () => {
    const r = resolveOrthoPolarStep({ x: 137, y: 20 }, REF, { ortho: true, polar: false });
    expect(r.constrained).toEqual({ x: 137, y: 0 }); // horizontal lock
    expect(r.polarResult).toBeNull();
  });

  it('ORTHO locks to vertical when |dy| > |dx|', () => {
    const r = resolveOrthoPolarStep({ x: 20, y: 137 }, REF, { ortho: true, polar: false });
    expect(r.constrained).toEqual({ x: 0, y: 137 });
  });

  it('POLAR produces a polar result (overlay tracking-line reads it)', () => {
    const r = resolveOrthoPolarStep({ x: 100, y: 3 }, REF, { ortho: false, polar: true });
    expect(r.polarResult).not.toBeNull();
  });

  it('step is a NO-OP unless SNAP (F9) armed AND Q held — stepped == constrained', () => {
    immediateSceneScale.set(1);
    cadToggleState.setSnap(true, 50); // F9 armed, 5 cm — but Q NOT held
    QKeyTracker._setForTest(false);
    const r = resolveOrthoPolarStep({ x: 137, y: 20 }, REF, { ortho: true, polar: false });
    expect(r.stepped).toEqual(r.constrained); // free movement
  });

  it('with F9 + Q the ORTHO length clicks onto the step grid', () => {
    immediateSceneScale.set(1); // mm scene
    cadToggleState.setSnap(true, 50); // 5 cm
    QKeyTracker._setForTest(true);
    const r = resolveOrthoPolarStep({ x: 137, y: 20 }, REF, { ortho: true, polar: false });
    // ortho → (137, 0); step delta 137 → 150 (nearest 50). preview ≡ commit.
    expect(r.stepped).toEqual({ x: 150, y: 0 });
  });

  it('free + F9 + Q steps the LENGTH along the direction (not per-axis), keeping the angle', () => {
    immediateSceneScale.set(1);
    cadToggleState.setSnap(true, 25);
    QKeyTracker._setForTest(true);
    // 3-4-5 ray: point at length 55 on the (0.6, 0.8) direction → length snaps to 50
    // (nearest 25) → (30, 40). The DIRECTION is preserved (this is the polar-angle fix:
    // step follows the angle, NOT independent X/Y rounding which would give (25,50)/(50,50)).
    const r = resolveOrthoPolarStep({ x: 33, y: 44 }, REF, { ortho: false, polar: false });
    expect(r.stepped.x).toBeCloseTo(30);
    expect(r.stepped.y).toBeCloseTo(40);
  });
});
