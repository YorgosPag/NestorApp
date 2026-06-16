/**
 * ADR-463 — Footing Reinforcement Detail Sheet · model orchestrator (SSoT).
 *
 * Builds the backend-agnostic {@link DetailSheetModel} for a footing's
 * reinforcement detail (πέδιλο / πεδιλοδοκός / συνδετήρια δοκός). ONE model → two
 * backends (Canvas preview + jsPDF export) ώστε **preview === PDF**. Mirror του
 * `column-detail-sheet.ts`:
 *   - PLAN      → `footing-detail-plan`     (κάτοψη σχάρας/ράβδων)
 *   - SECTION   → `footing-detail-elevation`(εγκάρσια διατομή width×thickness)
 *   - 3D        → `footing-detail-3d-capture` (offscreen WebGL raster)
 *   - SCHEDULE  → `footing-detail-schedule`  (ποσότητες χάλυβα)
 *   - TITLEBLOCK→ `footing-detail-titleblock`(στοιχεία σχεδίου)
 *
 * Η perspective ζώνη χρησιμοποιεί τον γενικό `buildColumnPerspectiveRegion` (ο
 * builder είναι kind-neutral — raster + projected `dim`/`text` primitives· N.0.2).
 *
 * @module subapps/dxf-viewer/bim/structural/detail-sheet/footing-detail-sheet
 * @see docs/centralized-systems/reference/adrs/ADR-463-foundation-reinforcement-ux.md
 */

import {
  computeDetailSheetLayout,
  DEFAULT_DETAIL_SHEET_LAYOUT_INPUT,
  DETAIL_SHEET_PAPER,
  type DetailSheetLayoutInput,
} from './detail-sheet-layout';
import { buildFootingPlanRegion } from './footing-detail-plan';
import { buildFootingElevationRegion } from './footing-detail-elevation';
import { buildColumnPerspectiveRegion } from './column-detail-perspective';
import { buildFootingScheduleRegion } from './footing-detail-schedule';
import { buildFootingTitleBlockRegion } from './footing-detail-titleblock';
import type { FootingDetail3dCapture } from './render/footing-detail-3d-capture';
import type { FoundationEntity } from '../../types/foundation-types';
import type {
  DetailSheetModel,
  FootingDetailSheetLabels,
  SheetRegion,
} from './detail-sheet-types';

export interface FootingDetailSheetInput {
  /** The footing whose reinforcement is detailed (geometry-is-SSoT). */
  readonly foundation: FoundationEntity;
  /** Pre-resolved region headings + table/field labels (host injects — N.11-safe). */
  readonly labels: FootingDetailSheetLabels;
  /** Layout override (paper / margin / gutter); defaults to A3 landscape. */
  readonly layoutInput?: DetailSheetLayoutInput;
  /** Offscreen 3D capture for the perspective region; `null` while pending. */
  readonly perspective3d?: FootingDetail3dCapture | null;
}

/**
 * Produces the footing detail-sheet drawing model: five laid-out regions with
 * headings, populated from the per-region builders (geometry-is-SSoT).
 */
export function buildFootingDetailSheet(input: FootingDetailSheetInput): DetailSheetModel {
  const layoutInput = input.layoutInput ?? DEFAULT_DETAIL_SHEET_LAYOUT_INPUT;
  const layout = computeDetailSheetLayout(layoutInput);
  const { regions } = layout;
  const { labels, foundation } = input;

  const plan = buildFootingPlanRegion(foundation, regions.plan);
  const elevation = buildFootingElevationRegion(foundation, regions.elevation);
  const perspective = buildColumnPerspectiveRegion(regions.perspective, input.perspective3d ?? null);
  const schedule = buildFootingScheduleRegion(foundation, regions.schedule, labels.scheduleTable);
  const titleBlock = buildFootingTitleBlockRegion(
    foundation, regions['title-block'], labels.titleFields, labels.kindValues[foundation.kind],
  );

  const sheetRegions: readonly SheetRegion[] = [
    { id: 'elevation', rectMm: regions.elevation, title: labels.elevation, caption: elevation.caption, primitives: elevation.primitives },
    { id: 'plan', rectMm: regions.plan, title: labels.plan, caption: plan.caption, primitives: plan.primitives },
    { id: 'schedule', rectMm: regions.schedule, title: labels.schedule, primitives: schedule.primitives },
    { id: 'perspective', rectMm: regions.perspective, title: labels.perspective, primitives: perspective.primitives },
    { id: 'title-block', rectMm: regions['title-block'], title: labels.titleBlock, primitives: titleBlock.primitives },
  ];

  return {
    paper: layoutInput.paper ?? DETAIL_SHEET_PAPER,
    sheetWidthMm: layout.sheetWidthMm,
    sheetHeightMm: layout.sheetHeightMm,
    regions: sheetRegions,
  };
}
