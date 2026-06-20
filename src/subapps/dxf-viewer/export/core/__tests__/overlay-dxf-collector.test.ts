/**
 * ADR-505 §C (finish/rebar export) — `overlay-dxf-collector` SSoT.
 *
 * Επαληθεύει: κενό input → κενό· gating OFF → μηδέν overlays· δοκάρι με ενεργό σοβά +
 * plaster visible → extruded lwpolylines στο layer ΣΟΒΑΣ· non-structural entity →
 * κανένα rebar (loop skip). Το rebar-positive καλύπτεται live (active resolvers +
 * browser) — εδώ μένουμε σε pure/deterministic μονοπάτια (μηδέν store dependency).
 */

import {
  collectOverlayDxfEntities,
  FINISH_LAYER_ID,
  FINISH_FILL_LAYER_ID,
  type ComponentVisibilityPredicate,
} from '../overlay-dxf-collector';
import { buildDefaultBeamParams, buildBeamEntity } from '../../../hooks/drawing/beam-completion';
import type { Entity } from '../../../types/entities';
import type { BeamEntity } from '../../../bim/types/beam-types';
import type { StructuralFinishSpec } from '../../../bim/finishes/structural-finish-types';

const FINISH: StructuralFinishSpec = {
  enabled: true,
  interiorMaterialId: 'mat-plaster-int',
  exteriorMaterialId: 'mat-plaster-ext',
  thickness: 15,
};

const ALWAYS: ComponentVisibilityPredicate = () => true;
const NEVER: ComponentVisibilityPredicate = () => false;

function beamWithFinish(): BeamEntity {
  const params = {
    ...buildDefaultBeamParams({ x: 0, y: 0 }, { x: 3000, y: 0 }, 'straight', { width: 250, depth: 500 }),
    finish: FINISH,
  };
  const res = buildBeamEntity(params, '0');
  if (!res.ok) throw new Error('beam fixture invalid: ' + res.hardErrors.join(','));
  return res.entity;
}

function lineEntity(): Entity {
  return {
    id: 'l1', type: 'line', layerId: 'lyr_0', color: '#111111', visible: true,
    start: { x: 0, y: 0 }, end: { x: 10, y: 0 },
  } as unknown as Entity;
}

function columnEntity(): Entity {
  return {
    id: 'col1', type: 'column', layerId: 'lyr_c', color: '#2f6690', visible: true,
    geometry: {
      footprint: { vertices: [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 4 }, { x: 0, y: 4 }] },
      height: 3000,
    },
  } as unknown as Entity;
}

describe('collectOverlayDxfEntities (ADR-505)', () => {
  it('κενό input → κενά entities + layers', () => {
    const r = collectOverlayDxfEntities([], { componentVisible: ALWAYS });
    expect(r.entities).toEqual([]);
    expect(r.layers).toEqual({});
  });

  it('gating OFF (plaster/reinforcement invisible) → μηδέν overlays', () => {
    const r = collectOverlayDxfEntities([beamWithFinish()], { componentVisible: NEVER });
    expect(r.entities).toEqual([]);
    expect(r.layers).toEqual({});
  });

  it('δοκάρι με ενεργό σοβά + plaster visible → lwpolylines στο layer ΣΟΒΑΣ (extruded)', () => {
    const r = collectOverlayDxfEntities([beamWithFinish()], { componentVisible: ALWAYS });
    const finish = r.entities.filter((e) => e.layerId === FINISH_LAYER_ID);
    expect(finish.length).toBeGreaterThan(0);
    expect(finish.every((e) => e.type === 'lwpolyline')).toBe(true);
    expect(r.layers[FINISH_LAYER_ID]).toBeDefined();
    expect(r.layers[FINISH_LAYER_ID].name).toBe(FINISH_LAYER_ID);
    // group-39 extrusion = ύψος ζώνης (= structural depth 500mm).
    const extruded = finish.find((e) => (e as { dxfThicknessMm?: number }).dxfThicknessMm !== undefined);
    expect((extruded as { dxfThicknessMm?: number }).dxfThicknessMm).toBeCloseTo(500);
  });

  it('non-structural entity (line) → κανένα overlay', () => {
    const r = collectOverlayDxfEntities([lineEntity()], { componentVisible: ALWAYS });
    expect(r.entities).toEqual([]);
    expect(r.layers).toEqual({});
  });
});

// ADR-505 §C — συμπαγές γέμισμα (3DFACE) δομικών σωμάτων + σοβά.
describe('collectOverlayDxfEntities — solid fill (ADR-505 §C)', () => {
  // μόνο-core predicate → απομονώνει το body fill (χωρίς να ανάψει το rebar pass που
  // απαιτεί column.params — εδώ το fixture είναι σκόπιμα minimal geometry-only).
  const CORE_ONLY: ComponentVisibilityPredicate = (c) => c === 'core';

  it('κολώνα + core visible → hatch (patternType solid) με dxfFaces στο COLUMNS_FILL', () => {
    const r = collectOverlayDxfEntities([columnEntity()], { componentVisible: CORE_ONLY });
    const fill = r.entities.filter((e) => e.layerId === 'COLUMNS_FILL');
    expect(fill).toHaveLength(1);
    expect(fill[0].type).toBe('hatch');
    const faces = (fill[0] as { dxfFaces?: unknown[] }).dxfFaces;
    expect(Array.isArray(faces)).toBe(true);
    // τετράγωνο footprint εξωθημένο: 2 καπάκια (2 τρίγωνα×2) + 4 πλευρές = 8 faces.
    expect(faces).toHaveLength(8);
    expect(r.layers['COLUMNS_FILL']).toBeDefined();
  });

  it('κολώνα + core OFF → κανένα γέμισμα', () => {
    const r = collectOverlayDxfEntities([columnEntity()], { componentVisible: NEVER });
    expect(r.entities.filter((e) => e.layerId === 'COLUMNS_FILL')).toHaveLength(0);
  });

  it('δοκάρι με σοβά → γέμισμα σοβά στο FINISH_FILL (ξεχωριστά από FINISH)', () => {
    const r = collectOverlayDxfEntities([beamWithFinish()], { componentVisible: ALWAYS });
    const fill = r.entities.filter((e) => e.layerId === FINISH_FILL_LAYER_ID);
    expect(fill.length).toBeGreaterThan(0);
    expect(fill.every((e) => e.type === 'hatch')).toBe(true);
    expect(r.layers[FINISH_FILL_LAYER_ID]).toBeDefined();
    // το περίγραμμα σοβά μένει ξεχωριστό στο FINISH.
    expect(r.entities.some((e) => e.layerId === FINISH_LAYER_ID)).toBe(true);
  });
});
