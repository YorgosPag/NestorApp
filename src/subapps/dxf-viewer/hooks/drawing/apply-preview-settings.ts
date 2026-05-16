/**
 * @module apply-preview-settings
 * @description Pure helper that projects ColorPalettePanel preview settings
 * onto a drawing-tool entity object.
 *
 * ADR-358 §G7 Phase 6.5 — sentinel-aware branching:
 *   - `colorMode === 'ByLayer'` → write `entity.colorMode = 'ByLayer'`, skip
 *     `entity.color`. Renderer cascades via `resolveStyleForRender()` → layer.
 *   - `colorMode === 'Concrete'` (or undefined for legacy callers) → flatten
 *     `entity.color = preview.color` as before.
 *   - `lineweightMode === 'ByLayer'` → write `entity.lineweightMm = -2` (DXF
 *     group 370 BYLAYER sentinel), skip `entity.lineweight`.
 *   - `lineweightMode === 'Concrete'` → flatten `entity.lineweight = preview.lineWidth`.
 *
 * Extracted from `useUnifiedDrawing.tsx` so the projection logic stays
 * unit-testable without spinning up the React state machine.
 */

import type { LineSettings } from '../../settings-core/types';

export type PreviewSettingsTarget = Record<string, unknown>;

/**
 * Mutates the provided entity object with the projection of the preview
 * settings, honouring the Phase 6.5 ByLayer / Concrete contract.
 */
export function applyPreviewSettingsToEntity(
  entity: PreviewSettingsTarget,
  preview: LineSettings | null | undefined,
): void {
  if (!preview) return;

  const colorMode = preview.colorMode ?? 'ByLayer';
  const lineweightMode = preview.lineweightMode ?? 'ByLayer';

  if (colorMode === 'ByLayer') {
    entity.colorMode = 'ByLayer';
    // Intentionally skip `entity.color` — layer cascade wins.
  } else {
    entity.colorMode = 'Concrete';
    entity.color = preview.color;
  }

  if (lineweightMode === 'ByLayer') {
    entity.lineweightMm = -2; // BYLAYER sentinel (DXF group 370)
    // Intentionally skip `entity.lineweight` — layer cascade wins.
  } else {
    entity.lineweight = preview.lineWidth;
  }

  entity.opacity = preview.opacity;
  entity.lineType = preview.lineType;
  entity.dashScale = preview.dashScale;
  entity.lineCap = preview.lineCap;
  entity.lineJoin = preview.lineJoin;
  entity.dashOffset = preview.dashOffset;
  entity.breakAtCenter = preview.breakAtCenter;
}
