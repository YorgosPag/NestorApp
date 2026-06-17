/**
 * ADR-477 Slice 2 — tie-beam → linear-member adapter parity tests.
 *
 * Επιβεβαιώνει ότι η συνδετήρια δοκός παράγει ΑΚΡΙΒΩΣ την ίδια διάταξη οπλισμού με μια
 * ισοδύναμη δοκό (ίδιο `resolveBeamRebarLayout`) — δηλαδή κερδίζει τις EC8 κρίσιμες
 * ζώνες συνδετήρων — και ότι ο justified άξονας επιστρέφεται σωστά. Pure (zero store).
 */

import { resolveBeamRebarLayout } from '../beam-rebar-layout';
import type { BeamSectionContext } from '../../codes/structural-code-types';
import type { TieBeamReinforcement } from '../footing-reinforcement-types';
import type { TieBeamParams } from '../../../types/foundation-types';
import { tieBeamRebarLayout, tieBeamAxisPoints } from '../tie-beam-linear-member';

const WIDTH_MM = 250;
const DEPTH_MM = 500;
const SPAN_MM = 4000;

const reinforcement: TieBeamReinforcement = {
  kind: 'tie-beam',
  bottom: { diameterMm: 16, count: 3 },
  top: { diameterMm: 16, count: 3 },
  stirrups: { diameterMm: 8, spacingMm: 200, spacingCriticalMm: 100 },
  coverMm: 40,
};

function makeTieBeam(overrides: Partial<TieBeamParams> = {}): TieBeamParams {
  return {
    kind: 'tie-beam',
    topElevationMm: -500,
    thicknessMm: DEPTH_MM,
    start: { x: 0, y: 0, z: 0 },
    end: { x: SPAN_MM, y: 0, z: 0 },
    width: WIDTH_MM,
    reinforcement,
    ...overrides,
  };
}

const equivalentBeamCtx: BeamSectionContext = {
  widthMm: WIDTH_MM,
  depthMm: DEPTH_MM,
  spanMm: SPAN_MM,
  grossAreaMm2: WIDTH_MM * DEPTH_MM,
  supportType: 'simple',
};

describe('tieBeamRebarLayout (adapter parity)', () => {
  it('produces the SAME layout as an equivalent beam (geometry SSoT reuse)', () => {
    const tie = tieBeamRebarLayout(makeTieBeam(), reinforcement);
    const beam = resolveBeamRebarLayout(equivalentBeamCtx, reinforcement);
    expect(tie).not.toBeNull();
    expect(beam).not.toBeNull();
    expect(tie).toEqual(beam);
  });

  it('densifies stirrups in the EC8 critical end zones (not uniform spacing)', () => {
    const layout = tieBeamRebarLayout(makeTieBeam(), reinforcement);
    expect(layout).not.toBeNull();
    const levels = layout!.stirrupLevelsMm;
    expect(levels.length).toBeGreaterThan(2);
    // Πρώτο διάστημα = κρίσιμο βήμα (100), όχι το μεσαίο (200).
    expect(levels[1] - levels[0]).toBeCloseTo(100, 3);
  });

  it('returns null for a degenerate (zero-length) axis', () => {
    const layout = tieBeamRebarLayout(
      makeTieBeam({ end: { x: 0, y: 0, z: 0 } }),
      reinforcement,
    );
    expect(layout).toBeNull();
  });
});

describe('tieBeamAxisPoints', () => {
  it('returns [start, end] for the default (center) justification', () => {
    const pts = tieBeamAxisPoints(makeTieBeam());
    expect(pts).toHaveLength(2);
    expect(pts[0]).toMatchObject({ x: 0, y: 0 });
    expect(pts[1]).toMatchObject({ x: SPAN_MM, y: 0 });
  });

  it('shifts the axis perpendicular for an eccentric Location Line (left)', () => {
    const pts = tieBeamAxisPoints(makeTieBeam({ justification: 'left' }));
    // Άξονας οριζόντιος start→end → CCW normal = (0,1)· left shift = +width/2 (canvas mm).
    expect(pts[0].y).toBeCloseTo(WIDTH_MM / 2, 3);
    expect(pts[1].y).toBeCloseTo(WIDTH_MM / 2, 3);
  });
});
