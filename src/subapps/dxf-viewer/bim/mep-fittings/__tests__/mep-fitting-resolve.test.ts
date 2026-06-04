/**
 * ADR-408 Φ11 — resolveDesiredFittings tests (scene → desired fitting drafts).
 *
 * Focus: IDEMPOTENCY — resolving the same scene twice yields identical
 * junctionKeys + kinds (no duplicates, replay-safe diffing), and a topology
 * change (one pipe's Ø) flips a coupling into a reducer.
 */

import type { Entity } from '../../../types/entities';
import type { MepFittingDraft } from '../../types/mep-fitting-types';
import { resolveDesiredFittings } from '../mep-fitting-resolve';

/** Build a minimal pipe MepSegmentEntity fixture (round). */
const seg = (
  id: string,
  start: [number, number],
  end: [number, number],
  diameter = 50,
): Entity =>
  ({
    id,
    type: 'mep-segment',
    params: {
      domain: 'pipe',
      sectionKind: 'round',
      startPoint: { x: start[0], y: start[1], z: 0 },
      endPoint: { x: end[0], y: end[1], z: 0 },
      diameter,
      centerlineElevationMm: 0,
      sceneUnits: 'mm',
    },
  } as unknown as Entity);

/** A small but topologically varied scene: a tee + a straight inline run. */
const buildScene = (couplingDiameter = 50): Entity[] => [
  // Tee node at (100, 0): three pipes meet.
  seg('t1', [0, 0], [100, 0]),
  seg('t2', [100, 0], [200, 0]),
  seg('t3', [100, 0], [100, 100]),
  // Inline node at (400, 0): two collinear pipes meet.
  seg('c1', [300, 0], [400, 0]),
  seg('c2', [400, 0], [500, 0], couplingDiameter),
];

/** Stable signature for an idempotency comparison: (junctionKey, kind) pairs. */
const signature = (drafts: readonly MepFittingDraft[]): Array<[string, string]> =>
  drafts.map((d) => [d.params.junctionKey, d.kind]);

describe('resolveDesiredFittings — idempotency', () => {
  it('produces an identical draft set on a second resolve of the same scene', () => {
    const scene = buildScene();
    const first = resolveDesiredFittings(scene);
    const second = resolveDesiredFittings(scene);
    expect(signature(second)).toEqual(signature(first));
  });

  it('produces no duplicate junctionKeys', () => {
    const drafts = resolveDesiredFittings(buildScene());
    const keys = drafts.map((d) => d.params.junctionKey);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('is invariant to input segment order (same keys + kinds)', () => {
    const scene = buildScene();
    const shuffled = [scene[4]!, scene[0]!, scene[3]!, scene[2]!, scene[1]!];
    expect(signature(resolveDesiredFittings(shuffled))).toEqual(
      signature(resolveDesiredFittings(scene)),
    );
  });

  it('is invariant to sub-tolerance jitter on a shared node', () => {
    const base = resolveDesiredFittings(buildScene());
    // Nudge the segments meeting at the inline node by < tolerance (1 unit).
    const jittered = resolveDesiredFittings([
      seg('t1', [0, 0], [100, 0]),
      seg('t2', [100, 0], [200, 0]),
      seg('t3', [100, 0], [100, 100]),
      seg('c1', [300, 0], [400.3, 0]),
      seg('c2', [399.8, -0.2], [500, 0]),
    ]);
    expect(signature(jittered)).toEqual(signature(base));
  });

  it('classifies the expected kinds in the sample scene (tee + coupling)', () => {
    const kinds = resolveDesiredFittings(buildScene()).map((d) => d.kind);
    expect(kinds).toContain('tee');
    expect(kinds).toContain('coupling');
  });
});

describe('resolveDesiredFittings — topology change flips the fitting kind', () => {
  it('flips the inline node from coupling → reducer when one pipe Ø changes', () => {
    const couplingDrafts = resolveDesiredFittings(buildScene(50));
    const reducerDrafts = resolveDesiredFittings(buildScene(32));

    // The inline node's junctionKey is stable across the Ø change (same position).
    const couplingNode = couplingDrafts.find((d) => d.kind === 'coupling');
    const reducerNode = reducerDrafts.find((d) => d.kind === 'reducer');
    expect(couplingNode).toBeDefined();
    expect(reducerNode).toBeDefined();
    expect(reducerNode!.params.junctionKey).toBe(couplingNode!.params.junctionKey);

    // The reducer records the smaller Ø as secondary.
    expect(reducerNode!.params.primaryDiameterMm).toBe(50);
    expect(reducerNode!.params.secondaryDiameterMm).toBe(32);

    // No coupling remains once the diameters differ.
    expect(reducerDrafts.some((d) => d.kind === 'coupling')).toBe(false);
  });

  it('keeps the tee untouched when only the inline node Ø changes', () => {
    const before = resolveDesiredFittings(buildScene(50)).find((d) => d.kind === 'tee');
    const after = resolveDesiredFittings(buildScene(32)).find((d) => d.kind === 'tee');
    expect(after!.params.junctionKey).toBe(before!.params.junctionKey);
  });
});
