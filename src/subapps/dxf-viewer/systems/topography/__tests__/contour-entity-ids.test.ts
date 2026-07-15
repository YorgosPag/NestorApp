/**
 * ADR-650 M10d — `isTopoContourEntity` predicate: keeps topo contours (lines + elevation labels)
 * OUT of the per-floor 3D DXF overlay so they render once, draped, via `TerrainContourLayer`.
 */

import { isTopoContourEntity } from '../contour-entity-ids';
import {
  TOPO_MAJOR_LAYER_NAME, TOPO_MINOR_LAYER_NAME, TOPO_LABEL_LAYER_NAME,
} from '../contour-config';
import type { SceneLayer } from '../../../types/entities';

const layer = (id: string, name: string): SceneLayer => ({
  id, name, color: '#000000', visible: true, locked: false,
});

const layersById: Record<string, SceneLayer> = {
  major: layer('major', TOPO_MAJOR_LAYER_NAME),
  minor: layer('minor', TOPO_MINOR_LAYER_NAME),
  label: layer('label', TOPO_LABEL_LAYER_NAME),
  other: layer('other', 'WALLS'),
};

describe('isTopoContourEntity', () => {
  it.each([['major'], ['minor'], ['label']])('is true for the %s contour layer', (layerId) => {
    expect(isTopoContourEntity({ layerId }, layersById)).toBe(true);
  });

  it('is false for a non-contour layer', () => {
    expect(isTopoContourEntity({ layerId: 'other' }, layersById)).toBe(false);
  });

  it('is false when the entity has no layer or the map is missing', () => {
    expect(isTopoContourEntity({}, layersById)).toBe(false);
    expect(isTopoContourEntity({ layerId: 'major' }, undefined)).toBe(false);
    expect(isTopoContourEntity({ layerId: 'ghost' }, layersById)).toBe(false);
  });
});
