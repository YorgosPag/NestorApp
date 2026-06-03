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
  resolveBimSettings,
  type BimRenderSettings,
  type ResolvedBimSettings,
} from '../config/bim-render-settings-types';
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
import { type LinePatternKey } from '../config/bim-line-patterns';
import { saveBimRenderSettings } from '../services/bim-render-settings.service';

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

// ── State shape ────────────────────────────────────────────────────────────

interface BimRenderSettingsState extends ResolvedBimSettings {
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

  // ── Actions ─────────────────────────────────────────────────────────────
  /** Called when active level changes — syncs store from Level.bimRenderSettings. */
  loadForLevel: (levelId: string, settings?: BimRenderSettings | null) => void;

  /** Update drawingScale — persisted after 500 ms idle. */
  setDrawingScale: (scale: number) => void;
  resetDrawingScale: () => void;

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

// ── Store ──────────────────────────────────────────────────────────────────

export const useBimRenderSettingsStore = create<BimRenderSettingsState>((set, get) => {
  const defaultResolved = resolveBimSettings(null);

  function buildRaw(state: BimRenderSettingsState): BimRenderSettings {
    return {
      drawingScale: state.drawingScale,
      viewRange: state.viewRange,
      objectStyles: state.objectStyles,
      disciplineVisibility: state.disciplineVisibility,
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
      const resolved = resolveBimSettings(settings ?? null);
      set({
        currentLevelId: levelId,
        rawSettings: settings ?? null,
        drawingScale: resolved.drawingScale,
        viewRange: resolved.viewRange,
        objectStyles: resolved.objectStyles,
        disciplineVisibility: resolved.disciplineVisibility,
        lastLocalMutationAt: 0,
        bimVisibilitySnapshot: null,
      });
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
      drawingScale: get().drawingScale,
      viewRange: get().viewRange,
      objectStyles: nextStyles,
      disciplineVisibility: get().disciplineVisibility,
    });
  }
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
