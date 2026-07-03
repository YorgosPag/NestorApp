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
import {
  DEFAULT_OBJECT_STYLES, type BimCategory, type ObjectStyle, type SubcategoryStyle,
} from './bim-object-styles';
import type { Discipline } from '../bim/discipline/bim-discipline';
import {
  DEFAULT_VISUAL_STYLE,
  DEFAULT_BACKGROUND_MODE,
  resolveVisualStyleAxes,
  type VisualStylePreset,
  type FaceMode,
  type EdgeMode,
  type BackgroundMode,
} from './bim-visual-style';

// ── Drawing scale constants (re-exported by drawing-scale-store for compat) ──
export const DEFAULT_DRAWING_SCALE = 100;
export const DRAWING_SCALE_MIN = 1;
export const DRAWING_SCALE_MAX = 10000;

/**
 * ADR-445 — schema version of the persisted `bimRenderSettings`. Bump when a code
 * default change must reach already-saved levels. `loadForLevel` runs
 * {@link migrateBimRenderSettings} on any doc whose `settingsVersion` is lower and
 * persists the healed snapshot once (idempotent). v1 = per-category structural colour
 * identity (column→blue / beam→amber / foundation→sienna / stair→teal / railing→steel).
 * v2 (ADR-446) = derive the per-view `visualStyle` preset from the legacy
 * `realisticMaterials` bit, so old views keep their exact look under the new
 * Visual Style SSoT.
 */
export const BIM_SETTINGS_VERSION = 2;
export const DRAWING_SCALE_PRESETS = [10, 20, 50, 100, 200, 500] as const;
export type DrawingScalePreset = typeof DRAWING_SCALE_PRESETS[number];

/**
 * ADR-375 Phase B.4 — reference paper for the fit-to-paper AUTO drawing scale.
 * A3 landscape = 420×297 mm; we reserve a ~10 mm margin per edge → 400×277 mm
 * usable. `long`/`short` are orientation-agnostic: the auto-fit matches the
 * scene's LONG side to the paper's LONG side, so a portrait scene still fits.
 * @see systems/dimensions/auto-drawing-scale.ts — the pure fit-to-paper SSoT.
 */
export const FIT_TO_PAPER_A3_USABLE_MM = { long: 400, short: 277 } as const;

// ── ADR-455 — vertical section cuts (X/Y) ───────────────────────────────────

/**
 * ADR-455 — one vertical section cut (along world DXF X or Y). Mirrors the
 * horizontal Z cut (ADR-452) but as an absolute world-space plane the user can
 * flip. `position` = world plan coordinate of the cut in SCENE/CANVAS units (the
 * same space as `scene.bounds` and `BoundsCalculator`; for BIM scenes that is
 * metres, used 1:1 in three.js — NOT mm). `sign` (+1/−1) chooses which side is
 * KEPT in 3D (the side the arrow points to) / SOLID in 2D (the opposite side
 * renders as a ghost). Both X and Y default OFF.
 */
export interface AxisCutSetting {
  /** Master toggle for this axis cut. */
  active: boolean;
  /** World plan position of the cut plane (scene/canvas units; see interface doc). */
  position: number;
  /** Viewing direction: +1 keeps the near (−axis) side, −1 keeps the far (+axis) side. */
  sign: 1 | -1;
}

/** ADR-455 — default axis cut: off, at origin, near-side. */
export const DEFAULT_AXIS_CUT: AxisCutSetting = { active: false, position: 0, sign: 1 };

/** ADR-455 — the two persisted vertical-cut axes (Z is the legacy cutPlane*). */
export type AxisCutKey = 'x' | 'y';

// ── Core type ──────────────────────────────────────────────────────────────

export interface BimRenderSettings {
  /**
   * ADR-445 — persisted schema version (absent ⇒ pre-versioned, 0). Drives the
   * one-time colour-refresh migration in {@link migrateBimRenderSettings}.
   */
  settingsVersion?: number;
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
   * ADR-446 — per-view Visual Style preset (Revit «Visual Style»). The SSoT for
   * the FACES × EDGES appearance axes; resolves to `{faceMode, edgeMode}` via
   * {@link resolveVisualStyleAxes}. Absent ⇒ derived from the legacy
   * {@link realisticMaterials} bit (see {@link migrateBimRenderSettings} v2), so
   * pre-ADR-446 views keep their exact look. Persisted per-view.
   */
  visualStyle?: VisualStylePreset;
  /**
   * ADR-446 §2 — visible-background mode (the «σαν 2Δ» dark view). ORTHOGONAL to
   * `visualStyle` (any preset pairs with either background). Absent ⇒ `environment`
   * (photoreal sky/HDRI, the pre-§2 look). `dark` ⇒ flat 2D-canvas background +
   * 2D per-category edge colours. Persisted per-view.
   */
  backgroundMode?: BackgroundMode;
  /**
   * ADR-413 — LEGACY realistic-materials bit. Superseded by {@link visualStyle}
   * (ADR-446): `realisticMaterials === (faceMode === 'realistic')`. Retained ONLY
   * to migrate pre-ADR-446 persisted docs; new writes go through `visualStyle`.
   * @deprecated Use {@link visualStyle}.
   */
  realisticMaterials?: boolean;
  /**
   * ADR-422 L1 — analytical heat-load overlay master toggle (Revit "Heating
   * Loads" view). Absent ⇒ `false` (opt-in: the analytical heat-map is off by
   * default so it does not clutter the normal drawing). `true` ⇒ each thermal
   * space is painted with a cold→hot heat-map + Φ (W) / W/m² label. Per-view.
   */
  showHeatLoad?: boolean;
  /**
   * ADR-470 — master view toggle «Σώμα σκυροδέματος» (structural concrete core).
   * Absent ⇒ `true` (ON by default: ο στατικός πυρήνας προβάλλεται κανονικά).
   * `false` ⇒ το σώμα κρύβεται σε 2D + 3D ώστε να φαίνεται μόνο ο σοβάς ή/και ο
   * οπλισμός (Revit «Parts»). Per-view· per-element override μέσω
   * `BimElementStyleOverride.componentVisibility.core`.
   */
  showStructuralCore?: boolean;
  /**
   * ADR-449 Slice 5 — master view toggle «Σοβατισμένη όψη» (structural finish
   * skin). Absent ⇒ `true` (ON by default: ο σοβάς προβάλλεται κανονικά, όπως τα
   * Revit finishes). `false` ⇒ ο σοβάς κρύβεται σε 2D + 3D (καθαρά visual· το BOQ
   * συνεχίζει να μετράει — schedule = model, όχι view). Per-view.
   */
  showFinishSkin?: boolean;
  /**
   * ADR-456 Slice 3 — master view toggle «Οπλισμός» (reinforcement rebar
   * drawing). Absent ⇒ `false` (opt-in: ο οπλισμός είναι λεπτομέρεια — δείχνεται
   * όταν ζητηθεί, ώστε η κάτοψη να μένει καθαρή). `true` ⇒ διαμήκεις ράβδες +
   * στεφάνια σε 2D κάτοψη + 3D/τομή (καθαρά visual· το schedule μετράει πάντα όταν
   * `reinforcement` οριστεί). Per-view.
   */
  showReinforcement?: boolean;
  /**
   * ADR-452 — cut-plane (Revit View Range) hide gate master toggle. Absent ⇒
   * `false` (OFF by default so existing views keep their current look — nothing is
   * hidden until the user engages the right-edge cut-plane slider). `true` ⇒ BIM
   * entities whose BASE sits above `viewRange.cutPlaneMm` are hidden in the 2D
   * plan, giving a real-time horizontal section. Per-view.
   */
  cutPlaneActive?: boolean;
  /**
   * ADR-455 — vertical section cut along world DXF X. Absent ⇒ off (legacy look).
   * When active, 3D clips the +/−X half-space (like the horizontal cut) and the 2D
   * plan ghosts the cut-away side + draws a section line. Per-view.
   */
  xAxisCut?: Partial<AxisCutSetting>;
  /** ADR-455 — vertical section cut along world DXF Y. Absent ⇒ off. Per-view. */
  yAxisCut?: Partial<AxisCutSetting>;
}

export interface ResolvedBimSettings {
  drawingScale: number;
  viewRange: ViewRange;
  objectStyles: Record<BimCategory, ObjectStyle>;
  disciplineVisibility: Partial<Record<Discipline, boolean>>;
  colorBySystem: boolean;
  /** ADR-446 — resolved Visual Style preset (the per-view SSoT). */
  visualStyle: VisualStylePreset;
  /** ADR-446 — FACES axis, derived from {@link visualStyle}. */
  faceMode: FaceMode;
  /** ADR-446 — EDGES axis, derived from {@link visualStyle}. */
  edgeMode: EdgeMode;
  /** ADR-446 §2 — resolved visible-background mode (default `environment`). */
  backgroundMode: BackgroundMode;
  /**
   * ADR-413/446 — DERIVED convenience flag `faceMode === 'realistic'`, kept so
   * existing realistic-only consumers (e.g. roof relief) need no faceMode logic.
   */
  realisticMaterials: boolean;
  showHeatLoad: boolean;
  /** ADR-470 — resolved master toggle «Σώμα σκυροδέματος» (default ON). */
  showStructuralCore: boolean;
  /** ADR-449 Slice 5 — resolved master toggle «Σοβατισμένη όψη» (default ON). */
  showFinishSkin: boolean;
  /** ADR-456 Slice 3 — resolved master toggle «Οπλισμός» (default OFF, opt-in). */
  showReinforcement: boolean;
  /** ADR-452 — resolved cut-plane hide-gate master toggle (default OFF). */
  cutPlaneActive: boolean;
  /** ADR-455 — resolved vertical X-axis section cut (default off). */
  xAxisCut: AxisCutSetting;
  /** ADR-455 — resolved vertical Y-axis section cut (default off). */
  yAxisCut: AxisCutSetting;
}

/** ADR-455 — merge a persisted partial axis cut with the default (off). */
export function resolveAxisCut(s?: Partial<AxisCutSetting> | null): AxisCutSetting {
  return {
    active: s?.active ?? DEFAULT_AXIS_CUT.active,
    position: s?.position ?? DEFAULT_AXIS_CUT.position,
    sign: s?.sign === -1 ? -1 : 1,
  };
}

/**
 * ADR-446 — derive the Visual Style preset from the legacy `realisticMaterials`
 * bit (pre-ADR-446 docs / fallback). A pre-ADR-446 doc that explicitly carried
 * `realisticMaterials:true` (the old textured ON look) keeps `realistic-edges`;
 * everything else (absent bit ⇒ brand-new view, or explicit `false`) falls back to
 * {@link DEFAULT_VISUAL_STYLE} = `shaded-edges`. Edges are included because
 * pre-ADR-446 always built the model edge overlay (ADR-375).
 */
export function deriveVisualStyleFromLegacy(realisticMaterials?: boolean): VisualStylePreset {
  return realisticMaterials === true ? 'realistic-edges' : DEFAULT_VISUAL_STYLE;
}

// ── Resolver ───────────────────────────────────────────────────────────────

/** Merge user overrides with defaults — always returns a fully-resolved object. */
export function resolveBimSettings(s?: BimRenderSettings | null): ResolvedBimSettings {
  const rawScale = s?.drawingScale ?? DEFAULT_DRAWING_SCALE;
  // ADR-446 — absent visualStyle ⇒ derive from the legacy realisticMaterials bit
  // (robust even on un-migrated raw docs). Axes drive the FACES/EDGES pipelines.
  const visualStyle = s?.visualStyle ?? deriveVisualStyleFromLegacy(s?.realisticMaterials);
  const axes = resolveVisualStyleAxes(visualStyle);
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
    // ADR-446 — Visual Style axes (the per-view appearance SSoT).
    visualStyle,
    faceMode: axes.faceMode,
    edgeMode: axes.edgeMode,
    // ADR-446 §2 — absent ⇒ environment (photoreal sky/HDRI, the pre-§2 look).
    backgroundMode: s?.backgroundMode ?? DEFAULT_BACKGROUND_MODE,
    // ADR-413/446 — DERIVED from the face mode (no longer a free-standing bit).
    realisticMaterials: axes.faceMode === 'realistic',
    // ADR-422 L1 — absent ⇒ false (analytical heat-load overlay off by default).
    showHeatLoad: s?.showHeatLoad ?? false,
    // ADR-470 — absent ⇒ true (στατικός πυρήνας ορατός by default).
    showStructuralCore: s?.showStructuralCore ?? true,
    // ADR-449 Slice 5 — absent ⇒ true (σοβάς ορατός by default, όπως Revit finishes).
    showFinishSkin: s?.showFinishSkin ?? true,
    // ADR-456 Slice 3 — absent ⇒ false (ο οπλισμός είναι opt-in λεπτομέρεια).
    showReinforcement: s?.showReinforcement ?? false,
    // ADR-452 — absent ⇒ false (cut-plane hide gate off by default; opt-in slider).
    cutPlaneActive: s?.cutPlaneActive ?? false,
    // ADR-455 — absent ⇒ off (vertical X/Y section cuts are opt-in sliders).
    xAxisCut: resolveAxisCut(s?.xAxisCut),
    yAxisCut: resolveAxisCut(s?.yAxisCut),
  };
}

// ── ADR-445 colour-refresh migration ─────────────────────────────────────────

/**
 * Set `obj[key]` to the current default colour, or delete it when the default has
 * none (so the resolver falls back to the canvas token). Mutates `obj`.
 */
function refreshColor(
  obj: { projectionColor?: string | null; cutColor?: string | null },
  key: 'projectionColor' | 'cutColor',
  defColor: string | null | undefined,
): void {
  if (typeof defColor === 'string') obj[key] = defColor;
  else delete obj[key];
}

/**
 * Re-derive ONLY the `projectionColor`/`cutColor` (parent + subcategories) of a
 * persisted ObjectStyles map from the current `DEFAULT_OBJECT_STYLES`, preserving
 * every user-tweaked NON-colour field (pens, visibility, line patterns). Persisted
 * docs froze the FULL resolved map, so old default colours shadowed code changes;
 * this refresh heals them while keeping genuine V/G pen/visibility edits intact.
 */
function refreshObjectStyleColors(
  persisted: Partial<Record<BimCategory, ObjectStyle>>,
): Partial<Record<BimCategory, ObjectStyle>> {
  const out: Partial<Record<BimCategory, ObjectStyle>> = {};
  for (const key of Object.keys(persisted) as BimCategory[]) {
    const style = persisted[key];
    if (!style) continue;
    const def = DEFAULT_OBJECT_STYLES[key];
    const next: ObjectStyle = { ...style };
    refreshColor(next, 'projectionColor', def?.projectionColor);
    refreshColor(next, 'cutColor', def?.cutColor);
    if (next.subcategories) {
      const defSubs = def?.subcategories ?? {};
      const subsOut: Partial<Record<string, SubcategoryStyle>> = {};
      for (const subKey of Object.keys(next.subcategories)) {
        const sub = next.subcategories[subKey];
        if (!sub) continue;
        const defSub = defSubs[subKey];
        const subNext: SubcategoryStyle = { ...sub };
        refreshColor(subNext, 'projectionColor', defSub?.projectionColor);
        refreshColor(subNext, 'cutColor', defSub?.cutColor);
        subsOut[subKey] = subNext;
      }
      next.subcategories = subsOut;
    }
    out[key] = next;
  }
  return out;
}

/**
 * ADR-445 — one-time colour-refresh migration for persisted `bimRenderSettings`.
 * Returns the (possibly healed) settings + a `changed` flag the caller uses to
 * persist the result exactly once. Idempotent: a doc already at
 * {@link BIM_SETTINGS_VERSION} is returned untouched.
 */
export function migrateBimRenderSettings(
  s: BimRenderSettings | null,
): { settings: BimRenderSettings | null; changed: boolean } {
  if (!s) return { settings: s, changed: false };
  if ((s.settingsVersion ?? 0) >= BIM_SETTINGS_VERSION) return { settings: s, changed: false };
  const next: BimRenderSettings = { ...s, settingsVersion: BIM_SETTINGS_VERSION };
  // v1 — colour-refresh (idempotent: re-derives the same current defaults).
  if (s.objectStyles) next.objectStyles = refreshObjectStyleColors(s.objectStyles);
  // v2 (ADR-446) — derive the Visual Style preset from the legacy realistic bit,
  // so the view keeps its exact pre-ADR-446 look. Only when not already set.
  if (next.visualStyle === undefined) {
    next.visualStyle = deriveVisualStyleFromLegacy(s.realisticMaterials);
  }
  return { settings: next, changed: true };
}
