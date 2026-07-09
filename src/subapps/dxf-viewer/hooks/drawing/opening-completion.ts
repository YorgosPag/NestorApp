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
import type { BimValidation, Point3D } from '../../bim/types/bim-base';
import { quantizeMagnitude } from '../../systems/tracking/adaptive-distance-snap'; // scalar round-to-increment SSoT
import type {
  OpeningEntity,
  OpeningGeometry,
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
import { DEFAULT_SELF_HOST_THICKNESS_MM, selfOpeningHost } from '../../bim/geometry/opening-host';

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
  /**
   * ADR-615 — "wall thickness" a self-hosted (free-standing) opening symbol
   * shows. Ignored for wall-hosted builders. Defaults to
   * `DEFAULT_SELF_HOST_THICKNESS_MM`.
   */
  readonly hostThicknessMm?: number;
}

// ─── Defaults factory ────────────────────────────────────────────────────────

/**
 * Resolve kind + width/height/sill from `OPENING_KIND_DEFAULTS` + overrides.
 * SSoT shared by `buildDefaultOpeningParams` (wall-hosted) AND
 * `buildDefaultSelfOpeningParams` (ADR-615 self-hosted) — both kind-default
 * resolution AND the resulting param field OVERLAY (frameWidth / handing /
 * openDirection / glazingPanes) are byte-identical regardless of host.
 */
function resolveOpeningKindDimensions(
  overrides: OpeningParamOverrides,
): { kind: OpeningKind; width: number; height: number; sillHeight: number } {
  const kind = overrides.kind ?? 'door';
  const defaults = OPENING_KIND_DEFAULTS[kind];
  return {
    kind,
    width: overrides.width ?? defaults.width,
    height: overrides.height ?? defaults.height,
    sillHeight: overrides.sillHeight ?? defaults.sillHeight,
  };
}

/**
 * Field overlay shared by every opening builder regardless of host
 * (wall-hosted or self-hosted, ADR-615): frame width default + hinged-kind
 * handing/openDirection defaults + optional glazingPanes.
 */
function buildOpeningFieldOverlay(
  kind: OpeningKind,
  overrides: OpeningParamOverrides,
): Pick<OpeningParams, 'frameWidth' | 'handing' | 'openDirection' | 'glazingPanes'> {
  return {
    frameWidth: DEFAULT_FRAME_WIDTH_MM,
    ...(isHingedKind(kind)
      ? {
          handing: overrides.handing ?? 'left',
          openDirection: overrides.openDirection ?? 'inward',
        }
      : {}),
    ...(overrides.glazingPanes !== undefined ? { glazingPanes: overrides.glazingPanes } : {}),
  };
}

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
  const { kind, width, height, sillHeight } = resolveOpeningKindDimensions(overrides);

  // ADR-370 — host-relative offset in mm (`offsetFromStart` contract). The SSoT
  // `projectPointToWallOffsetMm` normalises the scene-unit projection → mm, so
  // creation and grip-drag share ONE conversion (no duplicated `/ mmFactor`).
  const centeredOffset = projectPointToWallOffsetMm(clickPoint, hostWall) - width / 2;
  const snappedOffset = quantizeMagnitude(centeredOffset, OPENING_SNAP_INCREMENT_MM);
  const wallLengthMm = hostWall.geometry.length * 1000;
  const clampedOffset = clampOffset(snappedOffset, width, wallLengthMm);

  return {
    kind,
    wallId: hostWall.id,
    offsetFromStart: clampedOffset,
    width,
    height,
    sillHeight,
    ...buildOpeningFieldOverlay(kind, overrides),
  };
}

// ─── Entity builder ──────────────────────────────────────────────────────────

export type BuildOpeningEntityResult =
  | { readonly ok: true; readonly entity: OpeningEntity }
  | { readonly ok: false; readonly hardErrors: readonly string[] };

/**
 * Assemble the final `OpeningEntity` from already-computed `params + geometry
 * + validation`. SSoT shared by `buildOpeningEntity` (wall-hosted) AND
 * `buildSelfOpeningEntity` (ADR-615 self-hosted) — `createOpening()` +
 * auto-type-on-create resolution (`resolveAutoOpeningTypeId`) is identical
 * regardless of host; only geometry/validation computation differs upstream.
 */
function assembleOpeningEntity(
  params: Readonly<OpeningParams>,
  geometry: OpeningGeometry,
  layerId: string,
  bimValidation: BimValidation,
): BuildOpeningEntityResult {
  const entity = createOpening({ params, geometry, layerId, validation: bimValidation, visible: true });
  // ADR-421 SLICE C follow-up — auto-type-on-create (Revit «Generic»): an opening
  // whose nominal kind+width+height equal the kind default links to the read-only
  // built-in opening type, so it gains «Edit Type» + «type always wins» for free.
  // Custom-dimensioned openings stay ad-hoc (`undefined`) and flow through the
  // legacy fast-path of `resolveEffectiveOpeningParams` (non-destructive, zero
  // regression). Resolution + persistence already carry `typeId` — no extra wiring.
  const typeId = resolveAutoOpeningTypeId(params);
  return { ok: true, entity: typeId ? { ...entity, typeId } : entity };
}

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
  return assembleOpeningEntity(params, geometry, layerId, validation.bimValidation);
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

// ─── Self-hosted (free-standing) builders — ADR-615 ──────────────────────────

/**
 * Build `OpeningParams` for a **self-hosted** (free-standing, no BIM wall)
 * opening — placed directly on imported DXF lines. Mirrors
 * `buildDefaultOpeningParams` (kind/width/height/sill defaults, frame width,
 * handing/openDirection/glazingPanes overrides) but sets `selfHost` instead
 * of `wallId`, and `offsetFromStart` is always 0 (the host IS the opening —
 * ADR-615 §Decision 2).
 */
export function buildDefaultSelfOpeningParams(
  anchor: Point3D,
  rotationRad: number,
  overrides: OpeningParamOverrides = {},
): OpeningParams {
  const { kind, width, height, sillHeight } = resolveOpeningKindDimensions(overrides);

  return {
    kind,
    selfHost: {
      anchor,
      rotationRad,
      hostThicknessMm: overrides.hostThicknessMm ?? DEFAULT_SELF_HOST_THICKNESS_MM,
    },
    offsetFromStart: 0,
    width,
    height,
    sillHeight,
    ...buildOpeningFieldOverlay(kind, overrides),
  };
}

/**
 * Build an `OpeningEntity` for a self-hosted opening from `OpeningParams`
 * alone — no `WallEntity` involved. Geometry via the SAME SSoT
 * `computeOpeningGeometry()`, fed a synthetic `OpeningHost`
 * (`selfOpeningHost()`, ADR-615 §Decision 1). Validation uses `hostWall =
 * null` (`validateAgainstHost` already early-returns for the host-less case).
 */
export function buildSelfOpeningEntity(
  params: Readonly<OpeningParams>,
  layerId: string,
  sceneUnits: SceneUnits = 'mm',
): BuildOpeningEntityResult {
  const validation = validateOpeningParams(params, null);
  if (validation.hardErrors.length > 0) {
    return { ok: false, hardErrors: validation.hardErrors };
  }
  const geometry = computeOpeningGeometry(params, selfOpeningHost(params, sceneUnits), sceneUnits);
  return assembleOpeningEntity(params, geometry, layerId, validation.bimValidation);
}

/**
 * High-level helper bridging the self-host placement tool (ADR-615 §Decision 3,
 * `createSingleClickPlacementTool`) and the builder pipeline. Pure — no side
 * effects. `rotationRad` is the snapped orientation from the underlying DXF
 * line (or ribbon override / 0 fallback) — resolved by the caller.
 */
export function completeSelfOpeningFromClick(
  clickPoint: Readonly<Point2D>,
  rotationRad: number,
  layerId: string,
  overrides: OpeningParamOverrides = {},
  sceneUnits: SceneUnits = 'mm',
): BuildOpeningEntityResult {
  const anchor: Point3D = { x: clickPoint.x, y: clickPoint.y, z: 0 };
  const params = buildDefaultSelfOpeningParams(anchor, rotationRad, overrides);
  return buildSelfOpeningEntity(params, layerId, sceneUnits);
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
