/**
 * ADR-375 Phase B.2 — BimRenderSettings: per-view render settings type.
 *
 * Stored in `dxf_viewer_levels/{levelId}.bimRenderSettings` (optional subfield).
 * Mirrors Revit ViewPlan properties: Scale + ViewRange + VisibilityGraphics.
 *
 * All fields are partial overrides — absent = fallback to DEFAULT_*.
 * Renderers call `resolveBimSettings()` to get fully-resolved effective settings.
 *
 * NOTE: Scale constants live here (not in drawing-scale-store) to break a
 *   config→state→config circular dependency.
 */

import { DEFAULT_VIEW_RANGE, type ViewRange } from './bim-view-range';
import { DEFAULT_OBJECT_STYLES, type BimCategory, type ObjectStyle } from './bim-object-styles';
import type { Discipline } from '../bim/discipline/bim-discipline';

// ── Drawing scale constants (re-exported by drawing-scale-store for compat) ──
export const DEFAULT_DRAWING_SCALE = 100;
export const DRAWING_SCALE_MIN = 1;
export const DRAWING_SCALE_MAX = 10000;
export const DRAWING_SCALE_PRESETS = [10, 20, 50, 100, 200, 500] as const;
export type DrawingScalePreset = typeof DRAWING_SCALE_PRESETS[number];

// ── Core type ──────────────────────────────────────────────────────────────

export interface BimRenderSettings {
  /** Annotation scale denominator (e.g. 100 → 1:100). */
  drawingScale: number;
  /** Partial ViewRange override (mm). Absent keys fall back to DEFAULT_VIEW_RANGE. */
  viewRange?: Partial<ViewRange>;
  /** Partial ObjectStyles override. Absent categories fall back to DEFAULT_OBJECT_STYLES. */
  objectStyles?: Partial<Record<BimCategory, ObjectStyle>>;
  /**
   * ADR-405 §4 — per-discipline visibility (Revit "View Discipline"). Absent
   * discipline keys ⇒ visible. Persisted per-view alongside the V/G overrides.
   */
  disciplineVisibility?: Partial<Record<Discipline, boolean>>;
  /**
   * ADR-408 Φ7 — colour-by-system master toggle (Revit "Color circuits by
   * system" view option). Absent ⇒ `true` (circuits/fixtures/panels/wires paint
   * with their owning System's colour). `false` ⇒ they fall back to the renderer
   * default colour. Persisted per-view.
   */
  colorBySystem?: boolean;
  /**
   * ADR-413 — realistic PBR materials master toggle (Revit "Realistic" visual
   * style). Absent ⇒ `true` (textured `MeshStandardMaterial`s with albedo/normal/
   * roughness/ao maps). `false` ⇒ flat colour materials. Persisted per-view.
   */
  realisticMaterials?: boolean;
  /**
   * ADR-422 L1 — analytical heat-load overlay master toggle (Revit "Heating
   * Loads" view). Absent ⇒ `false` (opt-in: the analytical heat-map is off by
   * default so it does not clutter the normal drawing). `true` ⇒ each thermal
   * space is painted with a cold→hot heat-map + Φ (W) / W/m² label. Per-view.
   */
  showHeatLoad?: boolean;
}

export interface ResolvedBimSettings {
  drawingScale: number;
  viewRange: ViewRange;
  objectStyles: Record<BimCategory, ObjectStyle>;
  disciplineVisibility: Partial<Record<Discipline, boolean>>;
  colorBySystem: boolean;
  realisticMaterials: boolean;
  showHeatLoad: boolean;
}

// ── Resolver ───────────────────────────────────────────────────────────────

/** Merge user overrides with defaults — always returns a fully-resolved object. */
export function resolveBimSettings(s?: BimRenderSettings | null): ResolvedBimSettings {
  const rawScale = s?.drawingScale ?? DEFAULT_DRAWING_SCALE;
  return {
    drawingScale: Math.max(DRAWING_SCALE_MIN, Math.min(DRAWING_SCALE_MAX, Math.round(rawScale))),
    viewRange: s?.viewRange ? { ...DEFAULT_VIEW_RANGE, ...s.viewRange } : DEFAULT_VIEW_RANGE,
    objectStyles: s?.objectStyles
      ? { ...DEFAULT_OBJECT_STYLES, ...s.objectStyles } as Record<BimCategory, ObjectStyle>
      : DEFAULT_OBJECT_STYLES as Record<BimCategory, ObjectStyle>,
    // ADR-405 §4 — absent ⇒ {} (all disciplines visible).
    disciplineVisibility: s?.disciplineVisibility ?? {},
    // ADR-408 Φ7 — absent ⇒ true (colour-by-system on, the legacy behaviour).
    colorBySystem: s?.colorBySystem ?? true,
    // ADR-413 — absent ⇒ true (realistic PBR materials on, the visible default).
    realisticMaterials: s?.realisticMaterials ?? true,
    // ADR-422 L1 — absent ⇒ false (analytical heat-load overlay off by default).
    showHeatLoad: s?.showHeatLoad ?? false,
  };
}
