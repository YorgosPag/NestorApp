/**
 * ADR-929 Φ5.4β — σημάδια ρόλου: ένας αναγνώστης, κάθε ρόλος εκτός τοίχων σε ΕΝΑ σημάδι, κανένα σημάδι που να
 * συγχέεται με επίπεδο βεβαιότητας, κάθε τμήμα ζωγραφισμένο ΜΙΑ φορά, και η ανάλυση «εκτός τοίχων» με την ΙΔΙΑ
 * πολιτική με το `isWallEvidence`.
 */

import type { PlanConfidence, PlanSegmentRole, RasterSegment } from '../../../bim/plan-recognition/plan-recognition-types';
import { isWallCandidateRole } from '../../../bim/plan-recognition/classify/segment-roles';
import { PLAN_CONFIDENCE_ORDER, planConfidenceMark } from '../plan-confidence';
import { PLAN_ROLE_MARK_ORDER, planRoleMark, planRoleMarkKind } from '../plan-role-marks';
import { scenePlanSegments } from '../plan-overlay-geometry';
import { isWallEvidence, wallEvidenceExclusions } from '../plan-recognition-session';

jest.mock('../../../floorplan-background/stores/floorplanBackgroundStore', () => ({
  getFloorBackground: () => null,
  getFloorProvider: () => null,
}));

const ALL_ROLES: readonly PlanSegmentRole[] = ['wall-face', 'dimension-line', 'extension-line', 'annotation', 'unknown'];

describe('ADR-929 Φ5.4β — ρόλος ⇒ σημάδι', () => {
  it.each([
    ['dimension-line', 'dimension'], ['extension-line', 'dimension'], ['annotation', 'annotation'],
    ['wall-face', null], ['unknown', null], [undefined, null],
  ] as const)('ρόλος %p ⇒ %p', (role, kind) => {
    expect(planRoleMarkKind(role)).toBe(kind);
  });

  it('σημάδι ⇔ η πολιτική βγάζει τον ρόλο εκτός τοίχων (ένας τόπος πολιτικής)', () => {
    for (const role of ALL_ROLES) expect(planRoleMarkKind(role) === null).toBe(isWallCandidateRole(role));
  });

  it('κανένα σημάδι ρόλου δεν μοιάζει με επίπεδο βεβαιότητας: μοναδικό μοτίβο ΚΑΙ χρώμα σε όλη την επικάλυψη', () => {
    const marks = [...PLAN_CONFIDENCE_ORDER.map(planConfidenceMark), ...PLAN_ROLE_MARK_ORDER.map(planRoleMark)];
    expect(new Set(marks.map((m) => m.dash)).size).toBe(marks.length);
    expect(new Set(marks.map((m) => m.stroke)).size).toBe(marks.length);
  });
});

describe('ADR-929 Φ5.4β — η επικάλυψη: κάθε τμήμα ΜΙΑ φορά', () => {
  const placement = {
    transform: { translateX: 0, translateY: 0, scaleX: 1, scaleY: 1, rotation: 0 },
    naturalBounds: { width: 100, height: 100 },
  };
  const seg = (id: string): RasterSegment => ({
    id, start: { x: 0, y: 0 }, end: { x: 10, y: 0 }, style: 'stroke', strokeWidthPx: 2, confidence: { score: 0.5, factors: {} },
  });
  const high: PlanConfidence = { score: 0.95, factors: {} };

  it('διάσταση υψηλής βεβαιότητας ⇒ ΜΟΝΟ στο σημάδι ρόλου, όχι και στο «υψηλή»', () => {
    const segments = ['w', 'd', 'e', 'a', 'u'].map(seg);
    const confidence = new Map(segments.map((s) => [s.id, high]));
    const roles = new Map<string, PlanSegmentRole>([
      ['w', 'wall-face'], ['d', 'dimension-line'], ['e', 'extension-line'], ['a', 'annotation'], ['u', 'unknown'],
    ]);
    const { byTier, byRole } = scenePlanSegments(segments, confidence, roles, placement);
    expect(byTier.high).toHaveLength(2);
    expect(byRole.dimension).toHaveLength(2);
    expect(byRole.annotation).toHaveLength(1);
    const drawn = Object.values(byTier).flat().length + Object.values(byRole).flat().length;
    expect(drawn).toBe(segments.length);
  });

  it('χωρίς κρίσεις ρόλου ⇒ όλα στα επίπεδα, όπως πριν τη Φ5.4', () => {
    const { byTier, byRole } = scenePlanSegments([seg('x')], new Map(), new Map(), placement);
    expect(byTier.low).toHaveLength(1);
    expect(byRole).toEqual({ dimension: [], annotation: [] });
  });
});

describe('ADR-929 Φ5.4β — «εκτός τοίχων»: ο ρόλος κρίνει πρώτος, η ΙΔΙΑ πολιτική με το isWallEvidence', () => {
  const score = (s: number): PlanConfidence => ({ score: s, factors: {} });
  const fusion = {
    segmentConfidence: new Map([
      ['wall-high', score(0.95)], ['wall-low', score(0.1)], ['dim-high', score(0.95)], ['dim-low', score(0.1)],
      ['ext', score(0.7)], ['note', score(0.9)], ['unknown-low', score(0.2)], ['no-role-high', score(0.9)],
    ]),
    segmentRoles: new Map<string, PlanSegmentRole>([
      ['wall-high', 'wall-face'], ['wall-low', 'wall-face'], ['dim-high', 'dimension-line'], ['dim-low', 'dimension-line'],
      ['ext', 'extension-line'], ['note', 'annotation'], ['unknown-low', 'unknown'],
    ]),
  };
  const segments = [...fusion.segmentConfidence.keys()].map((id) => ({ id }));

  it('διάσταση χαμηλής βεβαιότητας μετρά ως διάσταση, όχι ως «χαμηλή»', () => {
    expect(wallEvidenceExclusions(fusion, segments)).toEqual({
      byRole: { dimension: 3, annotation: 1 },
      lowConfidence: 2,
    });
  });

  it('άθροισμα = τμήματα που ΔΕΝ περνούν το isWallEvidence (καμία δεύτερη πολιτική)', () => {
    const { byRole, lowConfidence } = wallEvidenceExclusions(fusion, segments);
    const rejected = segments.filter((s) => !isWallEvidence(fusion, s.id)).length;
    expect(byRole.dimension + byRole.annotation + lowConfidence).toBe(rejected);
  });
});
