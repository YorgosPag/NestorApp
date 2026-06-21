/**
 * @module foundation-preview-helpers
 * @description Pure helper for foundation line-tool (strip / tie-beam) real-time
 * preview rendering. Mirror of `beam-preview-helpers.ts` (ADR-363 Phase 5.5P) —
 * line-based 2-click placement (no 3-click curve branch).
 *
 * Exported: generateFoundationPreview()
 *
 * WYSIWYG placement (2026-06-11): the rubber-band returns a FULL
 * `FoundationEntity` (via the SSoT `buildFoundationEntity` — same builder as
 * commit) flagged `wysiwygPreview`, so PreviewCanvas renders it through the real
 * `FoundationRenderer` (kind fill / RC hatch / dashed hidden-line / centerline)
 * instead of a green band outline. The ghost IS the final foundation.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-436-bim-foundation-discipline.md §4
 */

import type { Point2D } from '../../rendering/types/Types';
import type { ExtendedSceneEntity, PreviewPoint } from './drawing-types';
import type { Point3D } from '../../bim/types/bim-base';
import { foundationPreviewStore } from '../../bim/foundations/foundation-preview-store';
import { buildDefaultFoundationParams, buildFoundationEntity, type FoundationParamOverrides, type SceneUnits } from './foundation-completion';
import type { FoundationKind } from '../../bim/types/foundation-types';
import { toWysiwygPreviewEntity } from './wysiwyg-preview-shared';
import { DXF_DEFAULT_LAYER } from '../../config/layer-config';
import { getLayer } from '../../stores/LayerStore';

const defaultLayerId = (): string => getLayer(DXF_DEFAULT_LAYER)?.id ?? '';

/**
 * Build a foundation line preview entity from `tempPoints` + cursor. State map:
 *   - [] (awaitingStart) → cursor start marker
 *   - [start] → full FoundationEntity band ghost start→cursor (WYSIWYG)
 *
 * Returns a full `FoundationEntity` (WYSIWYG) so the placement preview is
 * identical to the committed band. `null` on a degenerate/invalid frame.
 */
export function generateFoundationPreview(
  tempPoints: readonly Point2D[],
  cursorPoint: Point2D,
  sceneUnits: SceneUnits = 'mm',
): ExtendedSceneEntity | null {
  if (tempPoints.length === 0) {
    return {
      id: 'preview_foundation_startmarker',
      type: 'point',
      position: cursorPoint,
      size: 6,
      visible: true,
      layerId: defaultLayerId(),
      preview: true,
      showPreviewGrips: true,
    } as PreviewPoint;
  }

  const preview = foundationPreviewStore.get();
  const startPt = tempPoints[0];
  return makeFoundationBandGhost('preview_foundation_band', startPt, cursorPoint, preview.kind, preview.overrides, sceneUnits);
}

function makeFoundationBandGhost(
  id: string,
  startPt: Readonly<Point2D>,
  endPt: Readonly<Point2D>,
  kind: FoundationKind,
  overrides: FoundationParamOverrides,
  sceneUnits: SceneUnits,
): ExtendedSceneEntity | null {
  const axisEnd: Point3D = { x: endPt.x, y: endPt.y, z: 0 };
  const params = buildDefaultFoundationParams(startPt, kind, { ...overrides, kind, axisEnd }, sceneUnits);
  const built = buildFoundationEntity(params, defaultLayerId());
  if (!built.ok) return null;
  return toWysiwygPreviewEntity(built.entity, id);
}
