/**
 * ADR-406 — regression guard: a MepFixtureEntity MUST survive SceneModel → DxfScene
 * conversion (`convertSceneToDxf` / `convertEntity`).
 *
 * Bug (2026-06-02): the fixture tool committed the entity (audit POST fired) but the
 * fixture never appeared on the 2D canvas. Root cause — `convertEntity` had no
 * `case 'mep-fixture'`, so the entity hit the `default` branch, was dropped (returns
 * null), and never reached the canvas-v2 DxfRenderer. This is the exact pattern that
 * previously bit columns (see the inline comment on the column case). The 3D view
 * worked because it reads params directly, bypassing this converter.
 *
 * This test fails on a converter that drops the fixture, and passes once the
 * `case 'mep-fixture'` forwards kind + params + geometry as a direct entity.
 */

import { describe, it, expect } from '@jest/globals';

import { convertSceneToDxf } from '../useDxfSceneConversion';
import { buildMepFixtureEntity, buildDefaultMepFixtureParams } from '../../drawing/mep-fixture-completion';
import type { SceneModel } from '../../../types/entities';
import type { DxfMepFixture } from '../../../canvas-v2/dxf-canvas/dxf-types';

function makeFixtureScene(): SceneModel {
  const params = buildDefaultMepFixtureParams({ x: 1000, y: 2000 }, { shape: 'rectangular' }, 'mm');
  const result = buildMepFixtureEntity(params, 'lyr_test');
  if (!result.ok) throw new Error('fixture build failed: ' + result.hardErrors.join(', '));
  return {
    entities: [result.entity],
    layersById: {},
    bounds: { min: { x: 0, y: 0 }, max: { x: 5000, y: 5000 } },
    units: 'mm',
  } as unknown as SceneModel;
}

describe('useDxfSceneConversion — ADR-406 MEP fixture survives conversion', () => {
  it('converts a MepFixtureEntity to a DxfMepFixture (not dropped)', () => {
    const dxfScene = convertSceneToDxf(makeFixtureScene());

    expect(dxfScene.entities).toHaveLength(1);
    const fx = dxfScene.entities[0] as DxfMepFixture;
    expect(fx.type).toBe('mep-fixture');
    expect(fx.kind).toBe('light-fixture');
  });

  it('forwards params + geometry (footprint vertices) at the top level', () => {
    const dxfScene = convertSceneToDxf(makeFixtureScene());
    const fx = dxfScene.entities[0] as DxfMepFixture;

    expect(fx.params).toBeDefined();
    expect(fx.params.position).toEqual({ x: 1000, y: 2000, z: 0 });
    expect(fx.geometry).toBeDefined();
    // A rectangular footprint is a closed quad → at least 3 vertices for the renderer.
    expect(fx.geometry.footprint.vertices.length).toBeGreaterThanOrEqual(3);
    expect(fx.geometry.bbox).toBeDefined();
  });
});
