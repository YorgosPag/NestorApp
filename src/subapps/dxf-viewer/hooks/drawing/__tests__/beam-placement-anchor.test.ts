/**
 * ADR-363 §5.7 — Beam freehand placement anchor (Revit "Location Line").
 *
 * Locks: η γραμμή των δύο κλικ ταυτίζεται με ΜΙΑ ΠΑΡΕΙΑ του δοκαριού (όχι το
 * κέντρο). Default `'left'` → το σώμα εκτείνεται προς το +canonical-normal (πάνω
 * πλευρά σε σχεδίαση αριστερά→δεξιά). SSoT reuse: `justifyGridSegment` (ADR-441),
 * το ΙΔΙΟ path με «εσχάρα από κάναβο». `center` → identity (κέντρο = legacy).
 */

import {
  anchorBeamPlacementAxis,
  buildAnchoredBeamParams,
  buildDefaultBeamParams,
  DEFAULT_BEAM_PLACEMENT_JUSTIFICATION,
} from '../beam-completion';
import { DEFAULT_BEAM_WIDTH_MM } from '../../../bim/types/beam-types';
import { computeBeamGeometry } from '../../../bim/geometry/beam-geometry';

const S = { x: 0, y: 0 };
const E = { x: 4000, y: 0 }; // αριστερά → δεξιά (dx>0, dy=0)
const HALF = DEFAULT_BEAM_WIDTH_MM / 2;

describe('anchorBeamPlacementAxis — edge-anchored placement (ADR-363 §5.7)', () => {
  it('default justification είναι "left" (σώμα προς πάνω πλευρά σε L→R)', () => {
    expect(DEFAULT_BEAM_PLACEMENT_JUSTIFICATION).toBe('left');
  });

  it('L→R: μετατοπίζει την centerline κατά +width/2 κάθετα (κλικ = παρειά)', () => {
    const a = anchorBeamPlacementAxis(S, E, DEFAULT_BEAM_WIDTH_MM, 'mm');
    expect(a.start.x).toBeCloseTo(0, 6);
    expect(a.end.x).toBeCloseTo(4000, 6);
    expect(a.start.y).toBeCloseTo(HALF, 6);
    expect(a.end.y).toBeCloseTo(HALF, 6);
  });

  it('"center" → identity (legacy κέντρο πάνω στη γραμμή κλικ)', () => {
    const a = anchorBeamPlacementAxis(S, E, DEFAULT_BEAM_WIDTH_MM, 'mm', 'center');
    expect(a.start).toEqual({ x: 0, y: 0 });
    expect(a.end).toEqual({ x: 4000, y: 0 });
  });

  it('degenerate (μηδενικού μήκους) άξονας → identity', () => {
    const a = anchorBeamPlacementAxis(S, S, DEFAULT_BEAM_WIDTH_MM, 'mm');
    expect(a.start).toEqual({ x: 0, y: 0 });
    expect(a.end).toEqual({ x: 0, y: 0 });
  });
});

describe('buildAnchoredBeamParams — η γραμμή κλικ γίνεται παρειά του outline', () => {
  it('L→R: το outline ακουμπά τη γραμμή κλικ (min y = 0), σώμα προς +y', () => {
    const params = buildAnchoredBeamParams(S, E, 'straight', {}, 'mm');
    // η stored centerline είναι μετατοπισμένη κατά +width/2
    expect(params.startPoint.y).toBeCloseTo(HALF, 6);

    const ys = computeBeamGeometry(params).outline.vertices.map((v) => v.y);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    // μία παρειά πάνω στη γραμμή κλικ (y=0), το σώμα εκτείνεται κατά πλήρες width προς +y
    expect(minY).toBeCloseTo(0, 6);
    expect(maxY).toBeCloseTo(DEFAULT_BEAM_WIDTH_MM, 6);
  });

  it('vs legacy centered: το κέντρο ήταν συμμετρικό γύρω από τη γραμμή κλικ (±width/2)', () => {
    const centered = buildDefaultBeamParams(S, E, 'straight', {}, 'mm');
    const ys = computeBeamGeometry(centered).outline.vertices.map((v) => v.y);
    expect(Math.min(...ys)).toBeCloseTo(-HALF, 6);
    expect(Math.max(...ys)).toBeCloseTo(HALF, 6);
  });
});
