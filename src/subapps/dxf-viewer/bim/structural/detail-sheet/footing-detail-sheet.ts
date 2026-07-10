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

import { assembleDetailSheet, standardSheetRegions } from './detail-sheet-assemble';
import type { DetailSheetLayoutInput } from './detail-sheet-layout';
import { buildFootingPlanRegion } from './footing-detail-plan';
import { buildFootingElevationRegion } from './footing-detail-elevation';
import { buildColumnPerspectiveRegion } from './column-detail-perspective';
import { buildFootingScheduleRegion } from './footing-detail-schedule';
import { buildFootingDesignSummaryRegion } from './footing-detail-design-summary';
import { buildFootingTitleBlockRegion } from './footing-detail-titleblock';
// ADR-477 Slice 2b — η συνδετήρια δοκός ΕΙΝΑΙ δοκός → beam-style όψη(longitudinal)+τομή
// μέσω των ΙΔΙΩΝ linear-member cores (μηδέν duplicate, μηδέν fake-BeamEntity).
import { buildLinearMemberElevationRegion } from './beam-detail-elevation';
import { buildLinearMemberSectionRegion } from './beam-detail-section';
import { resolveActiveFootingReinforcementForParams } from '../active-footing-reinforcement';
import { tieBeamRebarLayout } from '../reinforcement/tie-beam-linear-member';
import type { FootingDetail3dCapture } from './render/footing-detail-3d-capture';
import type { FoundationEntity, TieBeamParams } from '../../types/foundation-types';
import type { FootingDesignResult } from '../footing-design/footing-design-types';
import type {
  DetailPrimitive,
  DetailSheetModel,
  FootingDetailSheetLabels,
  RectMm,
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
  /**
   * ADR-464 Slice 5 — DERIVED αποτέλεσμα σχεδιασμού (έδραση/κάμψη/διάτρηση/τέμνουσα).
   * Όταν δοθεί ΚΑΙ υπάρχει `labels.designSummary` → προστίθεται πίνακας ελέγχων στο
   * κάτω μέρος της ζώνης οπλισμού. Absent/null → χωρίς πίνακα (back-compat).
   */
  readonly design?: FootingDesignResult | null;
}

/** Fraction της ζώνης οπλισμού που δεσμεύεται για τον πίνακα ελέγχων (κάτω μέρος). */
const DESIGN_SUMMARY_HEIGHT_FRACTION = 0.42;

/** Υπο-ορθογώνιο (κάτω μέρος της schedule ζώνης) για τον πίνακα ελέγχων σχεδιασμού. */
function designSummaryRect(schedule: RectMm): RectMm {
  const h = schedule.h * DESIGN_SUMMARY_HEIGHT_FRACTION;
  return { x: schedule.x, y: schedule.y + schedule.h - h, w: schedule.w, h };
}

/** Μία όψη του φύλλου (heading + caption + primitives) — διαμοιραζόμενη μορφή. */
interface DetailView {
  readonly title: string;
  readonly caption?: string;
  readonly primitives: readonly DetailPrimitive[];
}

/**
 * ADR-477 Slice 2b — beam-style όψεις της συνδετήριας δοκού (longitudinal «ΟΨΗ» στο
 * slot 'elevation' + εγκάρσια «ΔΙΑΤΟΜΗ» στο slot 'plan') από τα ΙΔΙΑ linear-member
 * cores που τροφοδοτούν τη δοκό — footing-resolved layout/cover (EC2 §4.4.1), μηδέν
 * fake-BeamEntity. `null` → degenerate/absent οπλισμός (caller πέφτει σε footing όψεις).
 */
function buildTieBeamLinearViews(
  p: TieBeamParams,
  elevationRect: RectMm,
  planRect: RectMm,
  tieLabels: { readonly elevation: string; readonly section: string },
): { elevation: DetailView; plan: DetailView } | null {
  const r = resolveActiveFootingReinforcementForParams(p);
  if (!r || r.kind !== 'tie-beam') return null;
  const layout = tieBeamRebarLayout(p, r);
  if (!layout) return null;
  const elevation = buildLinearMemberElevationRegion(layout, r, elevationRect);
  const section = buildLinearMemberSectionRegion(layout, planRect);
  return {
    elevation: { title: tieLabels.elevation, caption: elevation.caption, primitives: elevation.primitives },
    plan: { title: tieLabels.section, caption: section.caption, primitives: section.primitives },
  };
}

/**
 * Επιλέγει τις όψεις 'elevation' + 'plan': συνδετήρια δοκός → beam-style (όψη/τομή)·
 * πέδιλο/πεδιλοδοκός (ή tie-beam χωρίς beam-style labels) → footing (κάτοψη/διατομή).
 */
function resolvePlanAndElevation(
  input: FootingDetailSheetInput,
  elevationRect: RectMm,
  planRect: RectMm,
): { elevation: DetailView; plan: DetailView } {
  const { foundation, labels } = input;
  if (foundation.params.kind === 'tie-beam' && labels.tieBeamRegions) {
    const views = buildTieBeamLinearViews(foundation.params, elevationRect, planRect, labels.tieBeamRegions);
    if (views) return views;
  }
  const plan = buildFootingPlanRegion(foundation, planRect);
  const elevation = buildFootingElevationRegion(foundation, elevationRect);
  return {
    elevation: { title: labels.elevation, caption: elevation.caption, primitives: elevation.primitives },
    plan: { title: labels.plan, caption: plan.caption, primitives: plan.primitives },
  };
}

/**
 * Produces the footing detail-sheet drawing model: five laid-out regions with
 * headings, populated from the per-region builders (geometry-is-SSoT).
 */
export function buildFootingDetailSheet(input: FootingDetailSheetInput): DetailSheetModel {
  const { labels, foundation } = input;
  return assembleDetailSheet(input.layoutInput, (regions) => {
    // ADR-477 Slice 2b — kind-aware όψεις: tie-beam → beam-style (όψη/τομή)· αλλιώς footing.
    const { elevation, plan } = resolvePlanAndElevation(input, regions.elevation, regions.plan);
    const perspective = buildColumnPerspectiveRegion(regions.perspective, input.perspective3d ?? null);
    const schedule = buildFootingScheduleRegion(foundation, regions.schedule, labels.scheduleTable);
    const titleBlock = buildFootingTitleBlockRegion(
      foundation, regions['title-block'], labels.titleFields, labels.kindValues[foundation.kind],
    );

    // ADR-464 Slice 5 — πίνακας ελέγχων σχεδιασμού στο κάτω μέρος της ζώνης οπλισμού.
    const summaryPrimitives: DetailPrimitive[] = [];
    if (input.design && labels.designSummary) {
      const { primitives } = buildFootingDesignSummaryRegion(
        input.design, designSummaryRect(regions.schedule), labels.designSummary,
      );
      summaryPrimitives.push(...primitives);
    }

    return standardSheetRegions(regions, {
      elevation: { title: elevation.title, caption: elevation.caption, primitives: elevation.primitives },
      plan: { title: plan.title, caption: plan.caption, primitives: plan.primitives },
      schedule: { primitives: [...schedule.primitives, ...summaryPrimitives] },
      perspective, titleBlock, labels,
    });
  });
}
