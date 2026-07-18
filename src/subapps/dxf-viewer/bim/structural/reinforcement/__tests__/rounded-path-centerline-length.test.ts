/**
 * ADR-456 — αναλυτικό (arc-aware) μήκος άξονα στρογγυλεμένου συνδετήρα.
 *
 * Το SSoT «geometry truth» για τα ΒΑΡΗ χάλυβα: μετρά Σ ευθύγραμμα + Σ τόξα (r·|da|), ΑΝΕΞΑΡΤΗΤΟ
 * από το display tessellation — ώστε το smoothing της εμφάνισης να μην αλλάζει ΠΟΤΕ τις ποσότητες
 * (big-players split: εμφάνιση ≠ ποσότητα). Τα tests κλειδώνουν ότι είναι πράγματι arc-aware και
 * ταυτίζεται με τον closed-form του στρογγυλεμένου ορθογωνίου.
 */

import {
  roundedPathCenterlineLengthMm,
  closedPolylineLengthMm,
  buildRoundedStirrupPath,
} from '../column-rebar-layout';
import { buildPerimeterLayoutFromOutline } from '../column-perimeter-layout';
import { buildWallLayout } from '../column-wall-reinforcement';
import { resolveColumnReinforcementSection } from '../column-section-outline';
import type { ColumnReinforcement } from '../column-reinforcement-types';
import type { ColumnParams } from '../../../types/column-types';
import type { Point2D } from '../../../../rendering/types/Types';

const REINF: ColumnReinforcement = {
  longitudinal: { diameterMm: 16, count: 8 },
  stirrups: { diameterMm: 8, spacingMm: 200, spacingCriticalMm: 100, type: 'closed-hooked' },
  coverMm: 30,
};

function wallParams(over: Partial<ColumnParams> = {}): ColumnParams {
  return {
    kind: 'shear-wall', position: { x: 0, y: 0, z: 0 }, anchor: 'center',
    width: 2000, depth: 250, height: 3000, rotation: 0, sceneUnits: 'mm',
    baseBinding: 'storey-floor', topBinding: 'storey-ceiling', baseOffset: 0, topOffset: 0,
    ...over,
  } as ColumnParams;
}

function rect(w: number, d: number): Point2D[] {
  return [
    { x: -w / 2, y: -d / 2 },
    { x: w / 2, y: -d / 2 },
    { x: w / 2, y: d / 2 },
    { x: -w / 2, y: d / 2 },
  ];
}

function perimeter(pts: readonly Point2D[]): number {
  let p = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    p += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return p;
}

describe('roundedPathCenterlineLengthMm — analytical arc-aware length (ADR-456)', () => {
  it('equals the closed-form rounded-rectangle 2(W+D) − 8r + 2πr (arc-aware via the 2πr term)', () => {
    const W = 400, D = 300, r = 20;
    const expected = 2 * (W + D) - 8 * r + 2 * Math.PI * r;
    expect(roundedPathCenterlineLengthMm(rect(W, D), r)).toBeCloseTo(expected, 6);
  });

  it('rounding shortens the path vs the sharp-corner perimeter (corners are cut)', () => {
    const corners = rect(400, 300);
    expect(roundedPathCenterlineLengthMm(corners, 20)).toBeLessThan(perimeter(corners));
  });

  it('handles a non-rectangular (L-shape): perimeter − 2r·n + r·Σ|da| (Σ|da| = 6·π/2 for an L)', () => {
    const L: Point2D[] = [
      { x: 0, y: 0 }, { x: 300, y: 0 }, { x: 300, y: 100 },
      { x: 100, y: 100 }, { x: 100, y: 300 }, { x: 0, y: 300 },
    ];
    const r = 10;
    const expected = perimeter(L) - 2 * r * 6 + r * (6 * (Math.PI / 2));
    expect(roundedPathCenterlineLengthMm(L, r)).toBeCloseTo(expected, 6);
  });

  it('sharp corners (r ≤ 0) → plain perimeter; degenerate (<3 pts) → closedPolylineLengthMm', () => {
    const corners = rect(400, 300);
    expect(roundedPathCenterlineLengthMm(corners, 0)).toBeCloseTo(perimeter(corners), 6);
    const two: Point2D[] = [{ x: 0, y: 0 }, { x: 100, y: 0 }];
    expect(roundedPathCenterlineLengthMm(two, 5)).toBe(closedPolylineLengthMm(two));
  });
});

/**
 * ADR-456 §3.2 — GUARANTEE: το αναφερόμενο μήκος άξονα (η ΠΟΣΟΤΗΤΑ) είναι ΑΝΕΞΑΡΤΗΤΟ από το
 * display tessellation (big-players split: εμφάνιση ≠ ποσότητα). Regression lock: το smoothing
 * της εμφάνισης (πυκνότητα χορδών) ΠΟΤΕ δεν αλλάζει το βάρος χάλυβα.
 */
describe('quantity is decoupled from display tessellation (ADR-456 §3.2 guarantee)', () => {
  it('analytic length is fixed while the tessellated polyline varies with segment density', () => {
    const ring = rect(400, 300);
    const r = 20;
    const analytic = roundedPathCenterlineLengthMm(ring, r);
    const coarse = closedPolylineLengthMm(buildRoundedStirrupPath(ring, r, 2));
    const fine = closedPolylineLengthMm(buildRoundedStirrupPath(ring, r, 64));
    // Το tessellation ΟΝΤΩΣ αλλάζει το μετρημένο polyline (πιο πυκνές χορδές → πιο κοντά στο τόξο)…
    expect(fine).toBeGreaterThan(coarse);
    // …αλλά το αναλυτικό μήκος δεν κουνιέται και είναι πάντα ≥ κάθε πεπερασμένη προσέγγιση χορδών.
    expect(analytic).toBeGreaterThan(coarse);
    expect(analytic).toBeGreaterThanOrEqual(fine - 1e-6);
  });

  it('non-rect (perimeter Γ) layout.stirrupCenterlineLengthMm == analytic, NOT the display-polyline measure', () => {
    const L: Point2D[] = [
      { x: 0, y: 0 }, { x: 600, y: 0 }, { x: 600, y: 250 },
      { x: 250, y: 250 }, { x: 250, y: 600 }, { x: 0, y: 600 },
    ];
    const layout = buildPerimeterLayoutFromOutline(REINF, L)!;
    expect(layout).not.toBeNull();
    const analytic = roundedPathCenterlineLengthMm(layout.stirrupRingMm, layout.stirrupCornerRadiusMm);
    // Το reported μήκος = ο αναλυτικός (arc-aware) τύπος → μηδέν εξάρτηση από STIRRUP_BEND_ARC_SEGMENTS.
    expect(layout.stirrupCenterlineLengthMm).toBeCloseTo(analytic, 6);
    // Αυστηρά ΜΕΓΑΛΥΤΕΡΟ από το tessellated display path (χορδές υπο-εκτιμούν) → αποδεδειγμένα decoupled.
    expect(layout.stirrupCenterlineLengthMm).toBeGreaterThan(closedPolylineLengthMm(layout.stirrupPathMm));
  });

  it('wall extra (boundary) hoops carry analytic lengths, decoupled from their tessellated paths (§3.1)', () => {
    const section = resolveColumnReinforcementSection(wallParams());
    const layout = buildWallLayout(REINF, section)!;
    expect(layout).not.toBeNull();
    const lengths = layout.extraStirrupCenterlineLengthsMm;
    const paths = layout.extraStirrupPathsMm;
    expect(lengths?.length).toBe(2);
    expect(paths?.length).toBe(2);
    // Κάθε αναλυτικό μήκος ≥ το μετρημένο tessellated path του (arc-aware > χορδές), και κοντά (<2%).
    for (let i = 0; i < lengths!.length; i++) {
      const measured = closedPolylineLengthMm(paths![i]);
      expect(lengths![i]).toBeGreaterThanOrEqual(measured - 1e-6);
      expect(Math.abs(lengths![i] - measured) / measured).toBeLessThan(0.02);
    }
  });
});
