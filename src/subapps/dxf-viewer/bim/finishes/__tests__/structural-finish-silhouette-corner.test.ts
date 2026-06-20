/**
 * ADR-449 — merged-silhouette corner miter (1 vs πολλές κολώνες).
 *
 * Bug (Giorgio 2026-06-20, screenshot): μία κολώνα → ο σοβάς κλείνει με ορθή γωνία (σωστό)·
 * πολλές κολώνες → η ΝΔ (κάτω-αριστερά) γωνία κάθε κολώνας κλείνει λοξά (45° chamfer).
 *
 * Ρίζα: το `computeStructuralSilhouetteBands` συνενώνει ΠΟΛΛΑΠΛΑ rings (ένα ανά disjoint
 * κολώνα). Το `computeMiteredOuter` έκανε miter με positional `(k+1)%n` wrap → στο όριο
 * μεταξύ rings (το seam = ΝΔ κορυφή που η polygon-clipping βάζει πρώτη) έκανε mis-pair →
 * η γωνία-κλείσιμο κάθε ring έμενε ανοιχτή → λάθος chamfer. Fix: 2ο geometry-based miter pass.
 *
 * Signature: ένα chamfered ΝΔ outer corner βγαίνει στα ±185 (το outer τραβιέται μέσα κατά το
 * πάχος)· ένα σωστά mitered ΝΔ outer corner βγαίνει στα (-215,-215).
 */

import { computeStructuralSilhouetteBands, type SilhouetteMember } from '../structural-finish-silhouette';
import { collectFinishOutlinePlanPolylines } from '../structural-finish-plan-geometry';
import { buildDefaultColumnParams, buildColumnEntity } from '../../../hooks/drawing/column-completion';
import { mmToSceneUnits } from '../../../utils/scene-units';
import type { ColumnEntity } from '../../types/column-types';
import type { Point2D } from '../../../rendering/types/Types';
import type { Pt2 } from '../../geometry/shared/segment-polygon-coverage';

function col(at: { x: number; y: number }): ColumnEntity {
  const res = buildColumnEntity(buildDefaultColumnParams(at, 'rectangular'), '0');
  if (!res.ok) throw new Error('column fixture invalid');
  return res.entity;
}

function memberOf(c: ColumnEntity): SilhouetteMember {
  const footprint: Pt2[] = c.geometry.footprint.vertices.map((v) => ({ x: v.x, y: v.y }));
  return { footprint, zBotMm: 0, zTopMm: c.params.height };
}

/** Outline strips (mitered) της κάτω ζώνης σοβά για ένα σύνολο κολωνών. */
function outlineStrips(cols: ColumnEntity[]): readonly Point2D[][] {
  const base = cols[0];
  const sceneUnits = base.params.sceneUnits ?? 'mm';
  const s = mmToSceneUnits(sceneUnits);
  const bands = computeStructuralSilhouetteBands({
    members: cols.map(memberOf),
    wallObstacles: [],
    spec: base.params.finish!,
    classify: () => 'interior',
    unitToMeters: (1 / s) * 0.001,
  });
  return collectFinishOutlinePlanPolylines(bands[0]?.faces, sceneUnits, 0).map((p) => [...p.points]);
}

/** Τα outer σημεία (index 1,2 κάθε strip = aOuter,bOuter) που ανήκουν στην κολώνα @origin. */
function originOuterPts(strips: readonly Point2D[][]): Point2D[] {
  const origin = strips.filter((pts) => pts.every((q) => Math.abs(q.x) < 600 && Math.abs(q.y) < 600));
  return origin.flatMap((pts) => [pts[1], pts[2]]);
}

const near = (q: Point2D, x: number, y: number) => Math.abs(q.x - x) < 1 && Math.abs(q.y - y) < 1;
const isChamferSig = (q: Point2D) => Math.abs(Math.abs(q.x) - 185) < 1 || Math.abs(Math.abs(q.y) - 185) < 1;

describe('ADR-449 — merged-silhouette corner miter', () => {
  it('ΜΙΑ κολώνα: όλες οι γωνίες ορθές (μηδέν chamfer signature, ΝΔ outer στα (-215,-215))', () => {
    const outer = originOuterPts(outlineStrips([col({ x: 0, y: 0 })]));
    expect(outer.length).toBe(8); // 4 strips × 2 outer
    expect(outer.filter(isChamferSig)).toHaveLength(0);
    expect(outer.some((q) => near(q, -215, -215))).toBe(true);
  });

  it('ΠΟΛΛΕΣ κολώνες: η ΝΔ γωνία της κολώνας @origin παραμένει ορθή (regression — όχι λοξά)', () => {
    const strips = outlineStrips([
      col({ x: 0, y: 0 }),
      col({ x: 2000, y: 0 }),
      col({ x: 0, y: 2000 }),
      col({ x: 2000, y: 2000 }),
    ]);
    const outer = originOuterPts(strips);
    expect(outer.length).toBe(8);
    // πριν το fix: 2 από αυτά ήταν στα ±185 (chamfer). Μετά: κανένα.
    expect(outer.filter(isChamferSig)).toHaveLength(0);
    // ΝΔ γωνία σωστά mitered (ίδια τιμή με τη μεμονωμένη κολώνα).
    expect(outer.some((q) => near(q, -215, -215))).toBe(true);
  });
});
