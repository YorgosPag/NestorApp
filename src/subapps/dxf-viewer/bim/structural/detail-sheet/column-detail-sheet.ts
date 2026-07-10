/**
 * ADR-457 — Column Reinforcement Detail Sheet · model orchestrator (SSoT).
 *
 * Builds the backend-agnostic {@link DetailSheetModel} for a column's
 * reinforcement detail from the pure rebar SSoT. ONE model → two backends
 * (Canvas preview + jsPDF export) so that **preview === PDF**.
 *
 * Slice 1-2 (current): the PLAN and ELEVATION regions are filled from
 * `column-detail-plan` / `column-detail-elevation`. Remaining regions hold
 * their heading only; subsequent slices fill them:
 *   - Slice 3 → `column-detail-3d-capture` (perspective raster)
 *   - Slice 4 → `column-detail-schedule` + `column-detail-titleblock`
 *
 * @module subapps/dxf-viewer/bim/structural/detail-sheet/column-detail-sheet
 * @see docs/centralized-systems/reference/adrs/ADR-457-column-reinforcement-detail-sheet.md
 */

import { assembleDetailSheet, standardSheetRegions } from './detail-sheet-assemble';
import type { DetailSheetLayoutInput } from './detail-sheet-layout';
import { buildColumnPlanRegion } from './column-detail-plan';
import { buildColumnElevationRegion } from './column-detail-elevation';
import { buildColumnPerspectiveRegion } from './column-detail-perspective';
import { buildColumnScheduleRegion } from './column-detail-schedule';
import { buildColumnTitleBlockRegion } from './column-detail-titleblock';
import type { ColumnDetail3dCapture } from './render/column-detail-3d-capture';
import type { ColumnParams } from '../../types/column-types';
import type {
  DetailSheetLabels,
  DetailSheetModel,
} from './detail-sheet-types';

export interface ColumnDetailSheetInput {
  /** The column whose reinforcement is detailed (geometry-is-SSoT). */
  readonly params: ColumnParams;
  /** Pre-resolved region headings (host injects via i18n — N.11-safe). */
  readonly labels: DetailSheetLabels;
  /** Layout override (paper / margin / gutter); defaults to A3 landscape. */
  readonly layoutInput?: DetailSheetLayoutInput;
  /**
   * Offscreen 3D capture (raster + projected dimension/bar-mark anchors) for the
   * perspective region. `undefined` / `null` while the async capture is pending →
   * region shows an empty raster slot (host re-builds the model once it resolves).
   */
  readonly perspective3d?: ColumnDetail3dCapture | null;
}

/**
 * Produces the detail-sheet drawing model: five laid-out regions with headings,
 * the PLAN region populated with the column footprint + reinforcement +
 * dimensions (Slice 1).
 */
export function buildColumnDetailSheet(input: ColumnDetailSheetInput): DetailSheetModel {
  const { labels } = input;
  return assembleDetailSheet(input.layoutInput, (regions) => {
    const plan = buildColumnPlanRegion(input.params, regions.plan);
    const elevation = buildColumnElevationRegion(input.params, regions.elevation);
    const perspective = buildColumnPerspectiveRegion(regions.perspective, input.perspective3d ?? null);
    const schedule = buildColumnScheduleRegion(input.params, regions.schedule, labels.scheduleTable);
    const titleBlock = buildColumnTitleBlockRegion(input.params, regions['title-block'], labels.titleFields);

    return standardSheetRegions(regions, {
      elevation: { title: labels.elevation, caption: elevation.caption, primitives: elevation.primitives },
      plan: { title: labels.plan, caption: plan.caption, primitives: plan.primitives },
      schedule, perspective, titleBlock, labels,
    });
  });
}
