/**
 * Foundation entity builders (ADR-436, Slice 1).
 *
 * Mirror του `column-completion.ts`. Pure builders — μηδέν side effects.
 *
 * SSoT:
 *   - IDs via `generateFoundationId()` (N.6 enterprise-id, μέσα στο factory).
 *   - Geometry via `computeFoundationGeometry()` — pure function.
 *   - Validation via `validateFoundationParams()` — hardErrors block creation.
 *   - Types via `bim/types/foundation-types.ts`.
 *
 * Single-click flow (pad — Slice 1):
 *   - User picks Foundation tool → kind = 'pad'.
 *   - Click on canvas → `buildDefaultFoundationParams(clickPoint, 'pad', overrides)`
 *     resolves position + width + length + thickness + topElevation + anchor.
 *   - `buildFoundationEntity()` validates + builds entity.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-436-bim-foundation-discipline.md
 */

import type { Point2D } from '../../rendering/types/Types';
import type { Point3D } from '../../bim/types/bim-base';
import {
  DEFAULT_FOUNDATION_ANCHOR,
  DEFAULT_FOUNDATION_ROTATION_DEG,
  DEFAULT_FOUNDATION_TOP_ELEVATION_MM,
  DEFAULT_PAD_LENGTH_MM,
  DEFAULT_PAD_THICKNESS_MM,
  DEFAULT_PAD_WIDTH_MM,
  DEFAULT_STRIP_THICKNESS_MM,
  DEFAULT_STRIP_WIDTH_MM,
  DEFAULT_TIE_BEAM_DEPTH_MM,
  DEFAULT_TIE_BEAM_WIDTH_MM,
  type FoundationAnchor,
  type FoundationEntity,
  type FoundationKind,
  type FoundationParams,
  type FoundationProfile,
} from '../../bim/types/foundation-types';
import { computeFoundationGeometry } from '../../bim/geometry/foundation-geometry';
import { validateFoundationParams } from '../../bim/validators/foundation-validator';
import { createFoundation } from '@/services/factories/foundation.factory';
import type { SceneUnits } from '../../utils/scene-units';

export type { SceneUnits };

// ─── Param overrides accepted by the builder ─────────────────────────────────

/**
 * Field overrides για `buildDefaultFoundationParams`. Ο contextual foundation
 * ribbon tab supplies kind / anchor / width / length / thickness / rotation /
 * topElevation / material. Line-based kinds (strip/tie-beam) supply επίσης
 * `axisEnd` (Slice 2 — line tool).
 */
export interface FoundationParamOverrides {
  readonly kind?: FoundationKind;
  readonly anchor?: FoundationAnchor;
  /** mm. Πλάτος βάσης (pad X-axis / band πλάτος). */
  readonly width?: number;
  /** mm. Μήκος βάσης (pad only). */
  readonly length?: number;
  /** mm. Βάθος πεδίλου / ύψος διατομής. */
  readonly thicknessMm?: number;
  /** Μοίρες CCW (pad only). */
  readonly rotation?: number;
  /** mm. Στάθμη άνω παρειάς (τυπικά αρνητική). */
  readonly topElevationMm?: number;
  readonly material?: string;
  /** Pad vertical profile (Slice 1 = 'flat'). */
  readonly profile?: FoundationProfile;
  /** Catalog profile ID (Slice 4). */
  readonly catalogProfile?: string;
  /** Line-based kinds — άξονας τέλος (Slice 2). */
  readonly axisEnd?: Point3D;
}

/** Kind-specific defaults για width/length/thickness. */
function getKindDimensionDefaults(kind: FoundationKind): {
  width: number;
  length: number;
  thicknessMm: number;
} {
  switch (kind) {
    case 'strip':
      return { width: DEFAULT_STRIP_WIDTH_MM, length: DEFAULT_STRIP_WIDTH_MM, thicknessMm: DEFAULT_STRIP_THICKNESS_MM };
    case 'tie-beam':
      return { width: DEFAULT_TIE_BEAM_WIDTH_MM, length: DEFAULT_TIE_BEAM_WIDTH_MM, thicknessMm: DEFAULT_TIE_BEAM_DEPTH_MM };
    default:
      return { width: DEFAULT_PAD_WIDTH_MM, length: DEFAULT_PAD_LENGTH_MM, thicknessMm: DEFAULT_PAD_THICKNESS_MM };
  }
}

// ─── Defaults factory ────────────────────────────────────────────────────────

/**
 * Build `FoundationParams` από clicked point + optional overrides.
 *
 * Algorithm:
 *   1. Resolve kind (override → 'pad' default).
 *   2. Resolve width / length / thickness / rotation / anchor / topElevation.
 *   3. pad → `position` = click. strip/tie-beam → `start` = click, `end` =
 *      override.axisEnd ?? click+1000mm στον X (placeholder, Slice 2 line tool).
 */
export function buildDefaultFoundationParams(
  clickPoint: Readonly<Point2D>,
  kindArg?: FoundationKind,
  overrides: FoundationParamOverrides = {},
  sceneUnits: SceneUnits = 'mm',
): FoundationParams {
  const kind = overrides.kind ?? kindArg ?? 'pad';
  const dims = getKindDimensionDefaults(kind);
  const width = overrides.width ?? dims.width;
  const thicknessMm = overrides.thicknessMm ?? dims.thicknessMm;
  const topElevationMm = overrides.topElevationMm ?? DEFAULT_FOUNDATION_TOP_ELEVATION_MM;
  const material = overrides.material;
  const catalogProfile = overrides.catalogProfile;

  const common = {
    topElevationMm,
    thicknessMm,
    sceneUnits,
    ...(material !== undefined ? { material } : {}),
    ...(catalogProfile !== undefined ? { catalogProfile } : {}),
  };

  if (kind === 'pad') {
    const position: Point3D = { x: clickPoint.x, y: clickPoint.y, z: 0 };
    return {
      kind: 'pad',
      ...common,
      position,
      width,
      length: overrides.length ?? dims.length,
      rotation: overrides.rotation ?? DEFAULT_FOUNDATION_ROTATION_DEG,
      anchor: overrides.anchor ?? DEFAULT_FOUNDATION_ANCHOR,
      profile: overrides.profile ?? 'flat',
    };
  }

  const start: Point3D = { x: clickPoint.x, y: clickPoint.y, z: 0 };
  const end: Point3D = overrides.axisEnd ?? { x: clickPoint.x + 1000, y: clickPoint.y, z: 0 };
  return {
    kind,
    ...common,
    start,
    end,
    width,
  };
}

// ─── Entity builder ──────────────────────────────────────────────────────────

export type BuildFoundationEntityResult =
  | { readonly ok: true; readonly entity: FoundationEntity }
  | { readonly ok: false; readonly hardErrors: readonly string[] };

/**
 * Build a `FoundationEntity` από `FoundationParams`. Geometry computed via SSoT
 * `computeFoundationGeometry()`. Hard errors short-circuit creation.
 */
export function buildFoundationEntity(
  params: Readonly<FoundationParams>,
  layerId: string,
): BuildFoundationEntityResult {
  const validation = validateFoundationParams(params);
  if (validation.hardErrors.length > 0) {
    return { ok: false, hardErrors: validation.hardErrors };
  }
  const geometry = computeFoundationGeometry(params);
  const entity = createFoundation({
    params,
    geometry,
    layerId,
    visible: true,
    validation: validation.bimValidation,
  });
  return { ok: true, entity };
}

// ─── Single-click completion helper ─────────────────────────────────────────

/**
 * High-level helper που bridges το foundation-tool FSM (Slice 1: single-click
 * pad) και το builder pipeline. Pure — no side effects.
 */
export function completeFoundationFromClick(
  clickPoint: Readonly<Point2D>,
  layerId: string,
  kind?: FoundationKind,
  overrides: FoundationParamOverrides = {},
  sceneUnits: SceneUnits = 'mm',
): BuildFoundationEntityResult {
  const params = buildDefaultFoundationParams(clickPoint, kind, overrides, sceneUnits);
  return buildFoundationEntity(params, layerId);
}

// ─── Two-click completion helper (line kinds — Slice 2) ──────────────────────

/**
 * High-level helper που bridges το foundation-tool line FSM (Slice 2: 2-click
 * strip / tie-beam) και το builder pipeline. Pure — no side effects. Ο `end`
 * περνά ως `axisEnd` override ώστε το `buildDefaultFoundationParams` να χτίσει το
 * line-based band (mirror `completeBeamFromTwoClicks`).
 */
export function completeFoundationFromTwoClicks(
  startPoint: Readonly<Point2D>,
  endPoint: Readonly<Point2D>,
  layerId: string,
  kind: FoundationKind = 'strip',
  overrides: FoundationParamOverrides = {},
  sceneUnits: SceneUnits = 'mm',
): BuildFoundationEntityResult {
  const axisEnd: Point3D = { x: endPoint.x, y: endPoint.y, z: 0 };
  const params = buildDefaultFoundationParams(startPoint, kind, { ...overrides, kind, axisEnd }, sceneUnits);
  return buildFoundationEntity(params, layerId);
}
