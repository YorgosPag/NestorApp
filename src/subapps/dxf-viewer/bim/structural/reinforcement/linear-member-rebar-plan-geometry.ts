/**
 * ADR-505 (finish/rebar export) — Γεωμετρία οπλισμού ΓΡΑΜΜΙΚΟΥ ΜΕΛΟΥΣ σε κάτοψη (pure SSoT).
 *
 * Το «σώμα» του πρώην `drawLinearMemberRebar2D` ΠΡΙΝ το ctx: προβάλλει το έτοιμο
 * `BeamRebarLayout` (διαμήκεις + συνδετήρες σε beam-local mm) πάνω στον άξονα μέσω
 * του κοινού `samplePolylineFrame` (path-relative frame) → **world coords**. Καμία
 * νέα μαθηματική — ίδια δειγματοληψία/γωνία με τον renderer.
 *
 * Καταναλώνεται από: `linear-member-rebar-2d.ts` (canvas) + `overlay-dxf-collector.ts`
 * (DXF, μέσω του beam/tie-beam wrapper). Ο `collectBeamRebarPlanGeometry` resolve-άρει
 * τον ενεργό (auto/FEM-aware) οπλισμό δοκού και delegate-άρει στον core.
 *
 * @see ../../renderers/linear-member-rebar-2d.ts — ο canvas consumer
 * @see ./beam-rebar-layout.ts — geometry SSoT (EC8 ζώνες)
 */

import type { Point2D } from '../../../rendering/types/Types';
import type { BeamEntity } from '../../types/beam-types';
import { mmToSceneUnits, type SceneUnits } from '../../../utils/scene-units';
import { samplePolylineFrame } from '../../geometry/shared/polyline-frame';
import type { BeamRebarLayout } from './beam-rebar-layout';
import { DEFAULT_STIRRUP_TYPE, type StirrupType } from './beam-reinforcement-types';
import { resolveActiveBeamRebarLayout } from '../active-reinforcement';
import type { RebarPlanGeometry, RebarPlanPath } from './rebar-plan-geometry-types';
import { EMPTY_REBAR_PLAN_GEOMETRY } from './rebar-plan-geometry-types';

/** Είσοδος: άξονας (canvas units) + έτοιμη διάταξη + τύπος συνδετήρα. */
export interface LinearMemberRebarPlanInput {
  /** Σημεία άξονα σε canvas/scene units (δοκός: axisPolyline· tie-beam: [start,end]). */
  readonly axisPts: readonly Point2D[];
  readonly sceneUnits: SceneUnits | undefined;
  readonly layout: BeamRebarLayout;
  readonly stirrupType: StirrupType;
}

/** Μέγιστο |v| (mm) της διαδρομής συνδετήρα — εγκάρσιο μισό-πλάτος στην κάτοψη. */
function stirrupHalfWidthMm(pathMm: readonly Point2D[]): number {
  let half = 0;
  for (const p of pathMm) half = Math.max(half, Math.abs(p.x));
  return half;
}

/**
 * Γεωμετρία οπλισμού γραμμικού μέλους στην κάτοψη (world coords). Κενή όταν ο άξονας
 * είναι εκφυλισμένος (<2 σημεία). Mirror του `drawLinearMemberRebar2D` traversal.
 */
export function collectLinearMemberRebarPlanGeometry(
  input: LinearMemberRebarPlanInput,
): RebarPlanGeometry {
  const { axisPts, sceneUnits, layout, stirrupType } = input;
  if (axisPts.length < 2) return EMPTY_REBAR_PLAN_GEOMETRY;

  const s = mmToSceneUnits(sceneUnits ?? 'mm'); // canvas units ανά mm
  // beam-local (u,v) [mm] → world, μέσω path-relative frame πάνω στον πλήρη άξονα.
  const project = (uMm: number, vMm: number): Point2D | null => {
    const frame = samplePolylineFrame(axisPts, uMm * s);
    if (!frame) return null;
    return { x: frame.point.x + vMm * s * frame.normal.x, y: frame.point.y + vMm * s * frame.normal.y };
  };

  const paths: RebarPlanPath[] = [];

  // ── Συνδετήρες: εγκάρσια γραμμή στο cover σε κάθε στάθμη ──
  const halfV = stirrupHalfWidthMm(layout.stirrupSectionPathMm);
  if (halfV > 0) {
    for (const u of layout.stirrupLevelsMm) {
      const a = project(u, -halfV);
      const b = project(u, halfV);
      if (a && b) paths.push({ points: [a, b], closed: false, diameterMm: layout.stirrupDiameterMm });
    }
  }

  collectLongitudinalBars(layout, axisPts.length, project, paths);
  collectStirrupHooks(layout, stirrupType, project, paths);

  return { paths, dots: [] };
}

/** Διαμήκεις: γραμμές κατά τον άξονα στις εγκάρσιες θέσεις (curve-aware sampling). */
function collectLongitudinalBars(
  layout: BeamRebarLayout,
  axisPtCount: number,
  project: (uMm: number, vMm: number) => Point2D | null,
  out: RebarPlanPath[],
): void {
  const subdivisions = axisPtCount <= 2 ? 1 : Math.max(8, axisPtCount * 2);
  for (const bar of layout.longitudinalBars) {
    const points: Point2D[] = [];
    for (let k = 0; k <= subdivisions; k++) {
      const u = bar.uStartMm + ((bar.uEndMm - bar.uStartMm) * k) / subdivisions;
      const p = project(u, bar.vMm);
      if (p) points.push(p);
    }
    if (points.length >= 2) out.push({ points, closed: false, diameterMm: bar.diameterMm });
  }
}

/** Γάντζοι 135° (μόνο `closed-hooked`) — προβάλλονται στο v στα δύο άκρα στην κάτοψη. */
function collectStirrupHooks(
  layout: BeamRebarLayout,
  stirrupType: StirrupType,
  project: (uMm: number, vMm: number) => Point2D | null,
  out: RebarPlanPath[],
): void {
  if (stirrupType !== 'closed-hooked' || layout.stirrupLevelsMm.length === 0) return;
  const ends = [layout.stirrupLevelsMm[0], layout.stirrupLevelsMm[layout.stirrupLevelsMm.length - 1]];
  for (const u of ends) {
    for (const hook of layout.stirrupHookEndsMm) {
      if (hook.length < 2) continue;
      const points: Point2D[] = [];
      for (const pt of hook) {
        const p = project(u, pt.x);
        if (p) points.push(p);
      }
      if (points.length >= 2) out.push({ points, closed: false, diameterMm: layout.stirrupDiameterMm });
    }
  }
}

/**
 * ADR-505 — wrapper δοκού: resolve ενεργού (auto/FEM-aware) οπλισμού + topology-aware
 * layout, μετά delegate στον core. `null` όταν η δοκός δεν έχει ενεργό οπλισμό.
 */
export function collectBeamRebarPlanGeometry(
  beam: Pick<BeamEntity, 'id' | 'params' | 'geometry'>,
): RebarPlanGeometry | null {
  const rebar = resolveActiveBeamRebarLayout(beam);
  if (!rebar) return null;
  return collectLinearMemberRebarPlanGeometry({
    axisPts: beam.geometry.axisPolyline.points,
    sceneUnits: beam.params.sceneUnits,
    layout: rebar.layout,
    stirrupType: rebar.reinforcement.stirrups.type ?? DEFAULT_STIRRUP_TYPE,
  });
}
