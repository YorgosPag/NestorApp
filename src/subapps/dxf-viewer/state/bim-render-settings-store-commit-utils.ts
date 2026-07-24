/**
 * ADR-375 / ADR-377 Phase D / ADR-455 — BIM Render Settings store commit helpers.
 *
 * Module-level, store-agnostic write plumbing extracted from
 * `bim-render-settings-store.ts` (file-size SSoT, N.7.1): the per-level debounced
 * Firestore write + the three "immutable state update → single debounced write"
 * commit flows the store's setters share (N.18 anti-clone). Pure functions over
 * the store's `set`/`get`; the store imports them.
 */

import {
  BIM_SETTINGS_VERSION,
  type BimRenderSettings,
  type AxisCutSetting,
  type AxisCutKey,
} from '../config/bim-render-settings-types';
import { type BimCategory, type ObjectStyle } from '../config/bim-object-styles';
import { saveBimRenderSettings } from '../services/bim-render-settings.service';
import type { BimRenderSettingsState } from './bim-render-settings-store-types';
import { DXF_TIMING } from '../config/dxf-timing';

// ── Debounce helper ────────────────────────────────────────────────────────

type Timer = ReturnType<typeof setTimeout>;
const pendingTimers: Map<string, Timer> = new Map();

export function debounceWrite(
  levelId: string,
  settings: BimRenderSettings,
  delayMs = DXF_TIMING.persist.SETTINGS,
): void {
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

// ── ADR-377 Phase D — subcategory mutation helpers (module-level, pure-ish) ──

/** Commit ONE category's object style (immutable update + debounced write) — the
 *  get→set→debounceWrite flow the per-field setters inlined identically (N.18). */
export function commitObjectStyle(
  set: (partial: Partial<BimRenderSettingsState>) => void,
  get: () => BimRenderSettingsState,
  buildRaw: (state: BimRenderSettingsState) => BimRenderSettings,
  category: BimCategory,
  nextCat: ObjectStyle,
): void {
  const state = get();
  const nextStyles = { ...state.objectStyles, [category]: nextCat };
  set({ objectStyles: nextStyles, lastLocalMutationAt: Date.now() });
  if (state.currentLevelId)
    debounceWrite(state.currentLevelId, buildRaw({ ...get(), objectStyles: nextStyles }));
}

export function commitObjectStyles(
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
export function commitAxisCut(
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
