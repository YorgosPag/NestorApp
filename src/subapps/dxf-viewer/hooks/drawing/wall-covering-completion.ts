/**
 * ADR-511 — Pure builders για δημιουργία οντότητας Φινιρίσματος Τοίχου (WallCovering).
 *
 * SSoT:
 *   - Δημιουργία μέσω `createWallCovering()` factory (prefix 'wcv', N.6).
 *   - Scalar geometry μέσω `computeWallCoveringGeometry()` (params-only).
 *   - Cacheable render geometry (outline + bbox για selection/hit-test) μέσω
 *     `computeWallCoveringRenderGeometry()` (host τοίχος) — ο 2D render παραμένει live.
 *   - Validation inline (έγκυρο span + ≥1 στρώση).
 *
 * Flow (manual tool, Slice B): pick τοίχου + παρειάς → 2 κλικ κατά μήκος παρειάς
 * (spanStart/spanEnd) → `buildWallCoveringEntity` με auto assembly (default σοβάς+λευκή μπογιά
 * ή override από ribbon). Το room-fill (Slice C) ξανα-χρησιμοποιεί τον ΙΔΙΟ builder ανά δωμάτιο.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-511-wall-finish-per-room.md
 * @see hooks/drawing/floor-finish-completion.ts — το πρότυπο
 */

import {
  DEFAULT_WALL_COVERING_BOTTOM_MM,
  DEFAULT_WALL_COVERING_HEIGHT_MM,
  DEFAULT_WALL_COVERING_LAYERS,
  computeWallCoveringGeometry,
  type WallCoveringEntity,
  type WallCoveringFaceSide,
  type WallCoveringLayer,
  type WallCoveringParams,
} from '../../bim/types/wall-covering-types';
import {
  computeWallCoveringRenderGeometry,
  type WallCoveringHost,
} from '../../bim/wall-coverings/wall-covering-strip-geometry';
import { createWallCovering } from '@/services/factories/wall-covering.factory';
import type { SceneUnits } from '../../utils/scene-units';

export type { SceneUnits };

// ─── Param overrides accepted by the builder ─────────────────────────────────

/** Field overrides (από ribbon / room-defaults). */
export interface WallCoveringParamOverrides {
  /** Compound assembly (≥1 στρώση). Default = σοβάς + λευκή μπογιά. */
  readonly layers?: readonly WallCoveringLayer[];
  /** mm. Πάνω όριο (default = καθαρό ύψος ορόφου ή DEFAULT_WALL_COVERING_HEIGHT_MM). */
  readonly heightTopMm?: number;
  /** mm. Κάτω όριο (default 0 = δάπεδο). */
  readonly heightBottomMm?: number;
  /** FK → ThermalSpace.id (το δωμάτιο που όρισε το extent, Slice C). */
  readonly spaceId?: string;
  /** User label. */
  readonly name?: string;
  /** FK → Floor.id. */
  readonly floorId?: string;
}

// ─── Span input (από pick + 2 κλικ) ───────────────────────────────────────────

export interface WallCoveringSpanInput {
  readonly hostWallId: string;
  readonly faceSide: WallCoveringFaceSide;
  readonly spanStartMm: number;
  readonly spanEndMm: number;
}

// ─── Defaults factory ────────────────────────────────────────────────────────

/** Build `WallCoveringParams` από span + overrides. Span auto-ordered (start < end). */
export function buildDefaultWallCoveringParams(
  span: Readonly<WallCoveringSpanInput>,
  overrides: WallCoveringParamOverrides = {},
  sceneUnits: SceneUnits = 'mm',
): WallCoveringParams {
  const layers = overrides.layers && overrides.layers.length > 0
    ? overrides.layers
    : DEFAULT_WALL_COVERING_LAYERS;
  const heightBottomMm = overrides.heightBottomMm ?? DEFAULT_WALL_COVERING_BOTTOM_MM;
  const heightTopMm = overrides.heightTopMm ?? DEFAULT_WALL_COVERING_HEIGHT_MM;
  const lo = Math.min(span.spanStartMm, span.spanEndMm);
  const hi = Math.max(span.spanStartMm, span.spanEndMm);

  return {
    hostWallId: span.hostWallId,
    faceSide: span.faceSide,
    spanStartMm: lo,
    spanEndMm: hi,
    heightBottomMm,
    heightTopMm,
    layers,
    sceneUnits,
    ...(overrides.spaceId !== undefined ? { spaceId: overrides.spaceId } : {}),
    ...(overrides.name !== undefined ? { name: overrides.name } : {}),
    ...(overrides.floorId !== undefined ? { floorId: overrides.floorId } : {}),
  };
}

// ─── Entity builder ──────────────────────────────────────────────────────────

export type BuildWallCoveringEntityResult =
  | { readonly ok: true; readonly entity: WallCoveringEntity }
  | { readonly ok: false; readonly hardErrors: readonly string[] };

const MIN_SPAN_MM = 1;

/**
 * Build a `WallCoveringEntity` από params + host τοίχο. Geometry = scalars
 * (`computeWallCoveringGeometry`) + cached render bits (`computeWallCoveringRenderGeometry`,
 * αν δοθεί host). Validation: έγκυρο span + ≥1 στρώση.
 */
export function buildWallCoveringEntity(
  params: Readonly<WallCoveringParams>,
  layerId: string,
  host?: WallCoveringHost,
): BuildWallCoveringEntityResult {
  if (params.spanEndMm - params.spanStartMm < MIN_SPAN_MM) {
    return { ok: false, hardErrors: ['wall-covering.error.spanTooSmall'] };
  }
  if (!params.layers || params.layers.length < 1) {
    return { ok: false, hardErrors: ['wall-covering.error.noLayers'] };
  }
  const geometry = {
    ...computeWallCoveringGeometry(params),
    ...(host ? computeWallCoveringRenderGeometry(host, params) : {}),
  };
  const entity = createWallCovering({ params, geometry, layerId, visible: true });
  return { ok: true, entity };
}
