/**
 * ADR-544 — extractPlacement3DMeta: συσκευάζει τα overlay πεδία του 2D preview ghost για το 3D
 * store, ή `null` όταν λείπει preview / κανένα overlay πεδίο (καθαρό cursor → overlay σβήνει).
 */

import { extractPlacement3DMeta } from '../placement-overlay-meta';
import type { ExtendedSceneEntity } from '../../../hooks/drawing/drawing-types';
import type { PolarDiskGrid } from '../../../bim/columns/polar-disk-snap';
import type { GhostFaceDimensionsMeta } from '../../../bim/framing/ghost-face-dim-references';

const ANCHOR = { x: 1000, y: 2000 };
const POLAR = { center: { x: 0, y: 0 }, rings: [100], spokesDeg: [0], outerR: 100 } as unknown as PolarDiskGrid;
const DIMS = { sceneUnits: 'mm', dims: [] } as GhostFaceDimensionsMeta;

const ghostWith = (fields: Record<string, unknown>): ExtendedSceneEntity =>
  ({ id: 'preview', type: 'column', ...fields } as unknown as ExtendedSceneEntity);

describe('extractPlacement3DMeta', () => {
  it('returns null when preview is null', () => {
    expect(extractPlacement3DMeta(null, ANCHOR, 0, 'mm')).toBeNull();
  });

  it('returns null when no overlay field is attached', () => {
    expect(extractPlacement3DMeta(ghostWith({}), ANCHOR, 0, 'mm')).toBeNull();
  });

  it('packs the polar grid + anchor + elevation + units', () => {
    const meta = extractPlacement3DMeta(ghostWith({ polarDiskGrid: POLAR }), ANCHOR, 2800, 'm');
    expect(meta).not.toBeNull();
    expect(meta?.polarDiskGrid).toBe(POLAR);
    expect(meta?.rectGrid).toBeNull();
    expect(meta?.elevMm).toBe(2800);
    expect(meta?.sceneUnits).toBe('m');
    expect(meta?.anchorScene).toEqual(ANCHOR);
  });

  it('packs face dimensions when present', () => {
    const meta = extractPlacement3DMeta(ghostWith({ faceDimensions: DIMS }), ANCHOR, 0, 'mm');
    expect(meta?.faceDimensions).toBe(DIMS);
  });
});
