/**
 * ADR-344 Phase 11 — Standard annotation scales catalog.
 *
 * Shared by `ViewportStore` (default scale list) and `AnnotationScaleManager`
 * (preset buttons). Single source of truth for the 10 AutoCAD-standard scales.
 */

import type { AnnotationScale } from '../../text-engine/types';

export interface StandardScalePreset {
  readonly name: string;
  readonly factor: number;
}

export const STANDARD_SCALE_PRESETS: ReadonlyArray<StandardScalePreset> = [
  { name: '1:1', factor: 1 },
  { name: '1:2', factor: 2 },
  { name: '1:5', factor: 5 },
  { name: '1:10', factor: 10 },
  { name: '1:20', factor: 20 },
  { name: '1:50', factor: 50 },
  { name: '1:100', factor: 100 },
  { name: '1:200', factor: 200 },
  { name: '1:500', factor: 500 },
  { name: '1:1000', factor: 1000 },
] as const;

/** Default paper-space text height in mm (AutoCAD convention). */
export const DEFAULT_PAPER_HEIGHT_MM = 2.5;

/** Build a default AnnotationScale list using `DEFAULT_PAPER_HEIGHT_MM`. */
export function buildDefaultScaleList(
  paperHeight: number = DEFAULT_PAPER_HEIGHT_MM,
): readonly AnnotationScale[] {
  return STANDARD_SCALE_PRESETS.map((s) => ({
    name: s.name,
    paperHeight,
    modelHeight: paperHeight * s.factor,
  }));
}
