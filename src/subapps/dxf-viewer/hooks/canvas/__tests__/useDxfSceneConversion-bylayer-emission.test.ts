/**
 * ADR-358 §G7 Phase 6 — sentinel-aware emission from SceneModel → DxfScene.
 *
 * Validates that `useDxfSceneConversion.buildBase()` honours the Phase 4
 * sentinel fields on `BaseEntity`:
 *   - `colorMode: 'ByLayer' | 'ByBlock'` → omit flattened `color`, forward sentinel
 *   - `lineweightMm: -3 | -2 | -1`       → omit flattened `lineWidth`, forward sentinel
 *   - `linetypeName: 'ByLayer'`          → forward as-is
 *
 * Combined with the Phase 5 `layersById` bridge + Phase 6 resolver, this is the
 * data path that lets `AdminLayerManager` colour edits propagate live to canvas.
 */

import { describe, it, expect } from '@jest/globals';
import { renderHook } from '@testing-library/react';

import { useDxfSceneConversion } from '../useDxfSceneConversion';
import { createSceneLayer } from '../../../types/entities';
import { resolveEntityStyle, entityToStyleInput } from '../../../systems/properties/resolve-entity-style';
import type { SceneModel, LineEntity, BaseEntity } from '../../../types/entities';
import type { DxfLine } from '../../../canvas-v2/dxf-canvas/dxf-types';

function makeScene(
  layers: Record<string, ReturnType<typeof createSceneLayer>>,
  entities: LineEntity[],
): SceneModel {
  return {
    entities,
    layers,
    bounds: { min: { x: 0, y: 0 }, max: { x: 10, y: 10 } },
    units: 'mm',
  };
}

function makeByLayerLine(id: string, layer: string, extra: Partial<BaseEntity> = {}): LineEntity {
  return {
    id,
    type: 'line',
    layer,
    start: { x: 0, y: 0 },
    end: { x: 10, y: 0 },
    visible: true,
    colorMode: 'ByLayer',
    ...extra,
  } as LineEntity;
}

describe('useDxfSceneConversion — Phase 6 ByLayer sentinel emission', () => {
  it('omits `color` field when entity declares colorMode=ByLayer', () => {
    const layers = {
      WALLS: createSceneLayer({ name: 'WALLS', color: '#FF0000', colorAci: 1 }),
    };
    const scene = makeScene(layers, [makeByLayerLine('e1', 'WALLS')]);

    const { result } = renderHook(({ currentScene }) => useDxfSceneConversion({ currentScene }), {
      initialProps: { currentScene: scene },
    });

    const converted = result.current.dxfScene.entities[0] as DxfLine;
    expect(converted.color).toBeUndefined();
    expect(converted.colorMode).toBe('ByLayer');
  });

  it('omits `lineWidth` field when entity declares lineweightMm sentinel (-2 BYLAYER)', () => {
    const layers = {
      WALLS: createSceneLayer({ name: 'WALLS', lineweight: 0.5 }),
    };
    const entity = makeByLayerLine('e1', 'WALLS', { lineweightMm: -2 });
    const scene = makeScene(layers, [entity]);

    const { result } = renderHook(({ currentScene }) => useDxfSceneConversion({ currentScene }), {
      initialProps: { currentScene: scene },
    });

    const converted = result.current.dxfScene.entities[0] as DxfLine;
    expect(converted.lineWidth).toBeUndefined();
    expect(converted.lineweightMm).toBe(-2);
  });

  it('preserves legacy concrete flatten when entity has no sentinel opt-in', () => {
    const layers = {
      WALLS: createSceneLayer({ name: 'WALLS', color: '#FF0000' }),
    };
    const concreteEntity: LineEntity = {
      id: 'e1',
      type: 'line',
      layer: 'WALLS',
      start: { x: 0, y: 0 },
      end: { x: 10, y: 0 },
      visible: true,
      color: '#00FF00',
      lineweight: 2,
    } as LineEntity;
    const scene = makeScene(layers, [concreteEntity]);

    const { result } = renderHook(({ currentScene }) => useDxfSceneConversion({ currentScene }), {
      initialProps: { currentScene: scene },
    });

    const converted = result.current.dxfScene.entities[0] as DxfLine;
    expect(converted.color).toBe('#00FF00');
    expect(converted.lineWidth).toBe(2);
    expect(converted.colorMode).toBeUndefined();
  });

  it('forwards linetypeName sentinel (ByLayer)', () => {
    const layers = {
      WALLS: createSceneLayer({ name: 'WALLS', linetype: 'DASHED' }),
    };
    const entity = makeByLayerLine('e1', 'WALLS', { linetypeName: 'ByLayer' });
    const scene = makeScene(layers, [entity]);

    const { result } = renderHook(({ currentScene }) => useDxfSceneConversion({ currentScene }), {
      initialProps: { currentScene: scene },
    });

    const converted = result.current.dxfScene.entities[0] as DxfLine;
    expect(converted.linetypeName).toBe('ByLayer');
  });

  it('forwards layerId sentinel (Phase 9D-2 stable id attribution)', () => {
    const wallsLayer = createSceneLayer({ name: 'WALLS', color: '#FF0000' });
    const layers = { WALLS: wallsLayer };
    const entity = makeByLayerLine('e1', 'WALLS', { layerId: wallsLayer.id });
    const scene = makeScene(layers, [entity]);

    const { result } = renderHook(({ currentScene }) => useDxfSceneConversion({ currentScene }), {
      initialProps: { currentScene: scene },
    });

    const converted = result.current.dxfScene.entities[0] as DxfLine;
    expect(converted.layerId).toBe(wallsLayer.id);
    expect(converted.layerId).toMatch(/^lyr_[0-9a-f-]{36}$/);
  });

  it('omits layerId on DxfEntity when source entity has no layerId (transitional optional)', () => {
    const layers = {
      WALLS: createSceneLayer({ name: 'WALLS', color: '#FF0000' }),
    };
    const entity = makeByLayerLine('e1', 'WALLS');
    const scene = makeScene(layers, [entity]);

    const { result } = renderHook(({ currentScene }) => useDxfSceneConversion({ currentScene }), {
      initialProps: { currentScene: scene },
    });

    const converted = result.current.dxfScene.entities[0] as DxfLine;
    expect(converted.layerId).toBeUndefined();
  });
});

describe('ADR-358 §G7 Phase 6 — resolver end-to-end (sentinel → concrete)', () => {
  it('LINE entity ByLayer + red layer → resolved color = red', () => {
    const redLayer = createSceneLayer({ name: 'WALLS', color: '#FF0000', colorAci: 1 });
    const styleInput = entityToStyleInput({
      colorMode: 'ByLayer',
      // No concrete `color` field — sentinel path
    });

    const resolved = resolveEntityStyle(styleInput, redLayer);
    expect(resolved.color).toBe('#FF0000');
    expect(resolved.provenance.color).toBe('layer');
  });

  it('LINE entity ByLayer + green layer + lineweight 0.7 → resolved lineweight = 0.7', () => {
    const greenLayer = createSceneLayer({
      name: 'WALLS',
      color: '#00FF00',
      colorAci: 3,
      lineweight: 0.7,
    });
    const styleInput = entityToStyleInput({
      colorMode: 'ByLayer',
      lineweightMm: -2, // BYLAYER sentinel
    });

    const resolved = resolveEntityStyle(styleInput, greenLayer);
    expect(resolved.color).toBe('#00FF00');
    expect(resolved.lineweight).toBe(0.7);
    expect(resolved.provenance.lineweight).toBe('layer');
  });

  it('layer colour edit propagates: same entity, different layer TrueColor → new resolved colour', () => {
    // TrueColor wins over ACI/hex in the resolver cascade — simulates an
    // AdminLayerManager edit where the user picks a custom 0xRRGGBB.
    const styleInput = entityToStyleInput({ colorMode: 'ByLayer' });

    const before = resolveEntityStyle(
      styleInput,
      createSceneLayer({ name: 'L', colorTrueColor: 0x111111 }),
    );
    const after = resolveEntityStyle(
      styleInput,
      createSceneLayer({ name: 'L', colorTrueColor: 0xeeeeee }),
    );

    expect(before.color).toBe('#111111');
    expect(after.color).toBe('#EEEEEE');
  });
});
