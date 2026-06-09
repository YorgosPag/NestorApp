/**
 * ADR-363 Φ1G.5 Slice 2f — resolveJunctionFaceInsetMm (Revit junction-aware face
 * reference for opening temporary dimensions). Fixtures use `sceneUnits: 'mm'` so the
 * scene scale is 1 and every coordinate below is already in millimetres.
 */

import { resolveJunctionFaceInsetMm } from '../opening-junction-refs';
import type { WallEntity } from '../../types/wall-types';

/** Straight wall fixture (mm scene): axis start→end, given thickness. */
const wall = (
  id: string,
  start: readonly [number, number],
  end: readonly [number, number],
  thickness: number,
): WallEntity =>
  ({
    id,
    kind: 'straight',
    params: {
      start: { x: start[0], y: start[1], z: 0 },
      end: { x: end[0], y: end[1], z: 0 },
      thickness,
      sceneUnits: 'mm',
    },
  }) as unknown as WallEntity;

// 5 m horizontal host along +X.
const host = wall('host', [0, 0], [5000, 0], 200);

describe('resolveJunctionFaceInsetMm', () => {
  it('insets to half the transverse thickness for a perpendicular L at the start', () => {
    const transverse = wall('tv', [0, -2000], [0, 2000], 300); // vertical through (0,0)
    const inset = resolveJunctionFaceInsetMm(host, 'start', [host, transverse]);
    expect(inset).toBeCloseTo(150, 6); // 300 / 2
  });

  it('insets by t/2 / sin(θ) for an oblique 45° junction', () => {
    const transverse = wall('tv', [-2000, -2000], [2000, 2000], 300); // 45° through origin
    const inset = resolveJunctionFaceInsetMm(host, 'start', [host, transverse]);
    expect(inset).toBeCloseTo(150 / Math.SQRT1_2, 4); // 150 / sin45 ≈ 212.13
  });

  it('handles a T-junction at the host END (host end on the transverse interior)', () => {
    const transverse = wall('tv', [5000, -2000], [5000, 2000], 300); // vertical through (5000,0)
    const inset = resolveJunctionFaceInsetMm(host, 'end', [host, transverse]);
    expect(inset).toBeCloseTo(150, 6);
  });

  it('returns null for a collinear continuation (not a transverse wall)', () => {
    const continuation = wall('cont', [5000, 0], [8000, 0], 200);
    expect(resolveJunctionFaceInsetMm(host, 'end', [host, continuation])).toBeNull();
  });

  it('returns null for a FREE end (no candidate walls)', () => {
    expect(resolveJunctionFaceInsetMm(host, 'start', [])).toBeNull();
    expect(resolveJunctionFaceInsetMm(host, 'start', [host])).toBeNull();
  });

  it('returns null when the only wall is far from the endpoint', () => {
    const farWall = wall('far', [10000, -2000], [10000, 2000], 300);
    expect(resolveJunctionFaceInsetMm(host, 'start', [host, farWall])).toBeNull();
  });

  it('picks the LARGEST inset when several walls cross the endpoint', () => {
    const perpendicular = wall('tv1', [0, -2000], [0, 2000], 200); // inset 100
    const oblique = wall('tv2', [-2000, -2000], [2000, 2000], 200); // inset 100 / sin45 ≈ 141.4
    const inset = resolveJunctionFaceInsetMm(host, 'start', [host, perpendicular, oblique]);
    expect(inset).toBeCloseTo(100 / Math.SQRT1_2, 4);
  });
});
