/**
 * Bathroom Auto-Arrange — reusable arrange core · ADR-638 (Στάδιο 2 → 2b).
 *
 * Given a room perimeter polygon (scene coordinates = canonical mm, ADR-462) plus
 * the level's entities (for door keep-clear), this derives the solver input, runs
 * the pure solver and commits the best arrangement as ONE undoable batch — then
 * surfaces a success / warning toast. Thin glue over SSoT: the solver / adapter /
 * commit-builder do the real work.
 *
 * Στάδιο 2b — the room polygon is supplied directly by the hover→click region-pick
 * tool (`useBathroomAutoArrangeTool`), so NO space detection / target-guessing lives
 * here anymore (the old selection-driven `runBathroomAutoArrangeFlow` was removed —
 * the button became a tool, not an action).
 *
 * @see hooks/drawing/useBathroomAutoArrangeTool.ts — the tool that calls this.
 * @see docs/centralized-systems/reference/adrs/ADR-638-bathroom-auto-layout-generator.md
 */

import type { TFunction } from 'i18next';
import type { NotificationContextValue } from '@/types/notifications';
import type { Point2D } from '../../rendering/types/Types';
import type { Entity } from '../../types/entities';
import { isOpeningEntity } from '../../types/entities';
import type { SceneAppendAccessor } from '../../bim/scene/append-entity-to-scene';
import { mmToSceneUnits, type SceneUnits } from '../../utils/scene-units';
import { getLayer } from '../../stores/LayerStore';
import { DXF_DEFAULT_LAYER } from '../../config/layer-config';
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

/** Deps read at event time (same identities the tool already holds). */
export interface BathroomAutoArrangeDeps {
  readonly notifications: NotificationContextValue;
  readonly t: TFunction;
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
 * Arrange sanitary fixtures inside a picked bathroom room. Returns the number of
 * fixtures committed (0 when no solution fits). The `roomPolygon` comes from the
 * region-pick (`pickRegionPerimeterAt`) and is in scene coordinates.
 *
 * ADR-462 — scene geometry is stored in CANONICAL millimetres by construction; the
 * fixture builder + geometry place both position AND size in that same mm space
 * (exactly like manual fixture placement, whose tool resolves to `'mm'`). Using the
 * DECLARED display unit (`resolveSceneUnits`, e.g. 'm'/'cm') would scale placements
 * into a different frame → visible-but-wrong fixtures. So the geometry unit is `'mm'`.
 */
export function arrangeBathroomForRoom(
  accessor: SceneAppendAccessor,
  roomPolygon: readonly Point2D[],
  entities: readonly Entity[],
  deps: BathroomAutoArrangeDeps,
): number {
  const { notifications, t } = deps;
  const sceneUnits: SceneUnits = 'mm';

  const doorsMm = extractDoorMarkers(entities, sceneUnits);
  const input = recognizedSpaceToRoomInput(roomPolygon, sceneUnits, DEFAULT_BATHROOM_FIXTURES, { doorsMm });
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
