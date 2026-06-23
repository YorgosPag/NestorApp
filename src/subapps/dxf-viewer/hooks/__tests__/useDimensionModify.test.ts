/**
 * ADR-362 Phase K — DIMBREAK / DIMSPACE wiring tests.
 *
 * Covers the pure pieces of the feature:
 *   · `computeAutoBreakPoints` (dim-break-engine) — crossing → persisted points.
 *   · `buildBreakCommands` (host) — compute-once vs toggle-clear; no-cross = no-op.
 *   · `buildSpaceCommands` (host) — base + ≥1 target → reposition command(s).
 * The React effect / EventBus glue is intentionally untested (thin shell).
 */

import type { Point2D } from '../../rendering/types/Types';
import type { DimensionEntity } from '../../types/dimension';
import type { Entity } from '../../types/entities';
import type { ISceneManager } from '../../core/commands/interfaces';
import { ISO_129_TEMPLATE } from '../../systems/dimensions/dim-style-templates';
import {
  buildDimensionGeometry,
  type LinearDimGeometry,
} from '../../systems/dimensions/dim-geometry-builder';
import { computeAutoBreakPoints } from '../../systems/dimensions/dim-break-engine';
import { buildBreakCommands, buildSpaceCommands } from '../useDimensionModify';

// A throwaway scene manager — the builders only pass it to the command
// constructor, which does not touch it until execute() (never called here).
const STUB_SM = {} as unknown as ISceneManager;

function linearDim(id: string, dimLineRef: Point2D, extra: Partial<DimensionEntity> = {}): DimensionEntity {
  return {
    id,
    type: 'dimension',
    dimensionType: 'linear',
    styleId: ISO_129_TEMPLATE.id,
    defPoints: [{ x: 0, y: 0 }, { x: 10, y: 0 }, dimLineRef],
    rotation: 0,
    layerId: 'layer_test',
    ...extra,
  } as DimensionEntity;
}

function vLine(id: string, x: number): Entity {
  return { id, type: 'line', start: { x, y: -2 }, end: { x, y: 12 }, layerId: 'layer_test' } as unknown as Entity;
}

// ──────────────────────────────────────────────────────────────────────────────
// Engine — computeAutoBreakPoints
// ──────────────────────────────────────────────────────────────────────────────

describe('computeAutoBreakPoints', () => {
  it('returns the crossing point on the dim line (vertical line through x=5)', () => {
    const geom = buildDimensionGeometry(linearDim('d1', { x: 0, y: 5 }), ISO_129_TEMPLATE) as LinearDimGeometry;
    const breaks = computeAutoBreakPoints(geom, [vLine('v', 5)]);
    expect(breaks.dimLinePoints).toHaveLength(1);
    expect(breaks.dimLinePoints![0].x).toBeCloseTo(5, 6);
    expect(breaks.dimLinePoints![0].y).toBeCloseTo(5, 6);
  });

  it('returns empty when nothing crosses', () => {
    const geom = buildDimensionGeometry(linearDim('d1', { x: 0, y: 5 }), ISO_129_TEMPLATE);
    expect(computeAutoBreakPoints(geom, [])).toEqual({});
    // A line far from the dim line → no dim-line points.
    const breaks = computeAutoBreakPoints(geom, [vLine('v', 999)]);
    expect(breaks.dimLinePoints).toBeUndefined();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Host — buildBreakCommands (toggle)
// ──────────────────────────────────────────────────────────────────────────────

describe('buildBreakCommands', () => {
  it('creates a DIMBREAK command when a crossing entity exists', () => {
    const dim = linearDim('d1', { x: 0, y: 5 });
    const cmds = buildBreakCommands([dim], { entities: [dim, vLine('v', 5)], sm: STUB_SM });
    expect(cmds).toHaveLength(1);
    expect(cmds[0].getDescription()).toBe('DIMBREAK');
    expect(cmds[0].getAffectedEntityIds()).toEqual(['d1']);
  });

  it('toggles OFF (remove) when the dim already has manualBreaks', () => {
    const dim = linearDim('d1', { x: 0, y: 5 }, {
      manualBreaks: { dimLinePoints: [{ x: 5, y: 5 }] },
    });
    const cmds = buildBreakCommands([dim], { entities: [dim, vLine('v', 5)], sm: STUB_SM });
    expect(cmds).toHaveLength(1);
    expect(cmds[0].getDescription()).toBe('DIMBREAK remove');
  });

  it('no command when nothing crosses the dim', () => {
    const dim = linearDim('d1', { x: 0, y: 5 });
    const cmds = buildBreakCommands([dim], { entities: [dim], sm: STUB_SM });
    expect(cmds).toHaveLength(0);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Host — buildSpaceCommands
// ──────────────────────────────────────────────────────────────────────────────

describe('buildSpaceCommands', () => {
  it('repositions the target dim relative to the base (1 command for 2 dims)', () => {
    const base = linearDim('base', { x: 0, y: 5 });
    const target = linearDim('target', { x: 0, y: 25 });
    const cmds = buildSpaceCommands([base, target], { entities: [base, target], sm: STUB_SM });
    expect(cmds).toHaveLength(1);
    expect(cmds[0].getDescription()).toBe('DIMSPACE');
    expect(cmds[0].getAffectedEntityIds()).toEqual(['target']);
  });

  it('no command for a single dimension (nothing to space against)', () => {
    const base = linearDim('base', { x: 0, y: 5 });
    expect(buildSpaceCommands([base], { entities: [base], sm: STUB_SM })).toHaveLength(0);
  });

  it('ignores non-linear/aligned variants', () => {
    const radius = {
      id: 'r', type: 'dimension', dimensionType: 'radius', styleId: ISO_129_TEMPLATE.id,
      defPoints: [{ x: 0, y: 0 }, { x: 50, y: 0 }], layerId: 'layer_test',
    } as unknown as DimensionEntity;
    const base = linearDim('base', { x: 0, y: 5 });
    // base + radius → only 1 spaceable → no spacing.
    expect(buildSpaceCommands([base, radius], { entities: [base, radius], sm: STUB_SM })).toHaveLength(0);
  });
});
