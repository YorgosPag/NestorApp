/**
 * ADR-476 — Slab Reinforcement Detail Sheet · model orchestrator (SSoT).
 *
 * Builds the backend-agnostic {@link DetailSheetModel} for a slab's reinforcement
 * detail (geometry-is-SSoT). ONE model → two backends (Canvas preview + jsPDF
 * export) ώστε **preview === PDF**. Mirror του `footing-detail-sheet.ts` /
 * `beam-detail-sheet.ts` — πέντε ζώνες, **ΧΩΡΙΣ** design-summary (η πλάκα δεν έχει
 * bearing/punching checks σαν το πέδιλο):
 *   - slot 'plan'      → **ΚΑΤΟΨΗ** (`slab-detail-plan`).
 *   - slot 'elevation' → **ΤΟΜΗ** (`slab-detail-section`, αντιπροσωπευτικό 1m strip).
 *   - slot 'perspective' → 3Δ raster (`buildColumnPerspectiveRegion`, kind-neutral).
 *   - slot 'schedule'  → ποσότητες χάλυβα (`slab-detail-schedule`).
 *   - slot 'title-block' → στοιχεία σχεδίου (`slab-detail-titleblock`).
 *
 * @module subapps/dxf-viewer/bim/structural/detail-sheet/slab-detail-sheet
 * @see docs/centralized-systems/reference/adrs/ADR-476-unified-slab-reinforcement.md
 */

import {
  computeDetailSheetLayout,
  DEFAULT_DETAIL_SHEET_LAYOUT_INPUT,
  DETAIL_SHEET_PAPER,
  type DetailSheetLayoutInput,
} from './detail-sheet-layout';
import { buildSlabPlanRegion } from './slab-detail-plan';
import { buildSlabSectionRegion } from './slab-detail-section';
import { buildColumnPerspectiveRegion } from './column-detail-perspective';
import { buildSlabScheduleRegion } from './slab-detail-schedule';
import { buildSlabTitleBlockRegion } from './slab-detail-titleblock';
import type { SlabDetail3dCapture } from './render/slab-detail-3d-capture';
import type { SlabEntity } from '../../types/slab-types';
import type {
  DetailSheetModel,
  SheetRegion,
  SlabDetailSheetLabels,
} from './detail-sheet-types';

export interface SlabDetailSheetInput {
  /** The slab whose reinforcement is detailed (geometry-is-SSoT). */
  readonly slab: SlabEntity;
  /** Pre-resolved region headings + table/field labels (host injects — N.11-safe). */
  readonly labels: SlabDetailSheetLabels;
  /** Layout override (paper / margin / gutter); defaults to A3 landscape. */
  readonly layoutInput?: DetailSheetLayoutInput;
  /** Offscreen 3D capture for the perspective region; `null` while pending. */
  readonly perspective3d?: SlabDetail3dCapture | null;
}

/**
 * Produces the slab detail-sheet drawing model: five laid-out regions with
 * headings, populated from the per-region builders (geometry-is-SSoT). The
 * title-block kind value is looked up by the slab's own kind from the
 * host-injected `kindValues` map (5 kinds: floor/ceiling/roof/ground/foundation).
 */
export function buildSlabDetailSheet(input: SlabDetailSheetInput): DetailSheetModel {
  const layoutInput = input.layoutInput ?? DEFAULT_DETAIL_SHEET_LAYOUT_INPUT;
  const layout = computeDetailSheetLayout(layoutInput);
  const { regions } = layout;
  const { labels, slab } = input;

  const plan = buildSlabPlanRegion(slab, regions.plan);
  const section = buildSlabSectionRegion(slab, regions.elevation);
  const perspective = buildColumnPerspectiveRegion(regions.perspective, input.perspective3d ?? null);
  const schedule = buildSlabScheduleRegion(slab, regions.schedule, labels.scheduleTable);
  const titleBlock = buildSlabTitleBlockRegion(
    slab, regions['title-block'], labels.titleFields, labels.kindValues[slab.kind],
  );

  const sheetRegions: readonly SheetRegion[] = [
    { id: 'elevation', rectMm: regions.elevation, title: labels.section, caption: section.caption, primitives: section.primitives },
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
