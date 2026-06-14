/**
 * ADR-455 — axis-cut composition helpers (pure).
 */

import * as THREE from 'three';
import {
  composeCutEntries,
  axisCutCompositionKey,
  detectCutMoving,
  composeClipPlanes,
  axisCutConstant,
  type AxisCutEntry,
} from '../axis-cut-composer';
import type { ResolvedAxisCut } from '../cut-plane-3d';

const cut = (axis: 'x' | 'y' | 'z', worldCoordM: number, sign: 1 | -1): ResolvedAxisCut =>
  ({ axis, worldCoordM, sign });

describe('composeCutEntries', () => {
  it('creates fresh entries for newly active cuts', () => {
    const entries = composeCutEntries([cut('z', 3, 1), cut('x', 5, 1)], []);
    expect(entries.map((e) => e.axis)).toEqual(['z', 'x']);
    expect(entries[1].plane.normal.x).toBe(-1);
  });

  it('REUSES the same plane instance when axis+sign unchanged (fast-path safe)', () => {
    const first = composeCutEntries([cut('x', 5, 1)], []);
    const planeRef = first[0].plane;
    const second = composeCutEntries([cut('x', 9, 1)], first);
    expect(second[0].plane).toBe(planeRef); // same object
    expect(second[0].plane.constant).toBe(9); // constant mutated in place
  });

  it('creates a NEW plane when the sign flips (composition changed)', () => {
    const first = composeCutEntries([cut('x', 5, 1)], []);
    const second = composeCutEntries([cut('x', 5, -1)], first);
    expect(second[0].plane).not.toBe(first[0].plane);
    expect(second[0].plane.normal.x).toBe(1);
  });
});

describe('axisCutCompositionKey', () => {
  it('is stable across a position-only change but differs on flip/toggle', () => {
    expect(axisCutCompositionKey([cut('x', 5, 1)])).toBe(axisCutCompositionKey([cut('x', 9, 1)]));
    expect(axisCutCompositionKey([cut('x', 5, 1)])).not.toBe(axisCutCompositionKey([cut('x', 5, -1)]));
    expect(axisCutCompositionKey([cut('x', 5, 1)])).not.toBe(
      axisCutCompositionKey([cut('x', 5, 1), cut('y', 2, 1)]),
    );
  });
});

describe('detectCutMoving', () => {
  it('detects a constant change, a length change, and no-change', () => {
    expect(detectCutMoving([1, 2], [1, 2])).toBe(false);
    expect(detectCutMoving([1, 3], [1, 2])).toBe(true);
    expect(detectCutMoving([1], [1, 2])).toBe(true);
  });
});

describe('composeClipPlanes', () => {
  it('puts cut planes first and caps the total at 6', () => {
    const mk = (n: number) => Array.from({ length: n }, () => new THREE.Plane());
    const cuts = mk(3);
    const out = composeClipPlanes(cuts, mk(4), mk(2));
    expect(out).toHaveLength(6);
    expect(out.slice(0, 3)).toEqual(cuts); // cuts survive first
  });
});

describe('axisCutConstant', () => {
  it('is sign·worldCoord', () => {
    expect(axisCutConstant(cut('x', 5, 1))).toBe(5);
    expect(axisCutConstant(cut('x', 5, -1))).toBe(-5);
  });
});

// Type-only sanity: AxisCutEntry shape compiles.
const _entry: AxisCutEntry = { axis: 'x', sign: 1, plane: new THREE.Plane() };
void _entry;
