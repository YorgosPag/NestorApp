/**
 * ADR-363 Phase 3 + ADR-369 Phase A4 — Pure builders για slab entity creation.
 *
 * SSoT:
 *   - Entity creation via `createSlab()` factory (ADR-369 Phase A4).
 *   - IDs auto-generated από factory (prefix 'slab').
 *   - Geometry via `computeSlabGeometry()` — pure function.
 *   - Validation via `validateSlabParams()` — hardErrors block creation.
 *   - Types via `bim/types/slab-types.ts`.
 *
 * Polygon-drawing flow (Phase 3):
 *   - User multi-clicks (Enter ή auto-close near first vertex) → vertex list.
 *   - `buildDefaultSlabParams()` wraps vertices + applies overrides + defaults
 *     (thickness 200mm, kind 'floor', levelElevation per-kind, geometryType 'box').
 *   - `buildSlabEntity()` validates + delegates σε `createSlab()` factory.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.5
 * @see docs/centralized-systems/reference/adrs/ADR-369-bim-elevation-convention-revit-alignment.md §2.1, §9 Q7, §9 Q8
 */

import type { Point2D } from '../../rendering/types/Types';
import type { Point3D } from '../../bim/types/bim-base';
import {
  DEFAULT_SLAB_GEOMETRY_TYPE,
  DEFAULT_SLAB_THICKNESS_MM,
  SLAB_KIND_DEFAULT_LEVEL_ELEVATION_MM,
  type SlabEntity,
  type SlabGeometryType,
  type SlabKind,
  type SlabParams,
  type SlabReinforcement,
  type SlabSlope,
} from '../../bim/types/slab-types';
import type { SlabDna } from '../../bim/types/slab-dna-types';
import { computeSlabGeometry } from '../../bim/geometry/slab-geometry';
import { validateSlabParams } from '../../bim/validators/slab-validator';
import { resolveAutoSlabTypeId } from '../../bim/family-types/slab-type-auto-assign';
import { createSlab } from '@/services/factories/slab.factory';
import type { SceneUnits } from '../../utils/scene-units';

export type { SceneUnits };

// ─── Param overrides accepted by the builder ─────────────────────────────────

/**
 * Field overrides για `buildDefaultSlabParams`. Ribbon (contextual slab tab)
 * supplies kind / thickness / levelElevation / reinforcement / geometry options.
 */
export interface SlabParamOverrides {
  readonly kind?: SlabKind;
  /** mm. Πάχος πλάκας. */
  readonly thickness?: number;
  /** mm. Top face z από project origin (FFL). ADR-369 §2.1. */
  readonly levelElevation?: number;
  /** mm. Optional offset από FFL (default 0). ADR-369 §2.1. */
  readonly heightOffsetFromLevel?: number;
  /** ADR-369 §9 Q7. 'box' (default) | 'tilted'. */
  readonly geometryType?: SlabGeometryType;
  /** Required ΟΤΑΝ geometryType='tilted'. */
  readonly slope?: SlabSlope;
  readonly reinforcement?: SlabReinforcement;
  readonly material?: string;
  /**
   * Composite layered build-up. When supplied, `thickness` is derived from
   * `dna.totalThickness` (SSoT — overrides any explicit `thickness`). Legacy
   * single-material slabs omit it. Usually injected by the slab family-type.
   */
  readonly dna?: SlabDna;
}

// ─── Defaults factory ────────────────────────────────────────────────────────

/**
 * Build `SlabParams` από vertex list + optional overrides.
 *
 * Algorithm:
 *   1. Resolve kind (override → 'floor' default).
 *   2. Resolve thickness (override → DEFAULT_SLAB_THICKNESS_MM).
 *   3. Resolve levelElevation (override → SLAB_KIND_DEFAULT_LEVEL_ELEVATION_MM[kind]).
 *   4. Resolve geometryType (override → 'box').
 *   5. Lift 2D vertices σε Point3D (z=0).
 *
 * Vertices αναμένονται σε scene units (mm convention — caller responsible
 * για conversion αν χρειάζεται). Δεν κάνει copy/normalize — caller passes
 * defensive copy αν χρειάζεται.
 */
export function buildDefaultSlabParams(
  vertices: readonly Point2D[],
  overrides: SlabParamOverrides = {},
  sceneUnits: SceneUnits = 'mm',
): SlabParams {
  const kind = overrides.kind ?? 'floor';
  // SSoT: dna (when present) owns the thickness — derive, do not double-enter.
  const thickness =
    overrides.dna?.totalThickness ??
    overrides.thickness ??
    DEFAULT_SLAB_THICKNESS_MM;
  const levelElevation =
    overrides.levelElevation ?? SLAB_KIND_DEFAULT_LEVEL_ELEVATION_MM[kind];
  const geometryType = overrides.geometryType ?? DEFAULT_SLAB_GEOMETRY_TYPE;

  const lifted: Point3D[] = vertices.map((v) => ({ x: v.x, y: v.y, z: 0 }));

  const params: SlabParams = {
    kind,
    outline: { vertices: lifted },
    levelElevation,
    thickness,
    geometryType,
    sceneUnits,
    ...(overrides.heightOffsetFromLevel !== undefined
      ? { heightOffsetFromLevel: overrides.heightOffsetFromLevel }
      : {}),
    ...(overrides.slope !== undefined ? { slope: overrides.slope } : {}),
    ...(overrides.reinforcement !== undefined
      ? { reinforcement: overrides.reinforcement }
      : {}),
    ...(overrides.material !== undefined ? { material: overrides.material } : {}),
    ...(overrides.dna !== undefined ? { dna: overrides.dna } : {}),
  };
  return params;
}

// ─── Entity builder ──────────────────────────────────────────────────────────

export type BuildSlabEntityResult =
  | { readonly ok: true; readonly entity: SlabEntity }
  | { readonly ok: false; readonly hardErrors: readonly string[] };

/**
 * Build a `SlabEntity` από `SlabParams`. Geometry computed via SSoT
 * `computeSlabGeometry()`. Hard errors short-circuit creation. Final entity
 * assembled via `createSlab()` factory (ADR-369 Phase A4) — auto-fills
 * ifcGuid + ifcType='IfcSlab' + validation shell.
 */
export function buildSlabEntity(
  params: Readonly<SlabParams>,
  layerId: string,
): BuildSlabEntityResult {
  const validation = validateSlabParams(params);
  if (validation.hardErrors.length > 0) {
    return { ok: false, hardErrors: validation.hardErrors };
  }
  const geometry = computeSlabGeometry(params);
  const entity = createSlab({
    params,
    geometry,
    layerId,
    visible: true,
    validation: validation.bimValidation,
  });
  // ADR-412 — link the slab to its kind's read-only built-in family type when
  // its cross-section matches the kind default (non-destructive; bare/customised
  // slabs stay ad-hoc). Resolution + persistence already carry `typeId`.
  const typeId = resolveAutoSlabTypeId(params);
  return { ok: true, entity: typeId ? { ...entity, typeId } : entity };
}

// ─── Polygon-click completion helper ─────────────────────────────────────────

/**
 * High-level helper που bridges το slab-tool FSM (Phase 3: N-click polygon
 * + Enter ή auto-close) και το builder pipeline. Pure — no side effects.
 *
 * Caller MUST ensure `vertices.length >= 3` (FSM guard upstream) — αλλιώς
 * το validator hard-errors και η `buildSlabEntity` επιστρέφει `ok: false`.
 */
export function completeSlabFromPolygonClicks(
  vertices: readonly Point2D[],
  layerId: string,
  overrides: SlabParamOverrides = {},
  sceneUnits: SceneUnits = 'mm',
): BuildSlabEntityResult {
  const params = buildDefaultSlabParams(vertices, overrides, sceneUnits);
  return buildSlabEntity(params, layerId);
}
