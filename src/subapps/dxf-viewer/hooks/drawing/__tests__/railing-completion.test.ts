/**
 * ADR-407 — Railing completion builders unit tests (Φ1 sketch slice).
 */

import {
  buildDefaultRailingParams,
  buildRailingEntity,
  completeRailingFromTwoClicks,
} from '../railing-completion';
import { DEFAULT_RAILING_TYPE } from '../../../bim/types/railing-types';

describe('buildDefaultRailingParams', () => {
  it('builds a straight sketch path from 2 click points', () => {
    const p = buildDefaultRailingParams({ x: 0, y: 0 }, { x: 100, y: 0 });
    expect(p.pathSource.kind).toBe('sketch');
    if (p.pathSource.kind !== 'sketch') return;
    expect(p.pathSource.path).toEqual([
      { x: 0, y: 0, z: 0 },
      { x: 100, y: 0, z: 0 },
    ]);
  });

  it('defaults to the built-in guardrail Type at 1000mm height / 0 datum', () => {
    const p = buildDefaultRailingParams({ x: 0, y: 0 }, { x: 1, y: 1 });
    expect(p.type).toBe(DEFAULT_RAILING_TYPE);
    expect(p.totalHeightMm).toBe(1000);
    expect(p.baseElevationMm).toBe(0);
  });

  it('applies height + datum overrides and stores scene units', () => {
    const p = buildDefaultRailingParams(
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { totalHeightMm: 1100, baseElevationMm: 250 },
      'm',
    );
    expect(p.totalHeightMm).toBe(1100);
    expect(p.baseElevationMm).toBe(250);
    expect(p.sceneUnits).toBe('m');
  });
});

describe('buildRailingEntity', () => {
  it('builds a valid entity with computed geometry + enterprise id + IFC mixin', () => {
    const params = buildDefaultRailingParams({ x: 0, y: 0 }, { x: 1000, y: 0 });
    const result = buildRailingEntity(params, 'lyr_test');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.entity.type).toBe('railing');
    expect(result.entity.ifcType).toBe('IfcRailing');
    expect(result.entity.id).toBeTruthy();
    expect(result.entity.ifcGuid).toMatch(/^[0-9A-Za-z_$]{22}$/);
    expect(result.entity.layerId).toBe('lyr_test');
    // End/corner posts at both endpoints + a single top rail.
    expect(result.entity.geometry.posts.length).toBe(2);
    expect(result.entity.geometry.rails.length).toBe(1);
    expect(result.entity.geometry.lengthM).toBeGreaterThan(0);
  });

  it('refuses creation on a hard validation error (non-positive height)', () => {
    const params = buildDefaultRailingParams({ x: 0, y: 0 }, { x: 100, y: 0 }, { totalHeightMm: 0 });
    const result = buildRailingEntity(params, 'lyr_test');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.hardErrors.length).toBeGreaterThan(0);
  });
});

describe('completeRailingFromTwoClicks', () => {
  it('is a pure bridge from 2 clicks to a built entity', () => {
    const result = completeRailingFromTwoClicks({ x: 0, y: 0 }, { x: 500, y: 0 }, 'lyr_test');
    expect(result.ok).toBe(true);
  });
});
