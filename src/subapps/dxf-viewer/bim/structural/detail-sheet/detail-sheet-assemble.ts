/**
 * detail-sheet-assemble — SSoT envelope for the structural detail-sheet model
 * orchestrators (ADR-457/463/471/476).
 *
 * ADR-622 — every `build*DetailSheet` repeated the SAME preamble (resolve the
 * layout input → default A3 landscape, `computeDetailSheetLayout`, destructure the
 * region rects) and the SAME return envelope (paper + sheet size + regions),
 * differing ONLY in which regions they populate. This module owns both; each
 * orchestrator now supplies a `buildRegions` callback that fills the laid-out
 * region rects. All `build*DetailSheet` signatures + the `DetailSheetModel` shape
 * are preserved.
 */

import {
  computeDetailSheetLayout,
  DEFAULT_DETAIL_SHEET_LAYOUT_INPUT,
  DETAIL_SHEET_PAPER,
  type DetailSheetLayoutInput,
  type DetailSheetRegionRects,
} from './detail-sheet-layout';
import type { DetailPrimitive, DetailSheetModel, SheetRegion } from './detail-sheet-types';

/** Fills the laid-out region rects with their per-member headings + primitives. */
export type BuildSheetRegions = (regions: DetailSheetRegionRects) => readonly SheetRegion[];

/** A captioned region (elevation / plan) — heading + optional caption + primitives. */
export interface RegionContent {
  readonly title: string;
  readonly caption?: string;
  readonly primitives: readonly DetailPrimitive[];
}

/** Minimal shape of a region builder result — every `build*Region` returns this. */
interface RegionPrimitives {
  readonly primitives: readonly DetailPrimitive[];
}

/**
 * ADR-622 — the canonical 5-region layout every structural detail sheet emits, in
 * order: elevation, plan, schedule, perspective, title-block. Only elevation/plan
 * carry a caption + a per-member title, so they are passed as {@link RegionContent};
 * the caption-less schedule / perspective / title-block regions are titled from the
 * shared `labels` and drawn straight from their builder result. The region ids +
 * rects are fixed here so the assembly is not re-hand-rolled per member.
 */
export function standardSheetRegions(
  regions: DetailSheetRegionRects,
  content: {
    readonly elevation: RegionContent;
    readonly plan: RegionContent;
    readonly schedule: RegionPrimitives;
    readonly perspective: RegionPrimitives;
    readonly titleBlock: RegionPrimitives;
    readonly labels: { readonly schedule: string; readonly perspective: string; readonly titleBlock: string };
  },
): readonly SheetRegion[] {
  const { labels } = content;
  return [
    { id: 'elevation', rectMm: regions.elevation, title: content.elevation.title, caption: content.elevation.caption, primitives: content.elevation.primitives },
    { id: 'plan', rectMm: regions.plan, title: content.plan.title, caption: content.plan.caption, primitives: content.plan.primitives },
    { id: 'schedule', rectMm: regions.schedule, title: labels.schedule, primitives: content.schedule.primitives },
    { id: 'perspective', rectMm: regions.perspective, title: labels.perspective, primitives: content.perspective.primitives },
    { id: 'title-block', rectMm: regions['title-block'], title: labels.titleBlock, primitives: content.titleBlock.primitives },
  ];
}

/**
 * Assemble a {@link DetailSheetModel}: resolve the layout (default A3 landscape),
 * let `buildRegions` populate the region rects, and wrap the result in the
 * paper / sheet-size envelope.
 */
export function assembleDetailSheet(
  layoutInput: DetailSheetLayoutInput | undefined,
  buildRegions: BuildSheetRegions,
): DetailSheetModel {
  const resolved = layoutInput ?? DEFAULT_DETAIL_SHEET_LAYOUT_INPUT;
  const layout = computeDetailSheetLayout(resolved);
  return {
    paper: resolved.paper ?? DETAIL_SHEET_PAPER,
    sheetWidthMm: layout.sheetWidthMm,
    sheetHeightMm: layout.sheetHeightMm,
    regions: buildRegions(layout.regions),
  };
}
