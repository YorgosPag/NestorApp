/**
 * ADR-397 — Move-glyph zone hit-test tests (Giorgio 2026-06-17).
 *
 * `resolveMoveGlyphZone` classifies a screen cursor into center / ±X / ±Y in the
 * glyph's local screen frame (un-rotated by the glyph angle). Verifies the centre
 * disc, the four arms, rotation handling, and the outside-handle `null`.
 */

import {
  resolveMoveGlyphZone, isDirectionalZone, resolveMoveGlyphZoneForGrip,
  directionForZone, worldZoneToLocalArm, type MoveGlyphZone,
} from '../move-glyph-zones';
import { resolveMoveGlyphFrame, type MoveGlyphFrame } from '../move-glyph-frame';
import { CoordinateTransforms } from '../../../rendering/core/CoordinateTransforms';
import type { Entity } from '../../../types/entities';
import type { Point2D } from '../../../rendering/types/Types';

const BASE = { centerScreen: { x: 100, y: 100 }, screenAngleRad: 0, armPx: 20, tolerancePx: 6 };

describe('resolveMoveGlyphZone (ADR-397)', () => {
  it('centre disc → "center"', () => {
    expect(resolveMoveGlyphZone({ ...BASE, cursorScreen: { x: 100, y: 100 } })).toBe('center');
    expect(resolveMoveGlyphZone({ ...BASE, cursorScreen: { x: 104, y: 98 } })).toBe('center');
  });

  it('axis-aligned arms (no rotation)', () => {
    expect(resolveMoveGlyphZone({ ...BASE, cursorScreen: { x: 118, y: 100 } })).toBe('x+');
    expect(resolveMoveGlyphZone({ ...BASE, cursorScreen: { x: 82, y: 100 } })).toBe('x-');
    expect(resolveMoveGlyphZone({ ...BASE, cursorScreen: { x: 100, y: 118 } })).toBe('y+');
    expect(resolveMoveGlyphZone({ ...BASE, cursorScreen: { x: 100, y: 82 } })).toBe('y-');
  });

  it('cursor past the arm tip (beyond reach) → null', () => {
    // arm 20 + tol 6 = 26 reach; 100+30 = 130 is past the +X tip.
    expect(resolveMoveGlyphZone({ ...BASE, cursorScreen: { x: 130, y: 100 } })).toBeNull();
  });

  it('cursor off to the side of an arm (beyond perpendicular band) → null', () => {
    // along +X tip but 12px off perpendicular (> tol 6) → not a hit.
    expect(resolveMoveGlyphZone({ ...BASE, cursorScreen: { x: 118, y: 112 } })).toBeNull();
  });

  it('rotation 90°: the screen-up arm classifies in the rotated local frame', () => {
    // angle 90° → local frame rotated; a cursor at world +X maps to a local axis.
    const z = resolveMoveGlyphZone({ ...BASE, screenAngleRad: Math.PI / 2, cursorScreen: { x: 118, y: 100 } });
    // +X screen, un-rotated by −90°, lands on the local −Y arm.
    expect(z).toBe('y-');
  });

  it('rotated 90°: a hit still resolves to exactly one arm', () => {
    const z = resolveMoveGlyphZone({ ...BASE, screenAngleRad: Math.PI / 2, cursorScreen: { x: 100, y: 118 } });
    expect(z).toBe('x+');
  });

  it('isDirectionalZone separates arms from the centre disc', () => {
    expect(isDirectionalZone('x+')).toBe(true);
    expect(isDirectionalZone('y-')).toBe(true);
    expect(isDirectionalZone('center')).toBe(false);
    expect(isDirectionalZone(null)).toBe(false);
  });
});

// ============================================================================
// ADR-397 Φ2 — directional move (world frame) + screen-local mapping
// ============================================================================

const AXIS_FRAME: MoveGlyphFrame = { axisX: { x: 1, y: 0 }, axisY: { x: 0, y: 1 } };

describe('directionForZone (ADR-397 Φ2)', () => {
  it('maps each arm to ±axisX / ±axisY of the world frame', () => {
    const close = (z: MoveGlyphZone, x: number, y: number) => {
      const d = directionForZone(z, AXIS_FRAME)!;
      expect(d.x).toBeCloseTo(x, 6);
      expect(d.y).toBeCloseTo(y, 6);
    };
    close('x+', 1, 0);
    close('x-', -1, 0);
    close('y+', 0, 1);
    close('y-', 0, -1);
  });

  it('follows a rotated frame', () => {
    // Column rotated 90° CCW: axisX = +Y world, axisY = −X world.
    const f = resolveMoveGlyphFrame({ params: { rotation: 90 } } as unknown as Entity)!;
    const xPlus = directionForZone('x+', f)!;
    expect(xPlus.x).toBeCloseTo(0, 6);
    expect(xPlus.y).toBeCloseTo(1, 6);
  });

  it('centre / null have no direction', () => {
    expect(directionForZone('center', AXIS_FRAME)).toBeNull();
    expect(directionForZone(null, AXIS_FRAME)).toBeNull();
  });
});

describe('worldZoneToLocalArm (ADR-397 Φ2)', () => {
  it('flips only Y (canvas Y-down vs world Y-up); X and centre pass through', () => {
    expect(worldZoneToLocalArm('x+')).toBe('x+');
    expect(worldZoneToLocalArm('x-')).toBe('x-');
    expect(worldZoneToLocalArm('y+')).toBe('y-');
    expect(worldZoneToLocalArm('y-')).toBe('y+');
    expect(worldZoneToLocalArm('center')).toBe('center');
    expect(worldZoneToLocalArm(null)).toBeNull();
  });
});

describe('resolveMoveGlyphZoneForGrip (ADR-397 Φ2 — world-space classification)', () => {
  // scale 2 px/world, gripSize 10 → armPx max(5,10)=10 (5 world); arm-relative band
  // 0.45·10=4.5px (2.25 world) → centre disc 2.25, reach 7.25 world.
  const COMMON = { centerWorld: { x: 0, y: 0 }, frame: AXIS_FRAME, gripSizePx: 10, scale: 2 };

  it('classifies the four world arms (Y-up world, no flip here)', () => {
    expect(resolveMoveGlyphZoneForGrip({ ...COMMON, cursorWorld: { x: 4, y: 0 } })).toBe('x+');
    expect(resolveMoveGlyphZoneForGrip({ ...COMMON, cursorWorld: { x: -4, y: 0 } })).toBe('x-');
    expect(resolveMoveGlyphZoneForGrip({ ...COMMON, cursorWorld: { x: 0, y: 4 } })).toBe('y+');
    expect(resolveMoveGlyphZoneForGrip({ ...COMMON, cursorWorld: { x: 0, y: -4 } })).toBe('y-');
  });

  it('centre disc and out-of-reach', () => {
    expect(resolveMoveGlyphZoneForGrip({ ...COMMON, cursorWorld: { x: 0, y: 0 } })).toBe('center');
    expect(resolveMoveGlyphZoneForGrip({ ...COMMON, cursorWorld: { x: 50, y: 0 } })).toBeNull();
  });

  it('degenerate scale → null', () => {
    expect(resolveMoveGlyphZoneForGrip({ ...COMMON, cursorWorld: { x: 4, y: 0 }, scale: 0 })).toBeNull();
  });

  it('REGRESSION: arms stay pickable when the hit tolerance exceeds the arm', () => {
    // Real sizes: GRIP_SIZE 14, scale 1 → arm 14px. The grip hit tolerance is ~16px
    // (> arm). The classification band is arm-RELATIVE, so a cursor 12px out along an
    // axis resolves to an ARM, not the centre disc (the original Φ2 bug: tol-sized
    // centre disc swallowed the whole cross → every cursor read 'center').
    const real = { centerWorld: { x: 0, y: 0 }, frame: AXIS_FRAME, gripSizePx: 14, scale: 1 };
    expect(resolveMoveGlyphZoneForGrip({ ...real, cursorWorld: { x: 12, y: 0 } })).toBe('x+');
    expect(resolveMoveGlyphZoneForGrip({ ...real, cursorWorld: { x: 0, y: 12 } })).toBe('y+');
    expect(resolveMoveGlyphZoneForGrip({ ...real, cursorWorld: { x: 2, y: 0 } })).toBe('center');
  });
});

// ----------------------------------------------------------------------------
// END-TO-END consistency (the Revit-grade guarantee): the LIT arm points exactly
// where the entity will MOVE. Locks directionForZone + worldZoneToLocalArm + the
// canvas Y-flip against the REAL worldToScreen transform — no hand-derivation.
// ----------------------------------------------------------------------------
describe('lit arm ↔ move direction agree on screen (ADR-397 Φ2)', () => {
  const transform = { scale: 2, offsetX: 0, offsetY: 0 };
  const viewport = { width: 800, height: 600 };
  const center: Point2D = { x: 10, y: 20 };

  const norm = (v: Point2D): Point2D => {
    const m = Math.hypot(v.x, v.y);
    return { x: v.x / m, y: v.y / m };
  };
  // Screen direction of the drawn LOCAL arm (canvas rotate by the glyph screen angle).
  const armScreenDir = (zone: MoveGlyphZone, screenAngle: number): Point2D => {
    const u: Record<string, Point2D> = {
      'x+': { x: 1, y: 0 }, 'x-': { x: -1, y: 0 }, 'y+': { x: 0, y: 1 }, 'y-': { x: 0, y: -1 },
    };
    const { x, y } = u[zone];
    const c = Math.cos(screenAngle), s = Math.sin(screenAngle);
    return norm({ x: x * c - y * s, y: x * s + y * c });
  };

  for (const rotationDeg of [0, 30, 90, 200]) {
    it(`rotation ${rotationDeg}° — every arm's screen direction matches its move`, () => {
      const frame = resolveMoveGlyphFrame({ params: { rotation: rotationDeg } } as unknown as Entity)!;
      const cScreen = CoordinateTransforms.worldToScreen(center, transform, viewport);
      const axScreen = CoordinateTransforms.worldToScreen(
        { x: center.x + frame.axisX.x, y: center.y + frame.axisX.y }, transform, viewport,
      );
      const screenAngle = Math.atan2(axScreen.y - cScreen.y, axScreen.x - cScreen.x);

      for (const zone of ['x+', 'x-', 'y+', 'y-'] as const) {
        // World move direction, projected to screen.
        const dir = directionForZone(zone, frame)!;
        const movedScreen = CoordinateTransforms.worldToScreen(
          { x: center.x + dir.x, y: center.y + dir.y }, transform, viewport,
        );
        const moveScreenDir = norm({ x: movedScreen.x - cScreen.x, y: movedScreen.y - cScreen.y });
        // Drawn lit arm direction on screen.
        const litScreenDir = armScreenDir(worldZoneToLocalArm(zone)!, screenAngle);
        expect(litScreenDir.x).toBeCloseTo(moveScreenDir.x, 5);
        expect(litScreenDir.y).toBeCloseTo(moveScreenDir.y, 5);
      }
    });
  }
});
