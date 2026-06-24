/**
 * ADR-363 Phase 2 — Pure builders for opening entity creation.
 *
 * SSoT:
 *   - IDs via `generateOpeningId()` (N.6 enterprise-id, ADR-017/210/294).
 *   - Geometry via `computeOpeningGeometry()` — pure function, SSoT για
 *     position / outline / hingeArc / bbox / area / perimeter.
 *   - Validation via `validateOpeningParams()` — hardErrors block creation;
 *     code violations surface στο property panel ως red badge.
 *   - Types via `bim/types/opening-types.ts`.
 *
 * Click-to-place flow (Phase 2):
 *   - User chooses a host wall (state: awaitingHostWall).
 *   - User clicks anywhere — the click world-point is projected onto the host
 *     wall axis → `offsetFromStart`. Snap 50mm.
 *   - Opening entity built with kind-specific defaults (door 900×2100, etc.).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.4
 */

import type { Point2D } from '../../rendering/types/Types';
import type { Point3D } from '../../bim/types/bim-base';
import { quantizeMagnitude } from '../../systems/tracking/adaptive-distance-snap'; // scalar round-to-increment SSoT
import type {
  OpeningEntity,
  OpeningKind,
  OpeningParams,
} from '../../bim/types/opening-types';
import {
  DEFAULT_FRAME_WIDTH_MM,
  OPENING_KIND_DEFAULTS,
  OPENING_SNAP_INCREMENT_MM,
  isHingedKind,
} from '../../bim/types/opening-types';
import type { WallEntity } from '../../bim/types/wall-types';
import { computeOpeningGeometry, projectPointToWallOffsetMm } from '../../bim/geometry/opening-geometry';
import { validateOpeningParams } from '../../bim/validators/opening-validator';
import { createOpening } from '@/services/factories/opening.factory';
import { resolveAutoOpeningTypeId } from '../../bim/family-types/auto-opening-type';
import type { SceneUnits } from '../../utils/scene-units';

export type { SceneUnits };

// ─── Param overrides accepted by the builder ─────────────────────────────────

/**
 * Field overrides για `buildDefaultOpeningParams`. The ribbon (contextual
 * opening tab) supplies kind/width/height/sill; advanced overrides (handing,
 * openDirection, glazingPanes) land Phase 2.5.
 */
export interface OpeningParamOverrides {
  readonly kind?: OpeningKind;
  /** mm. */
  readonly width?: number;
  /** mm. */
  readonly height?: number;
  /** mm. */
  readonly sillHeight?: number;
  readonly handing?: OpeningParams['handing'];
  readonly openDirection?: OpeningParams['openDirection'];
  readonly glazingPanes?: OpeningParams['glazingPanes'];
}

// ─── Defaults factory ────────────────────────────────────────────────────────

/**
 * Build `OpeningParams` από host wall + click point + optional overrides.
 *
 * Algorithm:
 *   1. Resolve kind (override → 'door' default).
 *   2. Resolve defaults από `OPENING_KIND_DEFAULTS[kind]` (width / height / sill).
 *   3. Project click point onto host wall axis → `offsetFromStart` (mm).
 *   4. Center the opening on the click (subtract width/2) + snap 50mm.
 *   5. Clamp offset to `[0, hostLength - width]` to keep the opening inside.
 */
export function buildDefaultOpeningParams(
  hostWall: WallEntity,
  clickPoint: Readonly<Point2D>,
  overrides: OpeningParamOverrides = {},
  sceneUnits: SceneUnits = 'mm',
): OpeningParams {
  const kind = overrides.kind ?? 'door';
  const defaults = OPENING_KIND_DEFAULTS[kind];
  const width = overrides.width ?? defaults.width;
  const height = overrides.height ?? defaults.height;
  const sillHeight = overrides.sillHeight ?? defaults.sillHeight;

  // ADR-370 — host-relative offset in mm (`offsetFromStart` contract). The SSoT
  // `projectPointToWallOffsetMm` normalises the scene-unit projection → mm, so
  // creation and grip-drag share ONE conversion (no duplicated `/ mmFactor`).
  const centeredOffset = projectPointToWallOffsetMm(clickPoint, hostWall) - width / 2;
  const snappedOffset = quantizeMagnitude(centeredOffset, OPENING_SNAP_INCREMENT_MM);
  const wallLengthMm = hostWall.geometry.length * 1000;
  const clampedOffset = clampOffset(snappedOffset, width, wallLengthMm);

  const params: OpeningParams = {
    kind,
    wallId: hostWall.id,
    offsetFromStart: clampedOffset,
    width,
    height,
    sillHeight,
    frameWidth: DEFAULT_FRAME_WIDTH_MM,
    ...(isHingedKind(kind)
      ? {
          handing: overrides.handing ?? 'left',
          openDirection: overrides.openDirection ?? 'inward',
        }
      : {}),
    ...(overrides.glazingPanes !== undefined ? { glazingPanes: overrides.glazingPanes } : {}),
  };
  return params;
}

// ─── Entity builder ──────────────────────────────────────────────────────────

export type BuildOpeningEntityResult =
  | { readonly ok: true; readonly entity: OpeningEntity }
  | { readonly ok: false; readonly hardErrors: readonly string[] };

/**
 * Build an `OpeningEntity` από `OpeningParams + hostWall`. Geometry computed
 * via the SSoT `computeOpeningGeometry()`. Hard errors short-circuit creation.
 */
export function buildOpeningEntity(
  params: Readonly<OpeningParams>,
  hostWall: WallEntity,
  layerId: string,
  sceneUnits: SceneUnits = 'mm',
): BuildOpeningEntityResult {
  const validation = validateOpeningParams(params, hostWall);
  if (validation.hardErrors.length > 0) {
    return { ok: false, hardErrors: validation.hardErrors };
  }
  const geometry = computeOpeningGeometry(params, hostWall, sceneUnits);
  const entity = createOpening({ params, geometry, layerId, validation: validation.bimValidation, visible: true });
  // ADR-421 SLICE C follow-up — auto-type-on-create (Revit «Generic»): an opening
  // whose nominal kind+width+height equal the kind default links to the read-only
  // built-in opening type, so it gains «Edit Type» + «type always wins» for free.
  // Custom-dimensioned openings stay ad-hoc (`undefined`) and flow through the
  // legacy fast-path of `resolveEffectiveOpeningParams` (non-destructive, zero
  // regression). Resolution + persistence already carry `typeId` — no extra wiring.
  const typeId = resolveAutoOpeningTypeId(params);
  return { ok: true, entity: typeId ? { ...entity, typeId } : entity };
}

// ─── Click-to-place completion helper ────────────────────────────────────────

/**
 * High-level helper bridging the opening tool state machine (Phase 2: 1 click
 * on host wall = place opening) and the builder pipeline. Returns a fully-
 * formed entity or a validator error list. Pure — no side effects.
 */
export function completeOpeningFromHostClick(
  hostWall: WallEntity,
  clickPoint: Readonly<Point2D>,
  layerId: string,
  overrides: OpeningParamOverrides = {},
  sceneUnits: SceneUnits = 'mm',
): BuildOpeningEntityResult {
  const params = buildDefaultOpeningParams(hostWall, clickPoint, overrides, sceneUnits);
  return buildOpeningEntity(params, hostWall, layerId, sceneUnits);
}

// ─── Internal helpers ────────────────────────────────────────────────────────

function clampOffset(offset: number, width: number, wallLengthMm: number): number {
  if (offset < 0) return 0;
  const maxOffset = Math.max(0, wallLengthMm - width);
  if (offset > maxOffset) return maxOffset;
  return offset;
}

/** Convenience: return the world-space center point of the opening (mm). */
export function getOpeningWorldCenter(
  params: OpeningParams,
  hostWall: WallEntity,
): Point3D {
  const start = hostWall.params.start;
  const end = hostWall.params.end;
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const axisLen = Math.hypot(dx, dy) || 1;
  const t = (params.offsetFromStart + params.width / 2) / axisLen;
  return {
    x: start.x + dx * t,
    y: start.y + dy * t,
    z: 0,
  };
}
