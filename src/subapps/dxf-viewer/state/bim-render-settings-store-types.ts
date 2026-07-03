/**
 * ADR-375 Phase B.2 — `BimRenderSettingsState` shape (Zustand store contract).
 *
 * Extracted from `bim-render-settings-store.ts` to keep that file under the
 * 500-line Google limit (N.7.1). Pure type declarations — zero runtime logic.
 *
 * @module state/bim-render-settings-store-types
 */

import type { BimRenderSettings, ResolvedBimSettings, AxisCutKey } from '../config/bim-render-settings-types';
import type { VisualStylePreset, BackgroundMode } from '../config/bim-visual-style';
import type { ViewRange } from '../config/bim-view-range';
import type { BimCategory, ObjectStyle, SubcategoryStyle } from '../config/bim-object-styles';
import type { Discipline } from '../bim/discipline/bim-discipline';
import type { LinePatternKey } from '../config/bim-line-patterns';

export interface BimRenderSettingsState extends ResolvedBimSettings {
  /** Raw overrides stored in Firestore (null = not yet loaded for current level). */
  rawSettings: BimRenderSettings | null;
  currentLevelId: string | null;
  /**
   * ADR-375 v2.11 — Epoch ms of the most recent local mutation (any V/G or
   * ObjectStyles setter). `useBimRenderSettingsSync` reads this to skip
   * `loadForLevel` reloads while a debounced Firestore write is still
   * in-flight (otherwise a stale snapshot echo would wipe local pending
   * changes). 0 = no local mutation since last `loadForLevel`.
   */
  lastLocalMutationAt: number;
  /**
   * Runtime-only (non-persisted) snapshot of structural categories' `visible`
   * flags captured the moment the "Hide BIM" isolate is engaged, so toggling
   * it off restores any manual per-category hides instead of force-showing all.
   * null = isolate not currently engaged.
   */
  bimVisibilitySnapshot: Partial<Record<BimCategory, boolean>> | null;
  /**
   * ADR-375 Phase B.4 — runtime-only flag: `true` once the user set the drawing
   * scale MANUALLY (widget input/preset) this session. The fit-to-paper auto-fit
   * (`applyAutoDrawingScale`) skips when set, so a genuine re-import never
   * overwrites a scale the user deliberately chose (Revit annotation-scale rule).
   */
  drawingScaleUserSet: boolean;

  // ── Actions ─────────────────────────────────────────────────────────────
  /** Called when active level changes — syncs store from Level.bimRenderSettings. */
  loadForLevel: (levelId: string, settings?: BimRenderSettings | null) => void;

  /** Update drawingScale MANUALLY (marks `drawingScaleUserSet`) — persisted after 500 ms idle. */
  setDrawingScale: (scale: number) => void;
  resetDrawingScale: () => void;
  /**
   * ADR-375 Phase B.4 — apply the fit-to-paper AUTO scale. No-op when the user
   * already set the scale manually, UNLESS `force` (the explicit «Fit» button).
   * Does NOT set `drawingScaleUserSet`, so auto keeps working on later re-imports.
   */
  applyAutoDrawingScale: (scale: number, opts?: { force?: boolean }) => void;

  /** Patch individual ViewRange plane values (mm) — persisted after 500 ms idle. */
  setViewRangeField: (field: keyof ViewRange, valueMm: number) => void;

  /** Patch one category's pen (projectionPen or cutPen) — persisted after 500 ms idle. */
  setObjectStyleField: (
    category: BimCategory,
    key: 'projectionPen' | 'cutPen',
    pen: number,
  ) => void;

  // ── ADR-375 Phase C.4 — Visibility/Graphics per-view setters ────────────
  /** Toggle category visibility for the current view. */
  setObjectStyleVisibility: (category: BimCategory, visible: boolean) => void;
  /**
   * Batch-toggle visibility of all structural BIM object categories (Revit
   * "Hide in View" isolate) — `false` hides every placed BIM element so only
   * the imported DXF entities remain; `true` restores prior per-category
   * visibility. Single state update + single debounced write (idempotent).
   */
  setBimObjectsVisibility: (visible: boolean) => void;
  /**
   * ADR-405 §4 — toggle visibility of an entire discipline (Revit "View
   * Discipline"). Higher tier than the per-category `setObjectStyleVisibility`;
   * composes with it via ANY-hides-wins in `resolveIsEntityVisible`. Single
   * state update + single debounced write (idempotent).
   */
  setDisciplineVisibility: (discipline: Discipline, visible: boolean) => void;
  /**
   * ADR-408 Φ7 — toggle the colour-by-system master switch (Revit "Color
   * circuits by system"). `false` ⇒ circuits/fixtures/panels/wires fall back to
   * the renderer default colour; `true` ⇒ they paint with their System's colour.
   * Single state update + single debounced write (idempotent).
   */
  setColorBySystem: (colorBySystem: boolean) => void;
  /**
   * ADR-446 — set the per-view Visual Style preset (Revit «Visual Style»). Updates
   * the resolved FACES/EDGES axes + derived `realisticMaterials`. Single state
   * update + single debounced write (idempotent).
   */
  setVisualStyle: (preset: VisualStylePreset) => void;
  /**
   * ADR-446 §2 — set the per-view visible-background mode (`environment` ↔ `dark`,
   * the «σαν 2Δ» view). Orthogonal to `setVisualStyle`. Single state update + single
   * debounced write (idempotent).
   */
  setBackgroundMode: (mode: BackgroundMode) => void;
  /**
   * ADR-413/446 — LEGACY alias: maps the realistic boolean onto the equivalent
   * Visual Style preset (`true`→'realistic-edges', `false`→'shaded-edges'). Kept
   * for back-compat callers; new UI uses {@link setVisualStyle}.
   * @deprecated Use {@link setVisualStyle}.
   */
  setRealisticMaterials: (realisticMaterials: boolean) => void;
  /**
   * ADR-422 L1 — toggle the analytical heat-load overlay (Revit "Heating
   * Loads" view). `true` ⇒ thermal spaces paint with a cold→hot heat-map + Φ
   * (W) / W/m² labels; `false` ⇒ normal drawing. Single state update + single
   * debounced write (idempotent).
   */
  setShowHeatLoad: (showHeatLoad: boolean) => void;
  /**
   * ADR-470 — master view toggle «Σώμα σκυροδέματος» (structural concrete core
   * visibility). Per-view, debounced write (idempotent).
   */
  setShowStructuralCore: (showStructuralCore: boolean) => void;
  /**
   * ADR-449 Slice 5 — master view toggle «Σοβατισμένη όψη» (structural finish
   * skin visibility). Per-view, debounced write (idempotent).
   */
  setShowFinishSkin: (showFinishSkin: boolean) => void;
  /**
   * ADR-456 Slice 3 — master view toggle «Οπλισμός» (reinforcement rebar
   * drawing visibility). Per-view, debounced write (idempotent).
   */
  setShowReinforcement: (showReinforcement: boolean) => void;
  /**
   * ADR-452 — master toggle for the cut-plane (Revit View Range) hide gate. `true`
   * ⇒ the 2D plan hides BIM entities whose base sits above `viewRange.cutPlaneMm`
   * (real-time horizontal section); `false` ⇒ nothing is hidden (legacy look).
   * Per-view, debounced write (idempotent).
   */
  setCutPlaneActive: (cutPlaneActive: boolean) => void;
  /**
   * ADR-455 — toggle a vertical section cut (world DXF X or Y). `active` ⇒ 3D clips
   * the cut-away half-space + 2D ghosts it; `false` ⇒ legacy look. Idempotent, debounced.
   */
  setAxisCutActive: (axis: AxisCutKey, active: boolean) => void;
  /** ADR-455 — move a vertical section cut to a world plan position (scene units). Debounced. */
  setAxisCutPosition: (axis: AxisCutKey, position: number) => void;
  /** ADR-455 — flip a vertical section cut's viewing side (+1/−1). Idempotent, debounced. */
  setAxisCutSign: (axis: AxisCutKey, sign: 1 | -1) => void;
  /** Override projection or cut color for a category (null = canvas token). */
  setObjectStyleVgColor: (
    category: BimCategory,
    key: 'projectionColor' | 'cutColor',
    color: string | null,
  ) => void;
  /** Override projection or cut line pattern for a category. */
  setObjectStyleVgPattern: (
    category: BimCategory,
    key: 'projectionPattern' | 'cutPattern',
    pattern: LinePatternKey,
  ) => void;
  // ────────────────────────────────────────────────────────────────────────

  // ── ADR-377 Phase D — per-subcategory style setters ─────────────────────
  /**
   * Set ONE field of `objectStyles[category].subcategories[subcategoryKey]`
   * (Revit Object Styles per-subcategory override). Missing fields fall back
   * to the parent ObjectStyle at render time. Persisted after 500 ms idle.
   */
  setSubcategoryStyleField: <K extends keyof SubcategoryStyle>(
    category: BimCategory,
    subcategoryKey: string,
    field: K,
    value: SubcategoryStyle[K],
  ) => void;
  /** Per-row [×] — remove all overrides for one subcategory (revert to parent). */
  clearSubcategoryStyle: (category: BimCategory, subcategoryKey: string) => void;
  /** Per-category Reset — restore that category's subcategories to defaults. */
  resetCategorySubcategories: (category: BimCategory) => void;
  /** Global Reset All — restore EVERY category's subcategories to defaults. */
  resetAllSubcategories: () => void;
  // ────────────────────────────────────────────────────────────────────────

  /** Reset all settings to defaults for the current level — persisted immediately. */
  resetToDefaults: () => void;
}
