/**
 * ADR-514 Φ6d — placement-ghost-assembly (κοινό SSoT κολώνα + πέδιλο).
 *
 * Ελέγχει την orchestration: snap → (position/anchor/rotation/status) → injected `buildEntity` →
 * WYSIWYG ghost. Τα dims/grid pure helpers είναι mocked (έχουν δικά τους suites) ώστε το test να
 * απομονώνει το wiring (preview ≡ commit by construction).
 */

import {
  assemblePlacementGhost,
  assemblePlacementRotationGhost,
} from '../placement-ghost-assembly';
import type { BimCursorSnap } from '../bim-cursor-snap';
import type { ColumnFaceSnap } from '../../columns/column-face-snap';
import type { SceneSnapTargets } from '../../framing/scene-snap-targets';
import type { PolarDiskSnapOptions } from '../../columns/polar-disk-snap';
import type { LineEntity } from '../../../types/entities';

// Pure dims/grid helpers → inert (δικά τους suites). Απομονώνει το assembly wiring.
jest.mock('../placement-grid-meta', () => ({ buildPlacementGridMeta: () => ({}) }));
jest.mock('../../columns/rect-cartesian-snap', () => ({
  findRectContaining: () => null,
  resolveRectCartesianDims: () => [],
}));
jest.mock('../../../hooks/drawing/wysiwyg-preview-shared', () => {
  const actual = jest.requireActual('../../../hooks/drawing/wysiwyg-preview-shared');
  return { ...actual, resolveGhostFaceDimensionsMeta: () => null };
});

/**
 * A real scene entity. `PlacementGhostEntityBuilder` returns `AnySceneEntity | null`
 * because both production builders return `built.entity` from `buildColumnEntity` /
 * `buildFoundationEntity`; a bare `{ type: 'column' }` was only ever accepted while the
 * builder was mis-declared `object | null` (ADR-663 §4 part 5). The assembly treats the
 * entity as opaque — it only spreads it — so any entity exercises the same paths.
 */
const stubEntity = (): LineEntity => ({
  id: 'src_ghost', type: 'line', layerId: 'lyr_test',
  start: { x: 0, y: 0 }, end: { x: 1, y: 0 },
});

/**
 * Every `SceneSnapTargets` collection, empty — "no neighbours in the scene".
 *
 * It listed only three until the stub entity became real: the old fake `{ type: 'column' }`
 * yielded no footprint, so the neighbour-clearance branch — which iterates the rest — was
 * unreachable and the gaps in this fixture stayed invisible. (ADR-663 §4 part 5)
 */
const TARGETS = {
  footprints: [], circularFootprints: [], beamTargets: [], wallTargets: [],
  slabTargets: [], footprintEdgeTargets: [], lineTargets: [], diskTargets: [],
  rectTargets: [], wallEntities: [], openings: [], structuralEntities: [],
} as unknown as SceneSnapTargets;

const OPTS = {} as PolarDiskSnapOptions;

function pointSnap(x: number, y: number): BimCursorSnap {
  return { kind: 'point', point: { x, y }, snapType: null, candidate: null };
}

function columnSnap(over: Partial<ColumnFaceSnap> = {}): BimCursorSnap {
  const placement = {
    position: { x: 10, y: 20 },
    anchor: 'ne',
    status: 'beam',
    rotation: 30,
    targetId: null,
    face: 'n',
    third: 'mid',
    faceFrame: {},
    ...over,
  } as unknown as ColumnFaceSnap;
  return { kind: 'column-placement', placement, point: placement.position };
}

describe('assemblePlacementGhost (awaitingPosition)', () => {
  it('point snap → builder στον effectiveCursor + fallbackAnchor + rotation null', () => {
    const buildEntity = jest.fn(() => stubEntity());
    const ghost = assemblePlacementGhost({
      snap: pointSnap(5, 7),
      effectiveCursor: { x: 5, y: 7 },
      targets: TARGETS, sceneUnits: 'mm', polarOpts: OPTS,
      fallbackAnchor: 'center', ghostId: 'preview_x', buildEntity,
    });
    expect(buildEntity).toHaveBeenCalledWith({ x: 5, y: 7 }, 'center', null, null);
    expect(ghost).not.toBeNull();
    expect(ghost?.id).toBe('preview_x');
    expect((ghost as { preview?: boolean }).preview).toBe(true);
    expect((ghost as { wysiwygPreview?: boolean }).wysiwygPreview).toBe(true);
    expect((ghost as { ghostStatusColor?: unknown }).ghostStatusColor).toBeUndefined();
  });

  it('column-placement → builder στη faceSnap θέση/λαβή/flush-γωνία', () => {
    const buildEntity = jest.fn(() => stubEntity());
    assemblePlacementGhost({
      snap: columnSnap({ position: { x: 10, y: 20 }, anchor: 'ne', rotation: 42 }),
      effectiveCursor: { x: 9, y: 19 },
      targets: TARGETS, sceneUnits: 'mm', polarOpts: OPTS,
      fallbackAnchor: 'center', ghostId: 'preview_x', buildEntity,
    });
    expect(buildEntity).toHaveBeenCalledWith({ x: 10, y: 20 }, 'ne', 42, null);
  });

  it('ADR-525 — L corner-gap sizing περνά αυτούσιο στον builder (4ο arg)', () => {
    const buildEntity = jest.fn(() => stubEntity());
    const sizing = { widthMm: 400, depthMm: 425, armWidthMm: 250, armLengthMm: 300, flipY: false };
    assemblePlacementGhost({
      snap: columnSnap({ position: { x: 1, y: 2 }, anchor: 'center', rotation: 0, sizing }),
      effectiveCursor: { x: 1, y: 2 },
      targets: TARGETS, sceneUnits: 'mm', polarOpts: OPTS,
      fallbackAnchor: 'center', ghostId: 'preview_x', buildEntity,
    });
    expect(buildEntity).toHaveBeenCalledWith({ x: 1, y: 2 }, 'center', 0, sizing);
  });

  it('overlap status → ghostStatusColor set (🔴)', () => {
    const ghost = assemblePlacementGhost({
      snap: columnSnap({ status: 'overlap' }),
      effectiveCursor: { x: 0, y: 0 },
      targets: TARGETS, sceneUnits: 'mm', polarOpts: OPTS,
      fallbackAnchor: 'center', ghostId: 'preview_x',
      buildEntity: () => stubEntity(),
    });
    expect((ghost as { ghostStatusColor?: unknown }).ghostStatusColor).toBeDefined();
  });

  it('builder επιστρέφει null (validation fail) → assembly null', () => {
    const ghost = assemblePlacementGhost({
      snap: pointSnap(1, 1),
      effectiveCursor: { x: 1, y: 1 },
      targets: TARGETS, sceneUnits: 'mm', polarOpts: OPTS,
      fallbackAnchor: 'center', ghostId: 'preview_x',
      buildEntity: () => null,
    });
    expect(ghost).toBeNull();
  });
});

describe('assemblePlacementRotationGhost (awaitingRotation)', () => {
  it('builder στο locked origin + anchor + αριθμητική γωνία', () => {
    const buildEntity = jest.fn(() => stubEntity());
    const ghost = assemblePlacementRotationGhost({
      origin: { x: 100, y: 200 }, anchor: 'center', cursor: { x: 150, y: 200 },
      targets: TARGETS, sceneUnits: 'mm', polarOpts: OPTS,
      ghostId: 'preview_foundation_pad', buildEntity,
    });
    expect(buildEntity).toHaveBeenCalledTimes(1);
    const [pos, anchor, rot] = buildEntity.mock.calls[0];
    expect(pos).toEqual({ x: 100, y: 200 });
    expect(anchor).toBe('center');
    expect(typeof rot).toBe('number');
    expect(ghost?.id).toBe('preview_foundation_pad');
  });

  it('builder null → null', () => {
    const ghost = assemblePlacementRotationGhost({
      origin: { x: 0, y: 0 }, anchor: 'center', cursor: { x: 1, y: 0 },
      targets: TARGETS, sceneUnits: 'mm', polarOpts: OPTS,
      ghostId: 'preview_x', buildEntity: () => null,
    });
    expect(ghost).toBeNull();
  });
});
