/**
 * ADR-635 Φάση B — POINT entity converter tests.
 */
import { convertPoint } from '../dxf-point-converter';

type PointScene = {
  type: string;
  id: string;
  layerId: string;
  position: { x: number; y: number };
  color?: string;
};

describe('convertPoint — DXF POINT import (ADR-635 Φάση B)', () => {
  it('parses valid 10/20 into position', () => {
    const e = convertPoint({ '10': '125.5', '20': '-40.25' }, 'L1', 3) as PointScene;
    expect(e).not.toBeNull();
    expect(e.type).toBe('point');
    expect(e.id).toBe('point_3');
    expect(e.layerId).toBe('L1');
    expect(e.position).toEqual({ x: 125.5, y: -40.25 });
  });

  it('returns null when 10/20 are missing/invalid (NaN guard)', () => {
    expect(convertPoint({}, 'L1', 0)).toBeNull();
    expect(convertPoint({ '10': 'not-a-number', '20': '5' }, 'L1', 1)).toBeNull();
    expect(convertPoint({ '10': '5' }, 'L1', 2)).toBeNull();
  });

  it('extracts color from group code 62 when present', () => {
    const e = convertPoint({ '10': '0', '20': '0', '62': '1' }, 'L1', 5) as PointScene;
    expect(e).not.toBeNull();
    expect(e.color).toBeDefined();
  });

  it('omits color key entirely when 62 is absent', () => {
    const e = convertPoint({ '10': '0', '20': '0' }, 'L1', 6) as PointScene;
    expect(e).not.toBeNull();
    expect('color' in e).toBe(false);
  });
});
