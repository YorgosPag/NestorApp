/**
 * DXF HATCH Gradient Roundtrip — ADR-507 Φ5.
 *
 * Αποδεικνύει ότι `writeDxfAscii([gradientHatch]) → convertHatch()` ανακατασκευάζει
 * το gradient γέμισμα (type/χρώματα/γωνία/single-color) μέσω των DXF group codes
 * 450-470 (full SSoT write→read).
 */

import { describe, it, expect } from '@jest/globals';
import { writeDxfAscii } from '../../export/core/dxf-ascii-writer';
import { convertHatch } from '../dxf-entity-converters';
import { resolveGradientStops, isRadialGradientType } from '../../bim/hatch/hatch-gradient';
import type { Entity } from '../../types/entities';

const LAYERS = { L: { name: 'HATCHES' } };
const SQUARE = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }];

function extractHatch(dxf: string): { pairs: Array<[string, string]>; layer: string } | null {
  const tokens = dxf.split('\n');
  let start = -1;
  for (let i = 0; i < tokens.length - 1; i += 2) {
    if (tokens[i] === '0' && tokens[i + 1] === 'HATCH') { start = i + 2; break; }
  }
  if (start < 0) return null;
  const pairs: Array<[string, string]> = [];
  let layer = '0';
  for (let i = start; i < tokens.length - 1; i += 2) {
    const code = tokens[i];
    const value = tokens[i + 1];
    if (code === '0') break;
    if (code === '8') layer = value;
    pairs.push([code, value]);
  }
  return { pairs, layer };
}

function gradientHatch(over: Record<string, unknown>): Entity {
  return {
    id: 'g', type: 'hatch', layerId: 'L', fillType: 'gradient',
    boundaryPaths: [SQUARE], ...over,
  } as unknown as Entity;
}

function roundtrip(entity: Entity) {
  const dxf = writeDxfAscii([entity], { layersById: LAYERS });
  const extracted = extractHatch(dxf);
  expect(extracted).not.toBeNull();
  return convertHatch(extracted!.pairs, extracted!.layer, 0);
}

describe('convertHatch — gradient roundtrip (ADR-507 Φ5)', () => {
  it('two-color linear gradient → type/colors/angle διατηρούνται', () => {
    const r = roundtrip(gradientHatch({
      gradient: { type: 'linear', color1: '#FF0000', color2: '#0000FF', angleDeg: 45 },
    }));
    expect(r).not.toBeNull();
    if (!r || r.type !== 'hatch') return;
    expect(r.fillType).toBe('gradient');
    expect(r.patternType).toBe('gradient');
    expect(r.gradient).toBeDefined();
    expect(r.gradient!.type).toBe('linear');
    expect(r.gradient!.color1).toBe('#FF0000');
    expect(r.gradient!.color2).toBe('#0000FF');
    expect(r.gradient!.angleDeg).toBeCloseTo(45, 4);
    expect(r.gradient!.singleColor).toBeFalsy();
  });

  it('spherical (radial) gradient → type + radial flag', () => {
    const r = roundtrip(gradientHatch({
      gradient: { type: 'spherical', color1: '#112233', color2: '#AABBCC' },
    }));
    expect(r).not.toBeNull();
    if (!r || r.type !== 'hatch') return;
    expect(r.gradient!.type).toBe('spherical');
    expect(isRadialGradientType(r.gradient!.type)).toBe(true);
  });

  it('single-color gradient → singleColor + tint διατηρούνται', () => {
    const r = roundtrip(gradientHatch({
      gradient: { type: 'linear', color1: '#00FF00', singleColor: true, tint: 0.4 },
    }));
    expect(r).not.toBeNull();
    if (!r || r.type !== 'hatch') return;
    expect(r.gradient!.singleColor).toBe(true);
    expect(r.gradient!.color1).toBe('#00FF00');
    expect(r.gradient!.tint).toBeCloseTo(0.4, 4);
    expect(r.gradient!.color2).toBeUndefined();
  });

  it('cylinder gradient → 3 symmetric stops (c1→c2→c1)', () => {
    const r = roundtrip(gradientHatch({
      gradient: { type: 'cylinder', color1: '#FF0000', color2: '#0000FF' },
    }));
    expect(r).not.toBeNull();
    if (!r || r.type !== 'hatch') return;
    const stops = resolveGradientStops(r.gradient!);
    expect(stops).toHaveLength(3);
    expect(stops[0].color).toBe('#FF0000');
    expect(stops[1].color).toBe('#0000FF');
    expect(stops[2].color).toBe('#FF0000');
  });

  it('boundaryPaths διατηρούνται (gradient region)', () => {
    const r = roundtrip(gradientHatch({
      gradient: { type: 'linear', color1: '#FF0000', color2: '#0000FF' },
    }));
    expect(r).not.toBeNull();
    if (!r || r.type !== 'hatch') return;
    expect(r.boundaryPaths).toHaveLength(1);
    expect(r.boundaryPaths[0]).toHaveLength(4);
  });
});
