/**
 * ADR-363 Phase 4 — Pure column-from-click entity builder (N.7.1 file-size split).
 *
 * Εξήχθη από `useColumnTool.commitColumnAt` ώστε το hook να μένει < 500 γραμμές.
 * Καθαρή συνάρτηση (μηδέν React state): παίρνει το FSM context + το clicked point
 * και επιστρέφει είτε το έτοιμο `ColumnEntity` (με grid bindings) είτε το hardError.
 * Η ορχήστρωση του setState / onColumnCreated μένει στον caller.
 *
 * SSoT: entity build via `buildColumnEntity` / `buildDefaultColumnParams`,
 * grid hosting via `resolveColumnGridBindings` (ίδια SSoT με το hook). ZERO
 * duplicate construction.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.6 Phase 4
 */

import type { Point2D } from '../../rendering/types/Types';
import {
  buildColumnEntity,
  buildDefaultColumnParams,
  resolveColumnGridBindings,
  type ColumnParamOverrides,
} from './column-completion';
import { getGlobalGuideStore } from '../../systems/guides/guide-store';
import { axisHostTolScene } from '../../bim/hosting/resolve-axis-bindings';
import type { ColumnAnchor, ColumnEntity, ColumnKind } from '../../bim/types/column-types';
import type { SceneUnits } from '../../utils/scene-units';

/**
 * ADR-398 §3.17 — one-shot override (υιοθέτηση ορθογωνίου): χτίζει ΑΥΤΟ το στοιχείο με
 * το adopted width/depth/kind ΧΩΡΙΣ να αλλάξει την προεπιλογή του εργαλείου.
 */
export interface ColumnSizeOverride {
  readonly width: number;
  readonly depth: number;
  readonly kind?: ColumnKind;
  readonly finish?: ColumnParamOverrides['finish'];
  readonly autoSized?: boolean;
}

export type BuildClickColumnResult =
  | { readonly ok: true; readonly entity: ColumnEntity }
  | { readonly ok: false; readonly error: string | null };

/**
 * Build column entity από clicked point + FSM context. Validator hardError →
 * `{ ok: false }` (ο caller αφήνει το FSM σε awaitingPosition ώστε ο χρήστης να
 * διορθώσει). ADR-441 Slice COL — host-on-snap: αν το σημείο πέφτει σε άξονα/τομή
 * κανάβου, «κρέμασε» την κολώνα ώστε να ακολουθεί τον κάναβο.
 */
export function buildClickColumnEntity(
  baseOverrides: ColumnParamOverrides,
  kind: ColumnKind,
  position: Readonly<Point2D>,
  anchor: ColumnAnchor,
  rotationDeg: number,
  currentLevelId: string,
  sceneUnits: SceneUnits,
  sizeOverride?: ColumnSizeOverride,
): BuildClickColumnResult {
  const buildKind = sizeOverride?.kind ?? kind;
  const overridesWithKind: ColumnParamOverrides = {
    ...baseOverrides,
    ...(sizeOverride?.width !== undefined ? { width: sizeOverride.width } : {}),
    ...(sizeOverride?.depth !== undefined ? { depth: sizeOverride.depth } : {}),
    ...(sizeOverride?.finish !== undefined ? { finish: sizeOverride.finish } : {}),
    ...(sizeOverride?.autoSized !== undefined ? { autoSized: sizeOverride.autoSized } : {}),
    kind: buildKind,
    anchor,
    rotation: rotationDeg,
  };
  const params = buildDefaultColumnParams(position, kind, overridesWithKind, sceneUnits);
  const result = buildColumnEntity(params, currentLevelId, sceneUnits);
  if (!result.ok) {
    return { ok: false, error: result.hardErrors[0] ?? null };
  }
  const bindings = resolveColumnGridBindings(
    params.position,
    getGlobalGuideStore(),
    axisHostTolScene(sceneUnits),
  );
  const entity = bindings.length > 0 ? { ...result.entity, guideBindings: bindings } : result.entity;
  return { ok: true, entity };
}
