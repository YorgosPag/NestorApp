/**
 * ADR-362 §7 — dimension-property-model tests.
 *
 * Pure read/apply model for the DIMENSION Full Properties Palette:
 *   · buildDimensionFormState — resolved style values + entity fields + read-only geometry.
 *   · buildDimensionPatch     — form → undoable patch, split entity-root vs `overrides`,
 *                               idempotent (unchanged form → {}).
 */

import type { DimensionEntity } from '../../../types/dimension';
import { ISO_129_TEMPLATE } from '../../dimensions/dim-style-templates';
import { findClosestAci } from '../../../settings/standards/aci';
import { hexToTrueColor } from '../../../utils/dxf-true-color';
import {
  buildDimensionFormState,
  buildDimensionPatch,
} from '../dimension-property-model';

function linearDim(extra: Partial<DimensionEntity> = {}): DimensionEntity {
  return {
    id: 'dim-1',
    type: 'dimension',
    dimensionType: 'linear',
    styleId: ISO_129_TEMPLATE.id,
    defPoints: [{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 500, y: 200 }],
    rotation: 0,
    layerId: 'layer_test',
    ...extra,
  } as DimensionEntity;
}

describe('buildDimensionFormState', () => {
  it('reads entity fields + read-only geometry for a plain dimension', () => {
    const form = buildDimensionFormState(linearDim(), 'mm');
    expect(form.layerId).toBe('layer_test');
    expect(form.dimType).toBe('linear'); // raw token — the palette localises it
    expect(form.measurement.length).toBeGreaterThan(0);
    expect(form.point1.length).toBeGreaterThan(0);
    expect(form.point2.length).toBeGreaterThan(0);
    expect(form.styleName.length).toBeGreaterThan(0);
    expect(form.associations).toBe('0');
    expect(form.userText).toBe('');
    expect(form.textRotation).toBe('0');
  });

  it('reflects a per-entity override in the resolved value (dimtxt)', () => {
    const form = buildDimensionFormState(linearDim({ overrides: { dimtxt: 9.5 } }), 'mm');
    expect(form.dimtxt).toBe('9.5');
  });

  it('counts associativity entries', () => {
    const dim = linearDim({
      associations: [
        { defPointIndex: 0, geometryId: 'g1', associationType: 'endpoint' },
        { defPointIndex: 1, geometryId: 'g2', associationType: 'endpoint' },
      ],
    } as Partial<DimensionEntity>);
    expect(buildDimensionFormState(dim, 'mm').associations).toBe('2');
  });
});

describe('buildDimensionPatch', () => {
  it('is idempotent — reading then applying an unchanged form writes nothing', () => {
    const dim = linearDim();
    const form = buildDimensionFormState(dim, 'mm');
    expect(buildDimensionPatch(dim, form)).toEqual({});
  });

  it('writes a numeric style edit into overrides (dimtxt)', () => {
    const dim = linearDim();
    const form = { ...buildDimensionFormState(dim, 'mm'), dimtxt: '9.5' };
    const patch = buildDimensionPatch(dim, form);
    expect((patch.overrides as Record<string, unknown>).dimtxt).toBe(9.5);
  });

  it('rounds the decimals field to an integer (dimdec)', () => {
    const dim = linearDim();
    const form = { ...buildDimensionFormState(dim, 'mm'), dimdec: '3.7' };
    const patch = buildDimensionPatch(dim, form);
    expect((patch.overrides as Record<string, unknown>).dimdec).toBe(4);
  });

  it('writes layer / textRotation / userText to the ENTITY root (not overrides)', () => {
    const dim = linearDim();
    const base = buildDimensionFormState(dim, 'mm');
    expect(buildDimensionPatch(dim, { ...base, layerId: 'other' })).toEqual({ layerId: 'other' });
    expect(buildDimensionPatch(dim, { ...base, textRotation: '45' })).toEqual({ textRotation: 45 });
    expect(buildDimensionPatch(dim, { ...base, userText: 'ABC' })).toEqual({ userText: 'ABC' });
  });

  it('color change writes nearest ACI + true-color companion into overrides', () => {
    const dim = linearDim();
    const HEX = '#ff0000';
    const form = { ...buildDimensionFormState(dim, 'mm'), dimclrd: HEX };
    const ov = buildDimensionPatch(dim, form).overrides as Record<string, unknown>;
    expect(ov.dimclrd).toBe(findClosestAci(HEX));
    expect(ov.dimclrdTrueColor).toBe(hexToTrueColor(HEX));
  });

  it('arrow-style change writes dimblk and clears dimblk1/dimblk2 (unified heads)', () => {
    const dim = linearDim();
    const base = buildDimensionFormState(dim, 'mm');
    // Pick an arrow block that differs from the resolved default (ISO uses oblique ticks).
    const next = base.dimblk === 'closedFilled' ? 'oblique' : 'closedFilled';
    const ov = buildDimensionPatch(dim, { ...base, dimblk: next }).overrides as Record<string, unknown>;
    expect(ov.dimblk).toBe(next);
    expect(ov.dimblk1).toBe('');
    expect(ov.dimblk2).toBe('');
  });

  it('lineweight → mm value writes a numeric override (0.5)', () => {
    const dim = linearDim();
    const form = { ...buildDimensionFormState(dim, 'mm'), dimlwd: '0.5' };
    const ov = buildDimensionPatch(dim, form).overrides as Record<string, unknown>;
    expect(ov.dimlwd).toBe(0.5);
  });
});
