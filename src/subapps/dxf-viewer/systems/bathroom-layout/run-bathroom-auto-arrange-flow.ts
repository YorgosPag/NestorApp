/**
 * Bathroom Auto-Arrange — ribbon command flow · ADR-638 (Στάδιο 2).
 *
 * The `'bathroom.actions.autoArrange'` action calls this. It reads the active
 * level scene, picks the target bathroom (the recognised space containing the
 * selection, else the smallest room), derives the door keep-clear, runs the pure
 * solver and commits the best arrangement as ONE undoable batch. Thin glue over
 * SSoT — the solver / adapter / commit-builder do the real work.
 *
 * Mirrors `systems/dimensions/auto/run-auto-dimension-flow.ts` (the `'auto-dimension'`
 * template): `(accessor, selectedEntityIds) → number placed`.
 *
 * @see app/dxf-special-actions.ts — the `'bathroom.actions.autoArrange'` action calls this.
 * @see docs/centralized-systems/reference/adrs/ADR-638-bathroom-auto-layout-generator.md
 */

import type { TFunction } from 'i18next';
import type { NotificationContextValue } from '@/types/notifications';
import type { Point2D } from '../../rendering/types/Types';
import type { Entity } from '../../types/entities';
import { isOpeningEntity } from '../../types/entities';
import type { SceneAppendAccessor } from '../../bim/scene/append-entity-to-scene';
import { mmToSceneUnits, type SceneUnits } from '../../utils/scene-units';
import { isPointInPolygon } from '../../utils/geometry/GeometryUtils';
import { getLayer } from '../../stores/LayerStore';
import { DXF_DEFAULT_LAYER } from '../../config/layer-config';
import { detectSpaces } from '../recognition/space-detection';
import type { RecognizedSpace } from '../recognition/recognition-types';
import type { LayoutFixtureKind } from './bathroom-layout-types';
import { solveBathroomLayout } from './bathroom-layout-solver';
import { recognizedSpaceToRoomInput, type DoorMarker } from './recognized-space-adapter';
import { commitBathroomSolution } from './bathroom-fixture-commit';

/** Default kit placed when the user has no per-room fixture selection yet (Στάδιο 3 adds a dialog). */
const DEFAULT_BATHROOM_FIXTURES: readonly LayoutFixtureKind[] = [
  'shower',
  'wc',
  'washbasin',
  'bidet',
  'washing-machine',
];

/** The door `OpeningKind`s (windows never block fixture placement). */
const DOOR_KINDS: ReadonlySet<string> = new Set([
  'door', 'double-door', 'sliding-door', 'double-sliding-door', 'pocket-door',
  'bifold-door', 'overhead-door', 'revolving-door', 'french-door',
]);

/** Deps read at event time (same identities the dispatcher already holds). */
export interface BathroomAutoArrangeDeps {
  readonly notifications: NotificationContextValue;
  readonly t: TFunction;
}

/** A representative plan point for an entity (bbox centre → position → params.position). */
function entityPoint(entity: Entity): Point2D | null {
  const g = (entity as { geometry?: { bbox?: { min: Point2D; max: Point2D }; position?: Point2D } }).geometry;
  if (g?.bbox) return { x: (g.bbox.min.x + g.bbox.max.x) / 2, y: (g.bbox.min.y + g.bbox.max.y) / 2 };
  if (g?.position) return { x: g.position.x, y: g.position.y };
  const p = (entity as { params?: { position?: Point2D } }).params?.position;
  return p ? { x: p.x, y: p.y } : null;
}

/** Nearest space to a point by centroid distance (used when a bounding wall is selected). */
function nearestSpaceByCentroid(
  spaces: readonly RecognizedSpace[],
  points: readonly Point2D[],
): RecognizedSpace | null {
  let best: RecognizedSpace | null = null;
  let bestD = Infinity;
  for (const s of spaces) {
    for (const pt of points) {
      const d = Math.hypot(s.centroid.x - pt.x, s.centroid.y - pt.y);
      if (d < bestD) { bestD = d; best = s; }
    }
  }
  return best;
}

/**
 * Pick the bathroom to arrange. Priority: (1) the smallest space that directly
 * CONTAINS a selection point; (2) the space whose centroid is NEAREST a selection
 * point — so selecting a wall that bounds the room (its bbox centre sits on/in the
 * wall, outside the room polygon) still resolves to that room; (3) the smallest
 * room overall (bathrooms are small) when nothing is selected.
 */
function pickTargetSpace(
  spaces: readonly RecognizedSpace[],
  selected: readonly Entity[],
): RecognizedSpace | null {
  if (spaces.length === 0) return null;
  const points = selected
    .map(entityPoint)
    .filter((p): p is Point2D => p !== null);
  for (const pt of points) {
    const containing = spaces
      .filter((s) => isPointInPolygon(pt, [...s.polygon]))
      .sort((a, b) => a.area - b.area)[0];
    if (containing) return containing;
  }
  if (points.length > 0) {
    const nearest = nearestSpaceByCentroid(spaces, points);
    if (nearest) return nearest;
  }
  return [...spaces].sort((a, b) => a.area - b.area)[0] ?? null;
}

/** Reduce door openings to solver door markers (positions scene→mm, widths already mm). */
function extractDoorMarkers(entities: readonly Entity[], sceneUnits: SceneUnits): DoorMarker[] {
  const toMm = 1 / mmToSceneUnits(sceneUnits);
  const markers: DoorMarker[] = [];
  for (const e of entities) {
    if (!isOpeningEntity(e)) continue;
    if (!DOOR_KINDS.has(e.params.kind)) continue;
    const pos = e.geometry?.position;
    if (!pos) continue;
    markers.push({ positionMm: { x: pos.x * toMm, y: pos.y * toMm }, widthMm: e.params.width });
  }
  return markers;
}

/**
 * Run the one-click bathroom auto-arrange flow. Returns the number of fixtures
 * committed (0 when no room / no solution). Selection-driven: select an element
 * inside the target bathroom (or leave empty in a single-room plan).
 */
export function runBathroomAutoArrangeFlow(
  accessor: SceneAppendAccessor,
  selectedEntityIds: readonly string[],
  deps: BathroomAutoArrangeDeps,
): number {
  const { notifications, t } = deps;
  const levelId = accessor.currentLevelId;
  if (!levelId) return 0;
  const scene = accessor.getLevelScene(levelId);
  if (!scene) return 0;

  const entities = scene.entities as unknown as Entity[];
  // ADR-462 — scene geometry is stored in CANONICAL millimetres by construction; the
  // fixture builder + geometry (`computeMepFixtureGeometry`) place both position AND
  // size in that same mm coordinate space (exactly like manual fixture placement, whose
  // tool resolves to `'mm'`). Using the DECLARED display unit here (`resolveSceneUnits`,
  // e.g. 'm'/'cm') would scale the placements into a different frame → visible-but-
  // wrong-position / wrong-size fixtures. So the geometry unit is always `'mm'`.
  const sceneUnits: SceneUnits = 'mm';
  const spaces = detectSpaces(entities, levelId, sceneUnits);
  const selectedSet = new Set(selectedEntityIds);
  const target = pickTargetSpace(spaces, entities.filter((e) => selectedSet.has(e.id)));
  if (!target) {
    notifications.warning(t('callbacks.bathroomAutoArrange.noRoom'));
    return 0;
  }

  const doorsMm = extractDoorMarkers(entities, sceneUnits);
  const input = recognizedSpaceToRoomInput(target.polygon, sceneUnits, DEFAULT_BATHROOM_FIXTURES, { doorsMm });
  const [best] = solveBathroomLayout(input);
  if (!best) {
    notifications.warning(t('callbacks.bathroomAutoArrange.noSolution'));
    return 0;
  }

  const layerId = getLayer(DXF_DEFAULT_LAYER)?.id ?? '0';
  const summary = commitBathroomSolution(accessor, best, { layerId, sceneUnits });
  if (summary.committed === 0) {
    notifications.warning(t('callbacks.bathroomAutoArrange.noSolution'));
    return 0;
  }
  notifications.success(t('callbacks.bathroomAutoArrange.done', { count: summary.committed }));
  return summary.committed;
}
