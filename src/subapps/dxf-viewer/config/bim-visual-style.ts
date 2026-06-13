/**
 * ADR-446 — 3D Visual Style SSoT (Revit-grade «Visual Style»).
 *
 * A 3D BIM view's appearance is modelled as TWO independent axes — exactly like
 * Revit's «Graphic Display Options» (Model Display → Style + Show Edges):
 *
 *   FACES (όγκοι): none (wireframe) / consistent (επίπεδο unlit χρώμα) /
 *                  shaded (lit) / realistic (textured PBR) / hidden-line
 *                  (αδιαφανείς λευκές όψεις-occluder).
 *   EDGES (ακμές): none / visible (μόνο ορατές — occluded by faces) /
 *                  all (x-ray — φαίνονται και οι πίσω ακμές).
 *
 * The user picks a {@link VisualStylePreset} (Revit's named visual styles); each
 * preset resolves to a fixed `{faceMode, edgeMode}` pair. The preset is persisted
 * per-view on `BimRenderSettings.visualStyle` (the SSoT — see
 * `bim-render-settings-types.ts`), and the two render pipelines read the resolved
 * axes event-time:
 *   - FACES  → `MaterialCatalog3D` (the SOLE face-material factory).
 *   - EDGES  → `bim-three-edges.ts::attachEdgesProjection` (the SOLE edge-attach).
 *
 * This file is PURE data/types (no logic) — exempt from the 500-line/40-line
 * limits (N.7.1). It owns the preset↔axes mapping; nothing else duplicates it.
 */

/**
 * Revit named visual styles. `*-edges` variants add the model edge overlay on top
 * of the same face mode (Revit «Show Edges» checkbox folded into the preset list,
 * so a single dropdown covers every combination Giorgio asked for).
 */
export type VisualStylePreset =
  | 'wireframe'
  | 'hidden-line'
  | 'shaded'
  | 'shaded-edges'
  | 'consistent'
  | 'consistent-edges'
  | 'realistic'
  | 'realistic-edges';

/** All presets in ribbon-dropdown display order (Revit View Control Bar order). */
export const VISUAL_STYLE_PRESETS: readonly VisualStylePreset[] = [
  'wireframe',
  'hidden-line',
  'shaded',
  'shaded-edges',
  'consistent',
  'consistent-edges',
  'realistic',
  'realistic-edges',
] as const;

/**
 * Face render mode (όγκοι):
 *   - `none`        → faces hidden (material.visible=false) — pure wireframe.
 *   - `consistent`  → unlit flat colour (Revit «Consistent Colors») — orientation-
 *                     independent, no lighting.
 *   - `shaded`      → lit flat colour (Revit «Shaded») — MeshStandardMaterial.
 *   - `realistic`   → textured PBR (Revit «Realistic») — albedo/normal/roughness/ao.
 *   - `hidden-line` → opaque WHITE occluder faces (Revit «Hidden Line») — faces are
 *                     invisible-white but write depth so the back edges are hidden.
 */
export type FaceMode = 'none' | 'consistent' | 'shaded' | 'realistic' | 'hidden-line';

/**
 * Edge overlay mode (ακμές):
 *   - `none`    → no edge overlay built.
 *   - `visible` → only-visible edges (depthTest ON — occluded by their own/other
 *                 faces; Revit «Shaded with Edges» look).
 *   - `all`     → every edge, x-ray (depthTest OFF — back edges show through faces;
 *                 used by Wireframe where there are no occluding faces).
 */
export type EdgeMode = 'none' | 'visible' | 'all';

/** The two resolved render axes for a preset. */
export interface VisualStyleAxes {
  faceMode: FaceMode;
  edgeMode: EdgeMode;
}

/**
 * Default visual style = «Shaded with Edges» (Σκιασμένο με Ακμές): lit flat-colour
 * faces + the always-built visible model edge overlay (ADR-375). Giorgio's chosen
 * default (2026-06-13) — every NEW view opens shaded-with-edges; views that already
 * persisted a `visualStyle` keep their explicit pick.
 */
export const DEFAULT_VISUAL_STYLE: VisualStylePreset = 'shaded-edges';

/** Preset → fixed `{faceMode, edgeMode}` axes (the SSoT mapping). */
export const VISUAL_STYLE_AXES: Record<VisualStylePreset, VisualStyleAxes> = {
  'wireframe': { faceMode: 'none', edgeMode: 'all' },
  'hidden-line': { faceMode: 'hidden-line', edgeMode: 'visible' },
  'shaded': { faceMode: 'shaded', edgeMode: 'none' },
  'shaded-edges': { faceMode: 'shaded', edgeMode: 'visible' },
  'consistent': { faceMode: 'consistent', edgeMode: 'none' },
  'consistent-edges': { faceMode: 'consistent', edgeMode: 'visible' },
  'realistic': { faceMode: 'realistic', edgeMode: 'none' },
  'realistic-edges': { faceMode: 'realistic', edgeMode: 'visible' },
};

/** Resolve the render axes for a preset (falls back to the default on bad input). */
export function resolveVisualStyleAxes(preset: VisualStylePreset | null | undefined): VisualStyleAxes {
  return VISUAL_STYLE_AXES[preset ?? DEFAULT_VISUAL_STYLE] ?? VISUAL_STYLE_AXES[DEFAULT_VISUAL_STYLE];
}

/** Type guard — is `v` a known visual-style preset? (validates persisted/UI input). */
export function isVisualStylePreset(v: unknown): v is VisualStylePreset {
  return typeof v === 'string' && v in VISUAL_STYLE_AXES;
}
