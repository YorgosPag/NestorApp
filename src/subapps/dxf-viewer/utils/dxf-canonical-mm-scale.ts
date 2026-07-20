/**
 * ADR-462 CANONICAL-mm — one-shot import unit-scale pass (SSoT).
 *
 * Extracted from `DxfSceneBuilder.buildSceneWithDiagnostics` (N.7.1 file-size split) so the
 * scene-builder stays under the 500-line ceiling and this pass can be unit-tested on its own.
 *
 * A DXF is authored in WHATEVER units its author chose, but a `SceneModel` always stores
 * geometry in **millimetres**. This module resolves the SOURCE unit and, when it differs from
 * mm, scales every coordinate once — so all floors of a building share ONE unit and BIM
 * entities (authored in mm) align with the underlay.
 *
 * Source-unit priority (ADR-368 order, applied as a SCALE not a render-time label):
 *   explicit wizard override → `$INSUNITS` → bounds heuristic.
 */
import type { AnySceneEntity } from '../types/scene';
import type { Entity } from '../types/entities';
import type { DxfHeaderData } from './dxf-parser-types';
import { recordError, type ImportDiagnostics } from './dxf-import-diagnostics';
import {
  insunitsCodeToSceneUnits,
  mmToSceneUnits,
  resolveImportSourceUnits,
  resolveUnitDetectionBounds,
  type SceneUnits,
} from './scene-units';
// ADR-348 SSoT — per-entity scale transform (reused for the import unit-scale pass).
import { scaleEntity } from '../systems/scale/scale-entity-transform';

/** Axis-aligned {min,max} extents — mirrors `computeEntityArrayBounds`'s return shape. */
export interface SceneEntityBounds {
  min: { x: number; y: number };
  max: { x: number; y: number };
}

export interface CanonicalMmScaleInput {
  /** Entities in SOURCE units (post out-of-extents filtering). */
  entities: AnySceneEntity[];
  /** Bounds of `entities`, in SOURCE units. */
  bounds: SceneEntityBounds;
  header: DxfHeaderData;
  /** Explicit wizard override — wins over `$INSUNITS` and the bounds heuristic. */
  unitsOverride?: SceneUnits;
  /** Fault-tolerant collector: a single entity that resists scaling is recorded, not fatal. */
  diagnostics: ImportDiagnostics;
  /** Block-aware bounds recomputation, injected so this module stays free of block deps. */
  recomputeBounds: (entities: AnySceneEntity[]) => SceneEntityBounds;
}

export interface CanonicalMmScaleResult {
  entities: AnySceneEntity[];
  bounds: SceneEntityBounds;
  /** The unit the DXF was authored in — recorded for diagnostics/telemetry. */
  sourceUnits: SceneUnits;
}

/**
 * Resolve the drawing's SOURCE unit from the three authoritative inputs.
 *
 * ADR-362 Round 20 — the heuristic is fed the junk-free STORED extents (`$EXTMIN`/`$EXTMAX`)
 * when the header carries them, else the computed entity bounds. Without this, geo-referenced
 * metre surveys whose stray origin entities (legacy ASHADE blocks at 0,0, degenerate spline
 * control points) inflate the bounds diagonal into the mm bucket → `$INSUNITS=4` (mm) trusted
 * → geometry left un-scaled → the whole survey shrinks ×1000.
 */
export function resolveSourceUnits(
  header: DxfHeaderData,
  bounds: SceneEntityBounds,
  unitsOverride?: SceneUnits,
): SceneUnits {
  if (unitsOverride) return unitsOverride;

  const fromInsunits = insunitsCodeToSceneUnits(header.insunits);
  const declaredExtents = header.extmin && header.extmax
    ? { min: header.extmin, max: header.extmax }
    : null;
  const detectionBounds = resolveUnitDetectionBounds(declaredExtents, bounds);

  return resolveImportSourceUnits(fromInsunits, detectionBounds);
}

/**
 * Scale every entity from its source unit to millimetres. No-op (same arrays returned) when
 * the drawing is already mm, so normal mm files pay nothing.
 */
export function applyCanonicalMmScale(input: CanonicalMmScaleInput): CanonicalMmScaleResult {
  const { entities, bounds, header, unitsOverride, diagnostics, recomputeBounds } = input;

  const sourceUnits = resolveSourceUnits(header, bounds, unitsOverride);

  // mmToSceneUnits('m') = 0.001 → a value in metres × (1/0.001)=1000 becomes mm.
  const mmFactor = 1 / mmToSceneUnits(sourceUnits);
  const needsScale = Number.isFinite(mmFactor) && mmFactor > 0 && Math.abs(mmFactor - 1) > 1e-9;
  if (!needsScale) return { entities, bounds, sourceUnits };

  // Uniform scale around the origin (0,0) → reuses the ADR-348 per-entity SSoT (`scaleEntity`),
  // so every entity type (line/arc/circle/text/dimension/hatch…) scales correctly without
  // re-implementing per-type math. Coordinates, radii and text heights all become mm.
  const origin = { x: 0, y: 0 };
  const scaled = entities.map((e) => {
    try {
      return { ...e, ...scaleEntity(e as unknown as Entity, origin, mmFactor, mmFactor) } as AnySceneEntity;
    } catch (err) {
      // A single entity that resists the unit-scale must not sink the whole import —
      // keep it unscaled and record it (ADR-635 Φ3).
      recordError(diagnostics, {
        kind: (e as { type?: string }).type || 'UNKNOWN',
        reason: `unit-scale failed: ${err instanceof Error ? err.message : String(err)}`,
      });
      return e;
    }
  });

  return { entities: scaled, bounds: recomputeBounds(scaled), sourceUnits };
}
