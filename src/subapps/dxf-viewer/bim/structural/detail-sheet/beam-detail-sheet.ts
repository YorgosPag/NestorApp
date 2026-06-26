/**
 * ADR-471 — Beam Reinforcement Detail Sheet · model orchestrator (SSoT).
 *
 * Builds the backend-agnostic {@link DetailSheetModel} for a beam's reinforcement
 * detail (geometry-is-SSoT). ONE model → two backends (Canvas preview + jsPDF
 * export) ώστε **preview === PDF**. Mirror του `column-detail-sheet.ts` /
 * `footing-detail-sheet.ts`, με τις δύο σχεδιαστικές ζώνες αξιοποιημένες ως:
 *   - slot 'elevation' → **ΟΨΗ** (longitudinal) `beam-detail-elevation` — η κύρια όψη.
 *   - slot 'plan'      → **ΔΙΑΤΟΜΗ** (cross-section) `beam-detail-section`.
 *   - slot 'perspective' → 3Δ raster (`buildColumnPerspectiveRegion`, kind-neutral).
 *   - slot 'schedule'  → ποσότητες χάλυβα (`beam-detail-schedule`).
 *   - slot 'title-block' → στοιχεία σχεδίου (`beam-detail-titleblock`).
 *
 * Η απόφαση να ΜΗΝ σχεδιάζεται top-plan (η κάτοψη δοκού δείχνει μόνο τις άνω ράβδους
 * — μηδενική πληροφορία) είναι Revit-grade: όψη + διατομή είναι οι δύο χρήσιμες
 * ορθογραφικές προβολές δοκού. Πολλαπλές διατομές (στήριξη/μέσον) = DEFER.
 *
 * @module subapps/dxf-viewer/bim/structural/detail-sheet/beam-detail-sheet
 * @see docs/centralized-systems/reference/adrs/ADR-471-unified-member-reinforcement.md §2-3
 */

import {
  computeDetailSheetLayout,
  DEFAULT_DETAIL_SHEET_LAYOUT_INPUT,
  DETAIL_SHEET_PAPER,
  type DetailSheetLayoutInput,
} from './detail-sheet-layout';
import { buildBeamSectionRegion } from './beam-detail-section';
import { buildBeamElevationRegion } from './beam-detail-elevation';
import { buildColumnPerspectiveRegion } from './column-detail-perspective';
import { buildBeamScheduleRegion } from './beam-detail-schedule';
import { buildBeamTitleBlockRegion } from './beam-detail-titleblock';
import type { BeamDetail3dCapture } from './render/beam-detail-3d-capture';
import type { BeamEntity, BeamSupportType } from '../../types/beam-types';
import type { BeamReinforcement } from '../reinforcement/beam-reinforcement-types';
import type {
  BeamDetailSheetLabels,
  DetailSheetModel,
  SheetRegion,
} from './detail-sheet-types';

export interface BeamDetailSheetInput {
  /** The beam whose reinforcement is detailed (geometry-is-SSoT). */
  readonly beam: BeamEntity;
  /**
   * The **active** reinforcement (host resolves it store-aware via
   * `resolveActiveBeamReinforcementForEntity` → PDF === live 2Δ/3Δ). `undefined`
   * → the drawing regions lay out empty (no reinforcement designed yet).
   */
  readonly reinforcement: BeamReinforcement | undefined;
  /**
   * ADR-486 — ο DERIVED topology-aware τύπος στήριξης (πρόβολος όταν 1 στήριξη). Ο host
   * τον resolve-άρει store-aware (`resolveActiveBeamSupportType`) ώστε η όψη/διατομή του
   * PDF να ταυτίζεται με το live 2Δ/3Δ. Απών → stored fallback (graphless / pre-organism).
   */
  readonly supportType?: BeamSupportType;
  /**
   * ADR-534 Φ3b — DERIVED `b_eff` (mm) όταν καλύπτουσα μονολιθική πλάκα κάνει τη δοκό
   * T-beam (host το resolve-άρει scene-aware μέσω `resolveBeamEffectiveFlangeWidthMm`).
   * Absent → καμία γραμμή «b_eff» στο title block (γυμνή ορθογώνια δοκός).
   */
  readonly effectiveFlangeWidthMm?: number;
  /** Pre-resolved region headings + table/field labels (host injects — N.11-safe). */
  readonly labels: BeamDetailSheetLabels;
  /** Layout override (paper / margin / gutter); defaults to A3 landscape. */
  readonly layoutInput?: DetailSheetLayoutInput;
  /** Offscreen 3D capture for the perspective region; `null` while pending. */
  readonly perspective3d?: BeamDetail3dCapture | null;
}

/**
 * Produces the beam detail-sheet drawing model: five laid-out regions with
 * headings, populated from the per-region builders (geometry-is-SSoT).
 */
export function buildBeamDetailSheet(input: BeamDetailSheetInput): DetailSheetModel {
  const layoutInput = input.layoutInput ?? DEFAULT_DETAIL_SHEET_LAYOUT_INPUT;
  const layout = computeDetailSheetLayout(layoutInput);
  const { regions } = layout;
  const { labels, beam, reinforcement: r, supportType } = input;

  const section = buildBeamSectionRegion(beam, r, regions.plan, supportType);
  const elevation = buildBeamElevationRegion(beam, r, regions.elevation, supportType);
  const perspective = buildColumnPerspectiveRegion(regions.perspective, input.perspective3d ?? null);
  const schedule = buildBeamScheduleRegion(beam, r, regions.schedule, labels.scheduleTable);
  const titleBlock = buildBeamTitleBlockRegion(beam, r, regions['title-block'], labels.titleFields, input.effectiveFlangeWidthMm);

  const sheetRegions: readonly SheetRegion[] = [
    { id: 'elevation', rectMm: regions.elevation, title: labels.elevation, caption: elevation.caption, primitives: elevation.primitives },
    { id: 'plan', rectMm: regions.plan, title: labels.plan, caption: section.caption, primitives: section.primitives },
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
