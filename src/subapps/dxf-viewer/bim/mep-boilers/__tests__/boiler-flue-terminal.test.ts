/**
 * ADR-408 Vent Terminal (καμινάδα) — flue terminal glyph SSoT.
 *
 * Pins: each termination type emits its distinct cap geometry (roof cowl = open hood box,
 * through-wall = wall bar + outlet + cap, concentric = two diamonds), the cap is anchored
 * at the chevron tip, the builder is rotation-aware (driven by the `outward` unit vector),
 * the type guard accepts only known values, and the registry/default are stable.
 */

import {
  buildFlueTerminalGlyph,
  isFlueTerminationType,
  FLUE_TERMINATION_TYPES,
  DEFAULT_FLUE_TERMINATION,
  type FlueTerminationType,
} from '../boiler-flue-terminal';

const TIP = { x: 0, y: 0, z: 0 };
const OUT_PLUS_Y = { x: 0, y: 1 }; // flue pointing +Y, perp = {-1, 0}
const STUB = 280;

describe('boiler-flue-terminal — registry', () => {
  it('lists exactly the three termination types', () => {
    expect(FLUE_TERMINATION_TYPES).toEqual(['roof-cowl', 'wall-horizontal', 'balanced-concentric']);
  });

  it('defaults to the vertical roof cowl', () => {
    expect(DEFAULT_FLUE_TERMINATION).toBe('roof-cowl');
  });

  it('guards known vs unknown values', () => {
    expect(isFlueTerminationType('roof-cowl')).toBe(true);
    expect(isFlueTerminationType('balanced-concentric')).toBe(true);
    expect(isFlueTerminationType('chimney')).toBe(false);
    expect(isFlueTerminationType('')).toBe(false);
  });
});

describe('buildFlueTerminalGlyph — per-type stroke counts', () => {
  it('roof cowl emits an open hood box (4 strokes)', () => {
    expect(buildFlueTerminalGlyph(TIP, OUT_PLUS_Y, STUB, 'roof-cowl')).toHaveLength(4);
  });

  it('through-wall emits a wall bar + outlet + cap (3 strokes)', () => {
    expect(buildFlueTerminalGlyph(TIP, OUT_PLUS_Y, STUB, 'wall-horizontal')).toHaveLength(3);
  });

  it('concentric emits two diamonds (2 closed polylines)', () => {
    const glyph = buildFlueTerminalGlyph(TIP, OUT_PLUS_Y, STUB, 'balanced-concentric');
    expect(glyph).toHaveLength(2);
    // Each diamond is a closed 5-point polyline (first === last corner).
    for (const ring of glyph) {
      expect(ring).toHaveLength(5);
      expect(ring[0]).toEqual(ring[4]);
    }
  });
});

describe('buildFlueTerminalGlyph — anchoring & orientation', () => {
  it('roof-cowl cross-plate is centred laterally on the tip (spans ±half along perp)', () => {
    const [plate] = buildFlueTerminalGlyph(TIP, OUT_PLUS_Y, STUB, 'roof-cowl');
    // perp = {-1,0}: the plate runs along ±X through the tip's y.
    expect(plate[0].y).toBeCloseTo(0, 6);
    expect(plate[1].y).toBeCloseTo(0, 6);
    expect(plate[0].x).toBeCloseTo(-plate[1].x, 6); // symmetric about the tip
    expect(plate[0].x).not.toBeCloseTo(0, 6);
  });

  it('roof-cowl hood projects OUTWARD (+Y) from the tip plate', () => {
    const cowl = buildFlueTerminalGlyph(TIP, OUT_PLUS_Y, STUB, 'roof-cowl');
    const hoodTop = cowl[3]; // [hoodL, hoodR]
    expect(hoodTop[0].y).toBeGreaterThan(0); // hood sits beyond the tip along +Y
  });

  it('is rotation-aware: rotating outward by 90° rotates the cap with it', () => {
    const outRot = { x: -1, y: 0 }; // +Y rotated 90° CCW
    const [plateY] = buildFlueTerminalGlyph(TIP, OUT_PLUS_Y, STUB, 'roof-cowl');
    const [plateX] = buildFlueTerminalGlyph(TIP, outRot, STUB, 'roof-cowl');
    // With outward +Y the plate runs along X; with outward −X it runs along Y.
    expect(Math.abs(plateY[0].x)).toBeGreaterThan(Math.abs(plateY[0].y));
    expect(Math.abs(plateX[0].y)).toBeGreaterThan(Math.abs(plateX[0].x));
  });

  it('scales with the stub length', () => {
    const small = buildFlueTerminalGlyph(TIP, OUT_PLUS_Y, 100, 'roof-cowl')[0];
    const big = buildFlueTerminalGlyph(TIP, OUT_PLUS_Y, 400, 'roof-cowl')[0];
    expect(Math.abs(big[0].x)).toBeGreaterThan(Math.abs(small[0].x));
  });

  it('an unknown type would never reach here — the union is exhaustive', () => {
    // Compile-time guard: every FlueTerminationType is handled by the switch.
    const all: FlueTerminationType[] = [...FLUE_TERMINATION_TYPES];
    for (const t of all) {
      expect(buildFlueTerminalGlyph(TIP, OUT_PLUS_Y, STUB, t).length).toBeGreaterThan(0);
    }
  });
});
