/**
 * ADR-583 Φ2.2 — Scale-bar tool options store (ribbon ⇄ placement).
 *
 * Holds the construction options the active `'scale-bar'` placement tool passes to
 * `buildScaleBarEntity` on the 2nd click: `unit` / `divisions` / `subdivisions` /
 * `style` / `barHeightMm` / `labelHeightMm`. The ribbon contextual tab (future
 * follow-up) writes it; `createEntityFromTool` reads the live snapshot at
 * completion time (`getState()` — no subscription, ADR-040 event-time read
 * pattern), exactly like `annotation-symbol-selection-store`.
 *
 * Flat (no kind-awareness): unlike the annotation-symbol family, there is only
 * ONE scale-bar tool, so there is no per-kind slice to juggle.
 *
 * @see bim/scale-bar/build-scale-bar-entity.ts — the consumer (`BuildScaleBarOptions`)
 * @see state/annotation-symbol-selection-store.ts — the sibling pattern this mirrors
 * @see docs/centralized-systems/reference/adrs/ADR-583-annotation-symbol-library-north-arrow.md
 */

import { create } from 'zustand';
import type { ScaleBarStyle, ScaleBarLabelPlacement, ScaleBarEntity } from '../types/scale-bar';
import {
  DEFAULT_SCALE_BAR_DIVISIONS,
  DEFAULT_SCALE_BAR_SUBDIVISIONS,
  DEFAULT_SCALE_BAR_HEIGHT_MM,
  DEFAULT_SCALE_BAR_LABEL_MM,
  DEFAULT_SCALE_BAR_UNIT,
  DEFAULT_SCALE_BAR_STYLE,
  DEFAULT_SCALE_BAR_LABEL_PLACEMENT,
} from '../types/scale-bar';
import type { SceneUnits } from '../utils/scene-units';
import type { Point2D } from '../rendering/types/Types';
import { buildScaleBarEntity } from '../bim/scale-bar/build-scale-bar-entity';

interface ScaleBarOptionsState {
  readonly unit: SceneUnits;
  readonly divisions: number;
  readonly subdivisions: number;
  readonly style: ScaleBarStyle;
  readonly barHeightMm: number;
  readonly labelHeightMm: number;
  /** ADR-583 Φ3e — numeral side default (ribbon contextual tab, dual-mode). */
  readonly labelPlacement: ScaleBarLabelPlacement;
  setUnit(unit: SceneUnits): void;
  setDivisions(divisions: number): void;
  setSubdivisions(subdivisions: number): void;
  setStyle(style: ScaleBarStyle): void;
  setBarHeightMm(barHeightMm: number): void;
  setLabelHeightMm(labelHeightMm: number): void;
  setLabelPlacement(labelPlacement: ScaleBarLabelPlacement): void;
}

export const useScaleBarOptionsStore = create<ScaleBarOptionsState>((set) => ({
  unit: DEFAULT_SCALE_BAR_UNIT,
  divisions: DEFAULT_SCALE_BAR_DIVISIONS,
  subdivisions: DEFAULT_SCALE_BAR_SUBDIVISIONS,
  style: DEFAULT_SCALE_BAR_STYLE,
  barHeightMm: DEFAULT_SCALE_BAR_HEIGHT_MM,
  labelHeightMm: DEFAULT_SCALE_BAR_LABEL_MM,
  labelPlacement: DEFAULT_SCALE_BAR_LABEL_PLACEMENT,
  setUnit: (unit) => set({ unit }),
  setDivisions: (divisions) => set({ divisions }),
  setSubdivisions: (subdivisions) => set({ subdivisions }),
  setStyle: (style) => set({ style }),
  setBarHeightMm: (barHeightMm) => set({ barHeightMm }),
  setLabelHeightMm: (labelHeightMm) => set({ labelHeightMm }),
  setLabelPlacement: (labelPlacement) => set({ labelPlacement }),
}));

/**
 * ADR-583 Φ2.3 — SSoT for "live options store → `BuildScaleBarOptions`" mapping.
 * Builds a `ScaleBarEntity` from two points + the LIVE store snapshot (event-time
 * `getState()` read, ADR-040 pattern — zero React subscription). Consumed by BOTH
 * the commit-time builder (`drawing-entity-builders.ts`, case `'scale-bar'`) and
 * the WYSIWYG rubber-band ghost (`drawing-preview-generator.ts`) so the two paths
 * can never drift apart (N.18 — one mapping, not two clones).
 */
export function buildScaleBarEntityFromLiveOptions(
  p0: Point2D,
  p1: Point2D,
  id: string,
  layerId: string,
): ScaleBarEntity {
  const opts = useScaleBarOptionsStore.getState();
  return buildScaleBarEntity(p0, p1, {
    id,
    layerId,
    unit: opts.unit,
    divisions: opts.divisions,
    subdivisions: opts.subdivisions,
    style: opts.style,
    barHeightMm: opts.barHeightMm,
    labelHeightMm: opts.labelHeightMm,
    labelPlacement: opts.labelPlacement,
  });
}
