/**
 * Bathroom Auto-Arrange — reusable arrange core · ADR-638 (Στάδιο 2 → 2b).
 *
 * Given a room perimeter polygon (scene coordinates = canonical mm, ADR-462) plus
 * the level's entities, this derives the solver input, runs the pure solver and
 * commits the best arrangement as ONE undoable batch — then surfaces a success /
 * warning toast. Thin glue over SSoT: the solver / adapter / commit-builder do the
 * real work.
 *
 * Στάδιο 3 — two BIM-derived constraints are applied here (via `bathroom-room-constraints`):
 * the room polygon is inset by the wall plaster (σοβάς) thickness so fixtures hug the
 * FINISHED face, and door SWING QUADRANTS (real `OpeningGeometry.hingeArc` sectors) are
 * passed to the solver as keep-clear zones.
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
import type { SceneAppendAccessor } from '../../bim/scene/append-entity-to-scene';
import { type SceneUnits } from '../../utils/scene-units';
import { getLayer } from '../../stores/LayerStore';
import { DXF_DEFAULT_LAYER } from '../../config/layer-config';
import type { LayoutFixtureKind } from './bathroom-layout-types';
import { solveBathroomLayout } from './bathroom-layout-solver';
import { recognizedSpaceToRoomInput } from './recognized-space-adapter';
import { commitBathroomSolution } from './bathroom-fixture-commit';
import {
  extractDoorConstraints,
  resolveInteriorFinishThicknessMm,
  insetRoomForPlasterMm,
} from './bathroom-room-constraints';

/** Default kit placed when the user has no per-room fixture selection yet (Στάδιο 3 adds a dialog). */
const DEFAULT_BATHROOM_FIXTURES: readonly LayoutFixtureKind[] = [
  'shower',
  'wc',
  'washbasin',
  'bidet',
  'washing-machine',
];

/** Deps read at event time (same identities the tool already holds). */
export interface BathroomAutoArrangeDeps {
  readonly notifications: NotificationContextValue;
  readonly t: TFunction;
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

  // ADR-638 Στάδιο 3 — respect the wall plaster (σοβάς): inset the structural room
  // polygon inward by the resolved interior finish thickness so fixtures hug the
  // FINISHED face, not the bare structural face.
  const plasterMm = resolveInteriorFinishThicknessMm(entities);
  const finishedRoom = insetRoomForPlasterMm(roomPolygon, plasterMm);

  // ADR-638 Στάδιο 3 — respect the door swing QUADRANT: accurate hinge-arc sectors
  // (double-leaf → two) + non-hinged doors as a legacy entry rect.
  const { swingZonesMm, fallbackDoors } = extractDoorConstraints(entities, sceneUnits);
  const input = recognizedSpaceToRoomInput(finishedRoom, sceneUnits, DEFAULT_BATHROOM_FIXTURES, {
    doorsMm: fallbackDoors,
    doorSwingZonesMm: swingZonesMm,
  });
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
