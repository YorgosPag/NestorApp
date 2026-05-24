/**
 * Scene Units SSoT — canonical helpers for the unit field on `SceneModel`.
 *
 * The DXF format carries the original drawing units via the `$INSUNITS`
 * HEADER entry, but historically `dxf-scene-builder` returned a hardcoded
 * `'mm'` regardless of the real value. That made every downstream consumer
 * that builds geometry from defaults (e.g. the ADR-358 stair tool) render
 * at the wrong scale whenever the file was in meters or centimeters.
 *
 * This module owns three responsibilities, used by every tool that needs to
 * convert between mm-baked defaults and the active scene's coordinate space:
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
 * Preferred entry point for consumers needing the effective scene units.
 *
 * Strategy:
 *   1. If `scene.units` is a real unit other than the legacy `'mm'` default,
 *      trust it (the dxf-scene-builder ADR-358 hotfix now propagates the
 *      real `$INSUNITS`).
 *   2. If `scene.units` is `'mm'` (potentially legacy hardcode) and the
 *      bounds diagonal does NOT look like millimeters, fall back to
 *      `detectSceneUnits(bounds)` to recover.
 *   3. If `scene.units` is missing / unknown, run the heuristic.
 *
 * Returns `'mm'` when no other signal is available (back-compat default).
 */
export function resolveSceneUnits(scene: {
  units?: string | null;
  bounds?: { min: { x: number; y: number }; max: { x: number; y: number } } | null;
} | null | undefined): SceneUnits {
  if (!scene) return 'mm';
  const declared = normalizeDeclaredUnits(scene.units);
  if (declared && declared !== 'mm') return declared;
  if (scene.bounds) {
    const heuristic = detectSceneUnits(scene.bounds);
    if (heuristic !== 'mm') return heuristic;
  }
  return declared ?? 'mm';
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
