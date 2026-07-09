/**
 * Scene Units SSoT — canonical helpers for the unit field on `SceneModel`.
 *
 * The DXF format carries the original drawing units via the `$INSUNITS`
 * HEADER entry, but historically `dxf-scene-builder` returned a hardcoded
 * `'mm'` regardless of the real value. That made every downstream consumer
 * that builds geometry from defaults (e.g. the ADR-358 stair tool) render
 * at the wrong scale whenever the file was in meters or centimeters.
 *
 * This module owns the following responsibilities, used by every tool that
 * needs to convert between mm-baked defaults and the active scene's space:
 *
 *   1. `SceneUnits` — the discriminated union of all unit identifiers we
 *      surface via `SceneModel.units`.
 *   2. `mmToSceneUnits(units)` — multiplier so that `valueMm * factor` is
 *      expressed in `units`. Pure conversion table, deterministic.
 *   3. `detectSceneUnits(bounds)` — bounds-diagonal heuristic used as a
 *      fallback when the DXF `$INSUNITS` is `0` (unitless) and we still
 *      need to make an informed guess.
 *   4. `resolveSceneUnits(scene)` — preferred entry point for consumers.
 *      Reads `scene.units` first; if missing or set to the legacy default
 *      `'mm'` AND the scene bounds suggest a non-mm scale, falls back to
 *      `detectSceneUnits(bounds)`. Encapsulates the legacy `'mm'`-default
 *      compatibility quirk in one place.
 *   5. `mmScaleFor(params)` / `canvasToMmScaleFor(params)` — resolve the
 *      mm⇄canvas scale directly from any BIM `*Params` object carrying an
 *      optional `sceneUnits` field. SSoT for the `mmToSceneUnits(p.sceneUnits
 *      ?? 'mm')` idiom (and its inverse) previously inlined across the BIM
 *      geometry / grip / validator modules.
 *
 * Industry alignment: AutoCAD `$INSUNITS`, Revit shared coordinates, IFC4
 * `IfcSIUnit` — every CAD/BIM stack carries a scene-level unit field; this
 * module is the React-side equivalent.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-358-dxf-stair-tool-google-level.md §6.1
 */

export type SceneUnits = 'mm' | 'cm' | 'm' | 'in' | 'ft';

/**
 * Multiplier applied to a mm-baked value so it is expressed in `units`.
 * `valueMm * mmToSceneUnits('m') = valueInMeters`.
 */
export function mmToSceneUnits(units: SceneUnits): number {
  switch (units) {
    case 'mm': return 1;
    case 'cm': return 0.1;
    case 'm':  return 0.001;
    case 'in': return 1 / 25.4;
    case 'ft': return 1 / 304.8;
  }
}

/**
 * mm → canvas scale resolved directly from any params object carrying an
 * optional `sceneUnits` field (`WallParams` / `SlabParams` / `BeamParams` /
 * `ColumnParams` / `SlabOpeningParams` / `StairParams`). Encapsulates the
 * `?? 'mm'` legacy-default fallback so the `mmToSceneUnits(p.sceneUnits ?? 'mm')`
 * idiom lives in ONE place. `valueMm * mmScaleFor(params)` → canvas units.
 *
 * SSoT for the 14+ BIM call-sites that previously inlined the fallback (see
 * `.claude-rules/pending-ratchet-work.md` migrate-on-touch entry).
 */
export function mmScaleFor(params: { readonly sceneUnits?: SceneUnits | null }): number {
  return mmToSceneUnits(params.sceneUnits ?? 'mm');
}

/**
 * Inverse of `mmScaleFor`: canvas → mm. `valueCanvas * canvasToMmScaleFor(params)`
 * → mm. Encapsulates the `1 / mmToSceneUnits(p.sceneUnits ?? 'mm')` idiom (slab /
 * slab-opening geometry + validators).
 */
export function canvasToMmScaleFor(params: { readonly sceneUnits?: SceneUnits | null }): number {
  return 1 / mmToSceneUnits(params.sceneUnits ?? 'mm');
}

/**
 * REAL-WORLD distance → canonical-mm model distance (ADR-583 Φ2, graphic scale-bar).
 *
 * Converts a distance expressed in real-world `units` (e.g. `10` metres) into the
 * canonical millimetres the scene stores geometry in (ADR-462). It is the scalar
 * inverse of `mmToSceneUnits` — `realDistanceToModelMm(10, 'm') = 10000` — and is
 * intentionally **scale-INVARIANT**: the drawing/plot scale (1:N) never enters here.
 * A scale bar's span ("this bar IS 10 m") therefore measures the same model
 * distance at 1:50 and 1:100; only its *annotative* thickness/labels change (those
 * ride `paperHeightToModel`). Reuses the `mmToSceneUnits` table — no 1000 / 304.8
 * magic numbers inlined.
 *
 *   `realDistanceToModelMm = distanceInUnits / mmToSceneUnits(units)`
 */
export function realDistanceToModelMm(distance: number, units: SceneUnits): number {
  return distance / mmToSceneUnits(units);
}

/**
 * Bounds-diagonal heuristic used as a fallback when the DXF carries no
 * explicit unit information (`$INSUNITS = 0`). A typical building floorplan
 * has a footprint diagonal of:
 *
 *   in meters     ≈ 10 – 200
 *   in centimeters ≈ 1_000 – 20_000
 *   in millimeters ≈ 10_000 – 200_000
 *
 * Thresholds err on the safe side: pathological tiny scenes (< 1 unit) and
 * giant ones (> 500k) fall back to `'mm'` to preserve the historical default.
 */
export function detectSceneUnits(bounds: {
  min: { x: number; y: number };
  max: { x: number; y: number };
}): SceneUnits {
  const dx = bounds.max.x - bounds.min.x;
  const dy = bounds.max.y - bounds.min.y;
  const diagonal = Math.hypot(dx, dy);
  if (!Number.isFinite(diagonal) || diagonal <= 0) return 'mm';
  if (diagonal < 1) return 'mm';      // unknown / unitless → safe default
  if (diagonal < 500) return 'm';     // 1 – 500 units ≈ meters
  if (diagonal < 50_000) return 'cm'; // 500 – 50k units ≈ centimeters
  return 'mm';                        // 50k+ ≈ millimeters
}

/**
 * ADR-462 CANONICAL-mm — resolve the SOURCE units of an imported DXF (what the file
 * was authored in), used to scale geometry to millimetres at import time.
 *
 * Priority: `$INSUNITS` is trusted EXCEPT when it claims `'mm'` while the coordinate
 * magnitude is far too small to be a real mm drawing — the classic Greek-DXF lie
 * (`$INSUNITS = 4` but coordinates are in metres). There the bounds heuristic wins,
 * because coordinate magnitude is the ground truth of scale. Files with no
 * `$INSUNITS` fall back to the heuristic. The wizard's explicit user override (when
 * present) takes precedence over this at the call site.
 */
export function resolveImportSourceUnits(
  insunitsUnit: SceneUnits | null,
  bounds: { min: { x: number; y: number }; max: { x: number; y: number } } | null | undefined,
): SceneUnits {
  const heuristic = bounds ? detectSceneUnits(bounds) : null;
  if (!insunitsUnit) return heuristic ?? 'mm';
  // $INSUNITS says mm, but the geometry is too small to be real millimetres
  // (a whole floorplan under ~50 cm) → the declaration lies; trust the magnitude.
  if (insunitsUnit === 'mm' && heuristic && heuristic !== 'mm') return heuristic;
  return insunitsUnit;
}

/**
 * Preferred entry point for consumers needing the effective scene units.
 *
 * ADR-462 CANONICAL-mm: scenes now store geometry in millimetres by construction
 * (the unit scale is baked at import in `DxfSceneBuilder.buildScene`). So we **trust
 * the declared unit** — including `'mm'` — and NO LONGER second-guess it with the
 * bounds heuristic. The heuristic survives ONLY as a last resort for legacy/unitless
 * scenes that carry no declaration at all (back-compat).
 *
 * This removed the root cause of the «κολώνα μικροσκοπική στο Ισόγειο» bug: a real
 * mm scene whose small bounds were mis-detected as metres.
 *
 * Returns `'mm'` when no signal is available (back-compat default).
 */
export function resolveSceneUnits(scene: {
  units?: string | null;
  bounds?: { min: { x: number; y: number }; max: { x: number; y: number } } | null;
} | null | undefined): SceneUnits {
  if (!scene) return 'mm';
  const declared = normalizeDeclaredUnits(scene.units);
  if (declared) return declared; // ADR-462 — trust the canonical declaration (incl. 'mm')
  // Legacy fallback only: no declared unit at all → infer from coordinate magnitude.
  if (scene.bounds) {
    const heuristic = detectSceneUnits(scene.bounds);
    if (heuristic !== 'mm') return heuristic;
  }
  return 'mm';
}

/**
 * Map the free-form `scene.units` string to our enum, or `null` when the
 * value is missing / unrecognized. Accepts the canonical short form
 * (`'mm'`, `'cm'`, `'m'`, `'in'`, `'ft'`) plus a couple of long-form
 * spellings sometimes emitted by legacy importers.
 */
function normalizeDeclaredUnits(raw: string | null | undefined): SceneUnits | null {
  if (!raw) return null;
  switch (raw.toLowerCase()) {
    case 'mm':
    case 'millimeter':
    case 'millimeters':
      return 'mm';
    case 'cm':
    case 'centimeter':
    case 'centimeters':
      return 'cm';
    case 'm':
    case 'meter':
    case 'meters':
      return 'm';
    case 'in':
    case 'inch':
    case 'inches':
      return 'in';
    case 'ft':
    case 'foot':
    case 'feet':
      return 'ft';
    default:
      return null;
  }
}

/**
 * Width-magnitude heuristic — infer the scene units when no `SceneModel`
 * is available (e.g. read-only Firestore feeds in `bim-3d/`, validators
 * that only receive `StairParams`). Mirrors the legacy `mmFactorFromWidth`
 * heuristic from `bim/stairs/stair-floor-link.ts` (which now delegates here).
 *
 * Thresholds match industry conventions: a residential stair width is
 *   meters:      0.6 – 1.5
 *   centimeters: 60  – 150
 *   millimeters: 600 – 1500
 *
 * Returns `'mm'` as a defensive default when the value is non-finite or
 * non-positive (matches the legacy 1×-factor fallback).
 */
export function inferSceneUnitsFromWidth(width: number): SceneUnits {
  if (!Number.isFinite(width) || width <= 0) return 'mm';
  if (width < 10) return 'm';
  if (width < 100) return 'cm';
  return 'mm';
}

/**
 * Scene-units → Three.js world (meters) multiplier. Inverse perspective of
 * `mmToSceneUnits`: instead of going mm → scene, this maps the scene value
 * directly to meters which is the Three.js world convention.
 *
 *   `valueInScene * sceneUnitsToMeters(units) = valueInMeters`
 *
 * Used by `bim-3d/converters/*` to translate BIM entity vertex/scalar values
 * into the Three.js scene without each converter re-deriving the conversion.
 */
export function sceneUnitsToMeters(units: SceneUnits): number {
  switch (units) {
    case 'mm': return 0.001;
    case 'cm': return 0.01;
    case 'm':  return 1;
    case 'in': return 0.0254;
    case 'ft': return 0.3048;
  }
}

/**
 * mm-per-DXF-unit for a unit identifier. Inverse-scale partner of the wireframe
 * group scale: `DxfToThreeConverter` lays raw entity coordinates (native DXF units)
 * and scales the whole group by `sceneUnitsToMeters(units)` to reach the Three.js
 * metre world, while the 3D grip/ghost/outline/pick path projects through the
 * **mm-based** `dxfPlanToWorld` (×0.001). Multiplying an entity coordinate by
 * `dxfUnitToMm(units)` expresses it in millimetres, so the grips align with the
 * wireframe at ANY scene unit (cm / m / in / ft), not just mm.
 *
 *   `valueEntityUnits × dxfUnitToMm(units) = valueMm`
 *
 * By construction `dxfUnitToMm = sceneUnitsToMeters × 1000`, which is exactly the
 * metre→mm relationship baked into `dxfPlanToWorld` — so the two scales can never
 * drift apart. mm→1, cm→10, m→1000, in→25.4, ft→304.8. (ADR-537 γ.)
 */
export function dxfUnitToMm(units: SceneUnits): number {
  return sceneUnitsToMeters(units) * 1000;
}

/**
 * mm-per-DXF-unit resolved straight from a DXF scene, mirroring EXACTLY the unit
 * resolution `DxfToThreeConverter.buildColorGroup` uses for the wireframe scale
 * (`resolveSceneUnits({ units })` — declared unit only, no bounds heuristic). This
 * is the single entry point every 3D raw-DXF consumer (grip seat / ghost / hover
 * outline / plan-pick) calls, so they all agree with the wireframe. (ADR-537 γ.)
 */
export function dxfSceneUnitToMm(scene: { units?: string | null } | null | undefined): number {
  return dxfUnitToMm(resolveSceneUnits({ units: scene?.units }));
}

/**
 * AutoCAD `$INSUNITS` code → SceneUnits. Used by `dxf-scene-builder` to
 * propagate the real drawing units into `SceneModel.units` (ADR-358 Phase 8
 * SSoT fix; previously the builder hardcoded `'mm'`).
 *
 * Returns `null` when the code is `0` (Unitless) or maps to a unit we do
 * not yet model — callers should fall back to `detectSceneUnits(bounds)`.
 */
export function insunitsCodeToSceneUnits(code: number | null | undefined): SceneUnits | null {
  switch (code) {
    case 1: return 'in';   // Inches
    case 2: return 'ft';   // Feet
    case 4: return 'mm';   // Millimeters
    case 5: return 'cm';   // Centimeters
    case 6: return 'm';    // Meters
    // 0 = Unitless, 3 = Miles, 7+ = exotic — leave as null so heuristic runs.
    default: return null;
  }
}
