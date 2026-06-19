'use client';

/**
 * ADR-375 Phase B.2 — BIM Render Settings Store (Zustand, Firestore-persisted).
 *
 * SSoT for all per-view BIM render settings (Revit ViewPlan equivalent):
 *   - drawingScale   (migrated from Phase B.1 drawing-scale-store)
 *   - viewRange      (cut plane / top / bottom / view depth, mm)
 *   - objectStyles   (per-category projection/cut pen overrides)
 *
 * Persistence: `dxf_viewer_levels/{levelId}.bimRenderSettings` via
 *   `saveBimRenderSettings()` service (500 ms debounce).
 *
 * Non-React consumers (BIM renderers): use `useBimRenderSettingsStore.getState()`.
 * React consumers: use `useBimRenderSettingsStore((s) => s.<field>)`.
 *
 * Level sync: call `loadForLevel(levelId, settings)` when the active level
 *   changes (see `useBimRenderSettingsSync` hook).
 */

import { create } from 'zustand';
import {
  DEFAULT_DRAWING_SCALE,
  DRAWING_SCALE_MIN,
  DRAWING_SCALE_MAX,
  BIM_SETTINGS_VERSION,
  resolveBimSettings,
  migrateBimRenderSettings,
  type BimRenderSettings,
  type AxisCutSetting,
  type AxisCutKey,
} from '../config/bim-render-settings-types';
import { resolveVisualStyleAxes } from '../config/bim-visual-style';
import { type ViewRange } from '../config/bim-view-range';
import {
  STRUCTURAL_BIM_CATEGORIES,
  BIM_CATEGORIES,
  DEFAULT_OBJECT_STYLES,
  type BimCategory,
  type ObjectStyle,
  type SubcategoryStyle,
} from '../config/bim-object-styles';
import type { Discipline } from '../bim/discipline/bim-discipline';
import { saveBimRenderSettings } from '../services/bim-render-settings.service';
import type { BimRenderSettingsState } from './bim-render-settings-store-types';

// ── Debounce helper ────────────────────────────────────────────────────────

type Timer = ReturnType<typeof setTimeout>;
const pendingTimers: Map<string, Timer> = new Map();

function debounceWrite(levelId: string, settings: BimRenderSettings, delayMs = 500): void {
  const existing = pendingTimers.get(levelId);
  if (existing) clearTimeout(existing);
  const t = setTimeout(() => {
    pendingTimers.delete(levelId);
    saveBimRenderSettings(levelId, settings).catch(() => {
      // fire-and-forget: transient failures are non-critical
    });
  }, delayMs);
  pendingTimers.set(levelId, t);
}

// ── Store ──────────────────────────────────────────────────────────────────

export const useBimRenderSettingsStore = create<BimRenderSettingsState>((set, get) => {
  const defaultResolved = resolveBimSettings(null);

  function buildRaw(state: BimRenderSettingsState): BimRenderSettings {
    return {
      // ADR-446 — stamp the current schema version so setter writes don't drop it
      // (otherwise every load would needlessly re-run the idempotent migration).
      settingsVersion: BIM_SETTINGS_VERSION,
      drawingScale: state.drawingScale,
      viewRange: state.viewRange,
      objectStyles: state.objectStyles,
      disciplineVisibility: state.disciplineVisibility,
      colorBySystem: state.colorBySystem,
      // ADR-446 — persist the Visual Style preset (the SSoT); `realisticMaterials`
      // is derived and no longer written.
      visualStyle: state.visualStyle,
      // ADR-446 §2 — persist the visible-background mode (σαν 2Δ) per-view.
      backgroundMode: state.backgroundMode,
      showHeatLoad: state.showHeatLoad,
      // ADR-470 — persist the concrete-core toggle per-view.
      showStructuralCore: state.showStructuralCore,
      showFinishSkin: state.showFinishSkin,
      // ADR-456 Slice 3 — persist the reinforcement-drawing toggle per-view.
      showReinforcement: state.showReinforcement,
      // ADR-452 — persist the cut-plane hide-gate toggle per-view.
      cutPlaneActive: state.cutPlaneActive,
      // ADR-455 — persist the vertical X/Y section cuts per-view.
      xAxisCut: state.xAxisCut,
      yAxisCut: state.yAxisCut,
    };
  }

  function clampScale(s: number): number {
    return Math.max(DRAWING_SCALE_MIN, Math.min(DRAWING_SCALE_MAX, Math.round(s)));
  }

  return {
    // resolved (used by renderers)
    ...defaultResolved,
    rawSettings: null,
    currentLevelId: null,
    lastLocalMutationAt: 0,
    bimVisibilitySnapshot: null,

    loadForLevel(levelId, settings) {
      // ADR-445 — one-time colour-refresh migration: old levels froze the FULL
      // objectStyles map (incl. default colours), so pre-versioned snapshots
      // shadow new code defaults. Heal on load (preserving user pen/visibility)
      // and persist once so it never re-runs for this level.
      const { settings: migrated, changed } = migrateBimRenderSettings(settings ?? null);
      const resolved = resolveBimSettings(migrated);
      set({
        currentLevelId: levelId,
        rawSettings: migrated,
        drawingScale: resolved.drawingScale,
        viewRange: resolved.viewRange,
        objectStyles: resolved.objectStyles,
        disciplineVisibility: resolved.disciplineVisibility,
        colorBySystem: resolved.colorBySystem,
        visualStyle: resolved.visualStyle,
        faceMode: resolved.faceMode,
        edgeMode: resolved.edgeMode,
        backgroundMode: resolved.backgroundMode,
        realisticMaterials: resolved.realisticMaterials,
        showHeatLoad: resolved.showHeatLoad,
        showStructuralCore: resolved.showStructuralCore,
        showFinishSkin: resolved.showFinishSkin,
        showReinforcement: resolved.showReinforcement,
        cutPlaneActive: resolved.cutPlaneActive,
        xAxisCut: resolved.xAxisCut,
        yAxisCut: resolved.yAxisCut,
        lastLocalMutationAt: 0,
        bimVisibilitySnapshot: null,
      });
      if (changed && migrated && levelId) {
        saveBimRenderSettings(levelId, migrated).catch(() => {
          // fire-and-forget: the heal re-runs next load if this write fails
        });
      }
    },

    setDrawingScale(scale) {
      const clamped = clampScale(scale);
      set({ drawingScale: clamped, lastLocalMutationAt: Date.now() });
      const { currentLevelId } = get();
      if (currentLevelId) debounceWrite(currentLevelId, buildRaw({ ...get(), drawingScale: clamped }));
    },

    resetDrawingScale() {
      const { currentLevelId } = get();
      const clamped = clampScale(DEFAULT_DRAWING_SCALE);
      set({ drawingScale: clamped, lastLocalMutationAt: Date.now() });
      if (currentLevelId) debounceWrite(currentLevelId, buildRaw({ ...get(), drawingScale: clamped }));
    },

    setViewRangeField(field, valueMm) {
      const state = get();
      const next: ViewRange = { ...state.viewRange, [field]: valueMm };
      set({ viewRange: next, lastLocalMutationAt: Date.now() });
      if (state.currentLevelId)
        debounceWrite(state.currentLevelId, buildRaw({ ...get(), viewRange: next }));
    },

    setObjectStyleField(category, key, pen) {
      const state = get();
      const prev = state.objectStyles[category];
      const nextCat: ObjectStyle = { ...prev, [key]: pen };
      const nextStyles = { ...state.objectStyles, [category]: nextCat };
      set({ objectStyles: nextStyles, lastLocalMutationAt: Date.now() });
      if (state.currentLevelId)
        debounceWrite(state.currentLevelId, buildRaw({ ...get(), objectStyles: nextStyles }));
    },

    setObjectStyleVisibility(category, visible) {
      const state = get();
      const prev = state.objectStyles[category];
      const nextCat: ObjectStyle = { ...prev, visible };
      const nextStyles = { ...state.objectStyles, [category]: nextCat };
      set({ objectStyles: nextStyles, lastLocalMutationAt: Date.now() });
      if (state.currentLevelId)
        debounceWrite(state.currentLevelId, buildRaw({ ...get(), objectStyles: nextStyles }));
    },

    setBimObjectsVisibility(visible) {
      const state = get();
      const nextStyles = { ...state.objectStyles };
      let snapshot = state.bimVisibilitySnapshot;

      if (!visible) {
        // Engage isolate: snapshot prior visibility once, then hide all.
        if (snapshot === null) {
          snapshot = {};
          for (const cat of STRUCTURAL_BIM_CATEGORIES) {
            snapshot[cat] = state.objectStyles[cat].visible ?? true;
          }
        }
        for (const cat of STRUCTURAL_BIM_CATEGORIES) {
          nextStyles[cat] = { ...nextStyles[cat], visible: false };
        }
      } else {
        // Release isolate: restore snapshot (default-visible) then clear it.
        for (const cat of STRUCTURAL_BIM_CATEGORIES) {
          const restored = snapshot?.[cat] ?? true;
          nextStyles[cat] = { ...nextStyles[cat], visible: restored };
        }
        snapshot = null;
      }

      set({ objectStyles: nextStyles, bimVisibilitySnapshot: snapshot, lastLocalMutationAt: Date.now() });
      if (state.currentLevelId)
        debounceWrite(state.currentLevelId, buildRaw({ ...get(), objectStyles: nextStyles }));
    },

    setDisciplineVisibility(discipline, visible) {
      const state = get();
      const next: Partial<Record<Discipline, boolean>> = {
        ...state.disciplineVisibility,
        [discipline]: visible,
      };
      set({ disciplineVisibility: next, lastLocalMutationAt: Date.now() });
      if (state.currentLevelId)
        debounceWrite(state.currentLevelId, buildRaw({ ...get(), disciplineVisibility: next }));
    },

    setColorBySystem(colorBySystem) {
      const state = get();
      if (state.colorBySystem === colorBySystem) return; // idempotent — no-op write
      set({ colorBySystem, lastLocalMutationAt: Date.now() });
      if (state.currentLevelId)
        debounceWrite(state.currentLevelId, buildRaw({ ...get(), colorBySystem }));
    },

    setVisualStyle(preset) {
      const state = get();
      if (state.visualStyle === preset) return; // idempotent — no-op write
      const axes = resolveVisualStyleAxes(preset);
      const realisticMaterials = axes.faceMode === 'realistic';
      set({
        visualStyle: preset,
        faceMode: axes.faceMode,
        edgeMode: axes.edgeMode,
        realisticMaterials,
        lastLocalMutationAt: Date.now(),
      });
      if (state.currentLevelId)
        debounceWrite(state.currentLevelId, buildRaw(get()));
    },

    setRealisticMaterials(realisticMaterials) {
      // ADR-446 — legacy alias onto the equivalent Visual Style preset.
      get().setVisualStyle(realisticMaterials ? 'realistic-edges' : 'shaded-edges');
    },

    setBackgroundMode(backgroundMode) {
      const state = get();
      if (state.backgroundMode === backgroundMode) return; // idempotent — no-op write
      set({ backgroundMode, lastLocalMutationAt: Date.now() });
      if (state.currentLevelId)
        debounceWrite(state.currentLevelId, buildRaw({ ...get(), backgroundMode }));
    },

    setShowHeatLoad(showHeatLoad) {
      const state = get();
      if (state.showHeatLoad === showHeatLoad) return; // idempotent — no-op write
      set({ showHeatLoad, lastLocalMutationAt: Date.now() });
      if (state.currentLevelId)
        debounceWrite(state.currentLevelId, buildRaw({ ...get(), showHeatLoad }));
    },

    setShowStructuralCore(showStructuralCore) {
      const state = get();
      if (state.showStructuralCore === showStructuralCore) return; // idempotent — no-op write
      set({ showStructuralCore, lastLocalMutationAt: Date.now() });
      if (state.currentLevelId)
        debounceWrite(state.currentLevelId, buildRaw({ ...get(), showStructuralCore }));
    },

    setShowFinishSkin(showFinishSkin) {
      const state = get();
      if (state.showFinishSkin === showFinishSkin) return; // idempotent — no-op write
      set({ showFinishSkin, lastLocalMutationAt: Date.now() });
      if (state.currentLevelId)
        debounceWrite(state.currentLevelId, buildRaw({ ...get(), showFinishSkin }));
    },

    setShowReinforcement(showReinforcement) {
      const state = get();
      if (state.showReinforcement === showReinforcement) return; // idempotent — no-op write
      set({ showReinforcement, lastLocalMutationAt: Date.now() });
      if (state.currentLevelId)
        debounceWrite(state.currentLevelId, buildRaw({ ...get(), showReinforcement }));
    },

    setCutPlaneActive(cutPlaneActive) {
      const state = get();
      if (state.cutPlaneActive === cutPlaneActive) return; // idempotent — no-op write
      set({ cutPlaneActive, lastLocalMutationAt: Date.now() });
      if (state.currentLevelId)
        debounceWrite(state.currentLevelId, buildRaw({ ...get(), cutPlaneActive }));
    },

    setAxisCutActive(axis, active) {
      const prev = axis === 'x' ? get().xAxisCut : get().yAxisCut;
      if (prev.active === active) return; // idempotent — no-op write
      commitAxisCut(set, get, buildRaw, axis, { ...prev, active });
    },

    setAxisCutPosition(axis, position) {
      const prev = axis === 'x' ? get().xAxisCut : get().yAxisCut;
      if (prev.position === position) return; // idempotent — no-op write
      commitAxisCut(set, get, buildRaw, axis, { ...prev, position });
    },

    setAxisCutSign(axis, sign) {
      const prev = axis === 'x' ? get().xAxisCut : get().yAxisCut;
      if (prev.sign === sign) return; // idempotent — no-op write
      commitAxisCut(set, get, buildRaw, axis, { ...prev, sign });
    },

    setObjectStyleVgColor(category, key, color) {
      const state = get();
      const prev = state.objectStyles[category];
      const nextCat: ObjectStyle = { ...prev, [key]: color };
      const nextStyles = { ...state.objectStyles, [category]: nextCat };
      set({ objectStyles: nextStyles, lastLocalMutationAt: Date.now() });
      if (state.currentLevelId)
        debounceWrite(state.currentLevelId, buildRaw({ ...get(), objectStyles: nextStyles }));
    },

    setObjectStyleVgPattern(category, key, pattern) {
      const state = get();
      const prev = state.objectStyles[category];
      const nextCat: ObjectStyle = { ...prev, [key]: pattern };
      const nextStyles = { ...state.objectStyles, [category]: nextCat };
      set({ objectStyles: nextStyles, lastLocalMutationAt: Date.now() });
      if (state.currentLevelId)
        debounceWrite(state.currentLevelId, buildRaw({ ...get(), objectStyles: nextStyles }));
    },

    setSubcategoryStyleField(category, subcategoryKey, field, value) {
      const state = get();
      const nextStyles = withSubcategoryStyle(
        state.objectStyles,
        category,
        subcategoryKey,
        (prevSub) => ({ ...prevSub, [field]: value }),
      );
      commitObjectStyles(set, get, nextStyles);
    },

    clearSubcategoryStyle(category, subcategoryKey) {
      const state = get();
      const prev = state.objectStyles[category];
      const prevSubs = prev.subcategories ?? {};
      if (!(subcategoryKey in prevSubs)) return; // idempotent — nothing to clear
      const { [subcategoryKey]: _removed, ...rest } = prevSubs;
      const nextCat: ObjectStyle = { ...prev, subcategories: rest };
      commitObjectStyles(set, get, { ...state.objectStyles, [category]: nextCat });
    },

    resetCategorySubcategories(category) {
      const state = get();
      const nextCat = withDefaultSubcategories(state.objectStyles[category], category);
      commitObjectStyles(set, get, { ...state.objectStyles, [category]: nextCat });
    },

    resetAllSubcategories() {
      const state = get();
      const nextStyles = { ...state.objectStyles };
      for (const cat of BIM_CATEGORIES) {
        nextStyles[cat] = withDefaultSubcategories(nextStyles[cat], cat);
      }
      commitObjectStyles(set, get, nextStyles);
    },

    resetToDefaults() {
      const { currentLevelId } = get();
      const resolved = resolveBimSettings(null);
      const defaultSettings: BimRenderSettings = { drawingScale: DEFAULT_DRAWING_SCALE };
      set({ ...resolved, rawSettings: defaultSettings });
      if (currentLevelId) saveBimRenderSettings(currentLevelId, defaultSettings).catch(() => {});
    },
  };
});

// ── ADR-377 Phase D — subcategory mutation helpers (module-level, pure-ish) ──

/** Commit a new objectStyles map: single state update + single debounced write. */
function commitObjectStyles(
  set: (partial: Partial<BimRenderSettingsState>) => void,
  get: () => BimRenderSettingsState,
  nextStyles: Record<BimCategory, ObjectStyle>,
): void {
  set({ objectStyles: nextStyles, lastLocalMutationAt: Date.now() });
  const { currentLevelId } = get();
  if (currentLevelId) {
    debounceWrite(currentLevelId, {
      settingsVersion: BIM_SETTINGS_VERSION,
      drawingScale: get().drawingScale,
      viewRange: get().viewRange,
      objectStyles: nextStyles,
      disciplineVisibility: get().disciplineVisibility,
      colorBySystem: get().colorBySystem,
      visualStyle: get().visualStyle,
      showHeatLoad: get().showHeatLoad,
      showFinishSkin: get().showFinishSkin,
      cutPlaneActive: get().cutPlaneActive,
      xAxisCut: get().xAxisCut,
      yAxisCut: get().yAxisCut,
    });
  }
}

/**
 * ADR-455 — commit one vertical section cut (X or Y): single immutable state
 * update + single debounced per-level write. Mirrors the cut-plane setter flow.
 */
function commitAxisCut(
  set: (partial: Partial<BimRenderSettingsState>) => void,
  get: () => BimRenderSettingsState,
  buildRaw: (state: BimRenderSettingsState) => BimRenderSettings,
  axis: AxisCutKey,
  next: AxisCutSetting,
): void {
  const partial: Partial<BimRenderSettingsState> =
    axis === 'x' ? { xAxisCut: next } : { yAxisCut: next };
  set({ ...partial, lastLocalMutationAt: Date.now() });
  const { currentLevelId } = get();
  if (currentLevelId) debounceWrite(currentLevelId, buildRaw(get()));
}

/** Immutably transform one subcategory's style under a category. */
function withSubcategoryStyle(
  styles: Record<BimCategory, ObjectStyle>,
  category: BimCategory,
  subcategoryKey: string,
  transform: (prev: SubcategoryStyle) => SubcategoryStyle,
): Record<BimCategory, ObjectStyle> {
  const prev = styles[category];
  const prevSubs = prev.subcategories ?? {};
  const nextSub = transform(prevSubs[subcategoryKey] ?? {});
  const nextCat: ObjectStyle = {
    ...prev,
    subcategories: { ...prevSubs, [subcategoryKey]: nextSub },
  };
  return { ...styles, [category]: nextCat };
}

/**
 * Return a copy of `style` with its `subcategories` reset to the category's
 * defaults. When the category has no default subcategories the key is dropped
 * entirely (avoids persisting empty `subcategories: {}` noise + Firestore
 * undefined writes).
 */
function withDefaultSubcategories(style: ObjectStyle, category: BimCategory): ObjectStyle {
  const def = DEFAULT_OBJECT_STYLES[category].subcategories;
  const next: ObjectStyle = { ...style };
  if (!def) {
    delete next.subcategories;
    return next;
  }
  const cloned: Partial<Record<string, SubcategoryStyle>> = {};
  for (const [key, sub] of Object.entries(def)) {
    if (sub) cloned[key] = { ...sub };
  }
  if (Object.keys(cloned).length === 0) delete next.subcategories;
  else next.subcategories = cloned;
  return next;
}
