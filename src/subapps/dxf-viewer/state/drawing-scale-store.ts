/**
 * ADR-375 Phase B.1 / B.2 compatibility shim.
 *
 * Phase B.1 introduced this store as standalone Zustand (in-memory).
 * Phase B.2 migrates the canonical state to `bim-render-settings-store`
 * (Firestore-persisted, per-level). This file is now a thin re-export so
 * all Phase B.1 consumers (DrawingScaleWidget, 7 BIM renderers) continue
 * to compile without changes.
 *
 * For new code use `useBimRenderSettingsStore` directly.
 */

export {
  useBimRenderSettingsStore as useDrawingScaleStore,
} from './bim-render-settings-store';

export {
  DEFAULT_DRAWING_SCALE,
  DRAWING_SCALE_MIN,
  DRAWING_SCALE_MAX,
  DRAWING_SCALE_PRESETS,
} from '../config/bim-render-settings-types';

export type { DrawingScalePreset } from '../config/bim-render-settings-types';
