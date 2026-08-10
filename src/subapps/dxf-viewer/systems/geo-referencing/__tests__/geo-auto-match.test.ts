/**
 * ADR-650 §M10e — the orchestrator's acceptance tests.
 *
 * These are the contract, not coverage. Each one pins a claim the feature makes to a user:
 *   α — the recorded offset restores the file's own coordinates exactly
 *   γ — a moved AND rotated drawing is recovered blind, through noise and decoys
 *   δ — a drawing holding two coordinate frames picks the right one, and names its layer
 *   ε — files in different units are REPORTED, never silently scaled
 *   στ — unrelated files produce «needs-manual». The most important test in the file.
 *
 * 🔴 If one of these goes red, the answer is never to relax a threshold in `geo-match-gates`.
 */

import { autoMatchToSurvey, proposeRobustCenterAlignment } from '../geo-auto-match';
import { MAX_RMS_MM } from '../geo-match-gates';
import {
  EGSA_ORIGIN, LAYERS, LAYER_ID, LAYER_NAME,
  insetFrame, jitter, pinnedToSquare, place, pointEntities, scatter, surveyPoints,
} from './geo-match-fixtures';

describe('autoMatchToSurvey — analytic branches', () => {
  it('α: restores the file\'s own coordinates from the recorded sourceOrigin, with no residual', () => {
    const local = scatter(93, 180_000, 4711);
    const world = local.map((p) => ({ x: p.x + EGSA_ORIGIN.x, y: p.y + EGSA_ORIGIN.y }));

    const result = autoMatchToSurvey({
      entities: pointEntities(local),
      layersById: LAYERS,
      sourceOrigin: EGSA_ORIGIN,
      surveyPoints: surveyPoints(world),
    });

    expect(result.method).toBe('identity-restore');
    expect(result.inliers).toBe(93);
    expect(result.rmsMm!).toBeLessThan(1);
    expect(result.geo?.originWorld).toEqual(EGSA_ORIGIN);
    expect(result.geo?.rotationDeg).toBe(0);
  });

  it('recognises a drawing that is already in ΕΓΣΑ as already-aligned', () => {
    const world = scatter(60, 150_000, 99, EGSA_ORIGIN);

    const result = autoMatchToSurvey({
      entities: pointEntities(world),
      layersById: LAYERS,
      surveyPoints: surveyPoints(world),
    });

    expect(result.method).toBe('already-aligned');
    expect(result.geo?.rotationDeg).toBe(0);
    expect(result.inliers).toBe(60);
  });

  it('ignores a sourceOrigin that does not actually explain the survey, and falls through', () => {
    const world = scatter(50, 150_000, 7, EGSA_ORIGIN);
    const local = world.map((p) => ({ x: p.x - EGSA_ORIGIN.x, y: p.y - EGSA_ORIGIN.y }));

    const result = autoMatchToSurvey({
      entities: pointEntities(local),
      layersById: LAYERS,
      // A wrong offset — 5 km away from the truth. It must not be trusted just because it exists.
      sourceOrigin: { x: EGSA_ORIGIN.x + 5_000_000, y: EGSA_ORIGIN.y },
      surveyPoints: surveyPoints(world),
    });

    expect(result.method).not.toBe('identity-restore');
    expect(result.geo).not.toBeNull();
    expect(result.rmsMm!).toBeLessThanOrEqual(MAX_RMS_MM);
  });
});

describe('autoMatchToSurvey — γ: blind match of a moved and rotated drawing', () => {
  const TRUE_ROTATION_DEG = 37.4;
  const TRUE_TRANSLATION = EGSA_ORIGIN;

  it('recovers rotation to 0.01° and translation to 5 mm, through noise and 60 decoys', () => {
    const local = scatter(80, 160_000, 20_260_727);
    const world = local.map((p) => place(p, TRUE_ROTATION_DEG, TRUE_TRANSLATION));
    // Decoys: drawing geometry with no survey counterpart at all (walls, hatching, a legend).
    const decoys = scatter(60, 160_000, 5150);

    const result = autoMatchToSurvey({
      entities: pointEntities([...local, ...decoys]),
      layersById: LAYERS,
      surveyPoints: surveyPoints(jitter(world, 5, 31)),
    });

    expect(result.method).toBe('congruent-pairs');
    expect(result.geo).not.toBeNull();
    expect(result.geo!.rotationDeg).toBeCloseTo(TRUE_ROTATION_DEG, 2);
    expect(Math.abs(result.geo!.originWorld.x - TRUE_TRANSLATION.x)).toBeLessThan(5);
    expect(Math.abs(result.geo!.originWorld.y - TRUE_TRANSLATION.y)).toBeLessThan(5);
    expect(result.inliers).toBeGreaterThanOrEqual(70);
    expect(result.rmsMm!).toBeLessThanOrEqual(MAX_RMS_MM);
  });
});

describe('autoMatchToSurvey — δ: two coordinate frames in one drawing', () => {
  it('matches the ΕΓΣΑ frame, ignores the local inset, and names the winning layer', () => {
    const local = scatter(70, 140_000, 8_080);
    const world = local.map((p) => place(p, 12.5, EGSA_ORIGIN));
    // A detail/legend pasted from another drawing, 40 km away in the local frame.
    const inset = scatter(25, 20_000, 606, { x: -40_000_000, y: -40_000_000 });

    const result = autoMatchToSurvey({
      entities: [...pointEntities(local, LAYER_ID), ...pointEntities(inset, 'lyr_other')],
      layersById: LAYERS,
      surveyPoints: surveyPoints(world),
    });

    expect(result.method).toBe('congruent-pairs');
    expect(result.layerName).toBe(LAYER_NAME);
    expect(result.geo!.rotationDeg).toBeCloseTo(12.5, 2);
    expect(result.inliers).toBeGreaterThanOrEqual(60);
  });
});

describe('autoMatchToSurvey — ε: unit mismatch', () => {
  it('reports a 1000× scale as unit-mismatch and produces NO geo-reference', () => {
    const local = scatter(60, 150, 1234); // authored in metres, read as millimetres
    const world = local.map((p) => place({ x: p.x * 1000, y: p.y * 1000 }, 0, EGSA_ORIGIN));
    // The numbering channel makes the correspondences certain, so the scale is unambiguous.
    const numbered = surveyPoints(world, true);
    const labels = local.map((p, i) => ({
      id: `tx_${i}`, type: 'text' as const, layerId: LAYER_ID,
      position: { x: p.x + 2, y: p.y + 2 }, text: String(i + 1),
    }));

    const result = autoMatchToSurvey({
      entities: [...pointEntities(local), ...labels],
      layersById: LAYERS,
      surveyPoints: numbered,
      toleranceMm: 50,
    });

    expect(result.method).toBe('unit-mismatch');
    expect(result.geo).toBeNull();
    expect(result.scaleEstimate).toBeGreaterThan(900);
    expect(result.suggestedUnitScale).toBe(1000);
  });

  it('reports a 1000× scale even with NO labels, where the blind search is structurally blind', () => {
    // The congruent search matches on distance invariance: at 1000× no drawing segment has a
    // survey counterpart of any length, so it forms no hypothesis and computes no scale. Without
    // the extent fallback this case produced «no match found» — true, and useless.
    const local = scatter(70, 150, 2_468);
    const world = local.map((p) => place({ x: p.x * 1000, y: p.y * 1000 }, 0, EGSA_ORIGIN));

    const result = autoMatchToSurvey({
      entities: pointEntities(local),
      layersById: LAYERS,
      surveyPoints: surveyPoints(world), // unnumbered — the identity channel cannot help
    });

    expect(result.method).toBe('unit-mismatch');
    expect(result.geo).toBeNull();
    expect(result.suggestedUnitScale).toBe(1000);
  });

  // ── The two tests below pin the SET the extent is measured over. A drawing routinely holds
  // more than one coordinate frame, and the distance BETWEEN frames is not a size of anything:
  // it is empty space. Measuring across it makes the fallback answer a question nobody asked.

  it('still reports the unit mismatch when the drawing also holds a distant inset', () => {
    // Realistic pairing: the drawing is correct (mm), the survey CSV was imported without the
    // metre→millimetre conversion, so its numbers are 1000× too small. Measured across BOTH
    // frames the ratio is 1e-4 — no unit at all — and the user is told «no match found».
    const site = pinnedToSquare(scatter(70, 150_000, 3_141), 150_000);
    const world = site.map((p) => ({ x: p.x / 1000 + 407_700, y: p.y / 1000 + 4_502_400 }));
    const inset = insetFrame({ x: -1_350_000, y: -1_350_000 }, 1_000);

    const result = autoMatchToSurvey({
      entities: [...pointEntities(site), ...pointEntities(inset, 'lyr_other')],
      layersById: LAYERS,
      surveyPoints: surveyPoints(world),
    });

    expect(result.method).toBe('unit-mismatch');
    expect(result.geo).toBeNull();
    expect(result.suggestedUnitScale).toBeCloseTo(0.001, 6);
  });

  it('does NOT invent a unit mismatch out of the GAP between two coordinate frames', () => {
    // Two unrelated 150 m files — «needs-manual», as in στ. The drawing additionally holds an
    // inset 1.35 km away, which is placed so that the extent across both frames is EXACTLY 10×
    // the survey's. Measured that way the tool would announce «your units are off by ten» about
    // two files that simply do not match: a confident, actionable, false statement.
    const site = pinnedToSquare(scatter(70, 150_000, 111), 150_000);
    const inset = insetFrame({ x: -1_350_000, y: -1_350_000 }, 1_000);
    const world = pinnedToSquare(scatter(70, 150_000, 999_999), 150_000)
      .map((p) => place(p, 0, EGSA_ORIGIN));

    const result = autoMatchToSurvey({
      entities: [...pointEntities(site), ...pointEntities(inset, 'lyr_other')],
      layersById: LAYERS,
      surveyPoints: surveyPoints(world),
    });

    expect(result.method).toBe('needs-manual');
    expect(result.suggestedUnitScale).toBeNull();
  });

  it('does NOT cry unit-mismatch for two merely unrelated files of different sizes', () => {
    // A big survey and a small unrelated drawing have an extent ratio too — but not one that
    // lands within half a percent of a real unit ratio. This must stay «needs-manual».
    const local = scatter(60, 7_000, 5);
    const world = scatter(60, 150_000, 6).map((p) => place(p, 0, EGSA_ORIGIN));

    const result = autoMatchToSurvey({
      entities: pointEntities(local), layersById: LAYERS, surveyPoints: surveyPoints(world),
    });

    expect(result.method).toBe('needs-manual');
  });
});

describe('autoMatchToSurvey — στ: the false-positive guard', () => {
  it('refuses two unrelated point sets with needs-manual', () => {
    const drawing = scatter(90, 150_000, 111);
    const unrelated = scatter(90, 150_000, 999_999).map((p) => place(p, 0, EGSA_ORIGIN));

    const result = autoMatchToSurvey({
      entities: pointEntities(drawing),
      layersById: LAYERS,
      surveyPoints: surveyPoints(unrelated),
    });

    expect(result.method).toBe('needs-manual');
    expect(result.geo).toBeNull();
  });

  it('refuses a symmetric grid, whose 90°/180° self-matches are genuinely ambiguous', () => {
    // A perfect 9×9 grid maps onto itself under four rotations. Every one of those fits is as
    // good as the others, so there IS no answer — the uniqueness gate must say so.
    const grid: Array<{ x: number; y: number }> = [];
    for (let i = 0; i < 9; i++) for (let j = 0; j < 9; j++) grid.push({ x: i * 10_000, y: j * 10_000 });
    const world = grid.map((p) => place(p, 0, EGSA_ORIGIN));

    const result = autoMatchToSurvey({
      entities: pointEntities(grid),
      layersById: LAYERS,
      // No sourceOrigin: the analytic branches are unavailable, so the blind search must decide.
      surveyPoints: surveyPoints(world),
    });

    expect(result.method).toBe('needs-manual');
    expect(result.geo).toBeNull();
  });

  it('SAYS WHY it refused — a bare «no match» names no next action', () => {
    // A drawing that overlaps the survey only slightly: a handful of points land, far below
    // the required count. The user needs to be told THAT, not just «nothing found».
    const shared = scatter(6, 40_000, 4242);
    const drawingOnly = scatter(80, 150_000, 313);
    const surveyOnly = scatter(80, 150_000, 717);

    const result = autoMatchToSurvey({
      entities: pointEntities([...shared, ...drawingOnly]),
      layersById: LAYERS,
      surveyPoints: surveyPoints([...shared, ...surveyOnly].map((p) => place(p, 0, EGSA_ORIGIN))),
      sourceOrigin: EGSA_ORIGIN,
    });

    expect(result.method).toBe('needs-manual');
    expect(result.failure).toBe('too-few-inliers');
    // The numbers behind the refusal survive into the result — the card renders them.
    expect(result.inliers).toBeGreaterThan(0);
    expect(result.required).toBeGreaterThan(result.inliers);
  });

  it('claims no gate refused it when no hypothesis was ever formed', () => {
    // A 3 m drawing against a 150 m survey: the bases are the survey's LONGEST segments
    // (~180 m) and the drawing has nothing remotely that long, so distance invariance yields
    // no congruent pair at all. Nothing was judged, so nothing may be reported as judged —
    // naming a gate here would be diagnosis theatre.
    const result = autoMatchToSurvey({
      entities: pointEntities(scatter(40, 3_000, 111)),
      layersById: LAYERS,
      surveyPoints: surveyPoints(scatter(90, 150_000, 999_999).map((p) => place(p, 0, EGSA_ORIGIN))),
    });

    expect(result.method).toBe('needs-manual');
    expect(result.failure).toBeNull();
  });

  it('two unrelated files of the SAME size are refused with a reason, not silently', () => {
    const result = autoMatchToSurvey({
      entities: pointEntities(scatter(90, 150_000, 111)),
      layersById: LAYERS,
      surveyPoints: surveyPoints(scatter(90, 150_000, 999_999).map((p) => place(p, 0, EGSA_ORIGIN))),
    });

    expect(result.method).toBe('needs-manual');
    // Coincidental landings DO happen at 90 points / 150 m / 50 mm — and the gate refusing
    // them is exactly the guard working. What matters is that it says so.
    expect(result.failure).toBe('too-few-inliers');
  });

  it('returns needs-manual for empty inputs instead of inventing a reference', () => {
    expect(autoMatchToSurvey({ entities: [], layersById: LAYERS, surveyPoints: [] }).method).toBe('needs-manual');
    expect(autoMatchToSurvey({
      entities: pointEntities(scatter(10, 1000, 1)), layersById: LAYERS, surveyPoints: [],
    }).geo).toBeNull();
  });
});

/**
 * ζ — ADR-782 §15: «Αυτόματο κούμπωμα» as a PROPOSAL.
 *
 * These pin the defect measured on a real project on 2026-08-10: the robust-centre estimate
 * wrote `Project.basePoint` **23,185 m** off and reported success, because nothing ever scored
 * it. The claim under test is not «the estimate is good» — it is not, and is not meant to be.
 * The claim is that it is now MEASURED BY THE SAME VERIFIER as every other branch, and that its
 * verdict travels with it.
 */
describe('proposeRobustCenterAlignment — ζ: the estimate is measured, never silent', () => {
  /**
   * ζ1 — THE REGRESSION, in the shape it actually happened.
   *
   * A topographic DXF is far larger than the plot it surveys: the drawing carries neighbouring
   * blocks, a legend and a coordinate table, while the survey is 84 vertices of one site. So the
   * centre of the drawing and the centre of the survey are NOT the same physical point, and
   * pairing them lands the plan tens of metres away — here ~91 m, on the real project 23,185 m.
   *
   * Both halves of the claim matter: the proposal still carries `geo` (the engineer may take a
   * rough start knowingly), AND it carries the gate that refused it.
   */
  it('ζ1: a drawing wider than its survey produces an estimate that FAILS the gates, with the reason attached', () => {
    const survey = scatter(84, 120_000, 4711, EGSA_ORIGIN);
    const local = survey.map((p) => ({ x: p.x - EGSA_ORIGIN.x, y: p.y - EGSA_ORIGIN.y }));
    // The rest of the sheet: geometry the survey does not cover, which drags the drawing centre.
    const elsewhere = scatter(200, 400_000, 88).map((p) => ({ x: p.x + 300_000, y: p.y + 60_000 }));

    const result = proposeRobustCenterAlignment({
      entities: pointEntities([...local, ...elsewhere]),
      layersById: LAYERS,
      sourceOrigin: EGSA_ORIGIN,
      surveyPoints: surveyPoints(survey),
    });

    expect(result.method).toBe('robust-center');
    expect(result.geo).not.toBeNull();          // the estimate is still offered…
    expect(result.failure).toBe('too-few-inliers'); // …carrying the verdict that refused it
    expect(result.inliers).toBeLessThan(result.required);
    // The whole point of the card: the numbers exist and are the verifier's, not the estimator's.
    expect(result.required).toBeGreaterThan(0);
    expect(result.matchable).toBe(84);
  });

  /**
   * ζ2 — the counterpart that makes ζ1 an indictment rather than a curiosity: on the SAME input,
   * the analytic answer is available, exact, and free. This is the pairing the user never saw.
   */
  it('ζ2: on the same input the cascade answers exactly, which is why the silent estimate was a defect', () => {
    const survey = scatter(84, 120_000, 4711, EGSA_ORIGIN);
    const local = survey.map((p) => ({ x: p.x - EGSA_ORIGIN.x, y: p.y - EGSA_ORIGIN.y }));
    const elsewhere = scatter(200, 400_000, 88).map((p) => ({ x: p.x + 300_000, y: p.y + 60_000 }));
    const input = {
      entities: pointEntities([...local, ...elsewhere]),
      layersById: LAYERS,
      sourceOrigin: EGSA_ORIGIN,
      surveyPoints: surveyPoints(survey),
    };

    const exact = autoMatchToSurvey(input);
    expect(exact.method).toBe('identity-restore');
    expect(exact.inliers).toBe(84);
    expect(exact.failure).toBeNull();
    expect(exact.geo?.originWorld).toEqual(EGSA_ORIGIN);

    const estimate = proposeRobustCenterAlignment(input);
    expect(estimate.inliers).toBeLessThan(exact.inliers);
  });

  it('ζ3: when the centres really do coincide, the estimate passes the gates and carries no failure', () => {
    const world = scatter(70, 150_000, 31, EGSA_ORIGIN);

    const result = proposeRobustCenterAlignment({
      entities: pointEntities(world),
      layersById: LAYERS,
      surveyPoints: surveyPoints(world),
    });

    expect(result.method).toBe('robust-center');
    expect(result.failure).toBeNull();
    expect(result.inliers).toBe(70);
    expect(result.rmsMm!).toBeLessThanOrEqual(MAX_RMS_MM);
  });

  /**
   * ζ4 — «the SAME verifier» has to mean something checkable. The estimate is judged against the
   * cascade's candidate points, not against the bbox centres its own estimator used: a guess
   * allowed to pick its own evidence cannot fail.
   */
  it('ζ4: is judged against the same achievable maximum as the cascade, on identical input', () => {
    const survey = scatter(50, 120_000, 5, EGSA_ORIGIN);
    const input = {
      entities: pointEntities(scatter(120, 300_000, 6)),
      layersById: LAYERS,
      surveyPoints: surveyPoints(survey),
    };

    expect(proposeRobustCenterAlignment(input).matchable).toBe(autoMatchToSurvey(input).matchable);
  });

  /**
   * ζ5 — the cascade must NOT be able to return `robust-center`. It is a separate entry on
   * purpose: a centroid guess appended as a fifth branch would essentially never pass the gates,
   * i.e. a guard with no way of proving it is alive (ADR-749 §5).
   */
  it('ζ5: the cascade never returns robust-center — it is a separate entry, not a dormant branch', () => {
    const world = scatter(70, 150_000, 31, EGSA_ORIGIN);
    const inputs = [
      { entities: pointEntities(world), layersById: LAYERS, surveyPoints: surveyPoints(world) },
      {
        entities: pointEntities(scatter(90, 150_000, 111)),
        layersById: LAYERS,
        surveyPoints: surveyPoints(scatter(90, 150_000, 999_999).map((p) => place(p, 0, EGSA_ORIGIN))),
      },
    ];

    for (const input of inputs) expect(autoMatchToSurvey(input).method).not.toBe('robust-center');
  });

  it('ζ6: returns needs-manual with no reference for empty inputs, like every other entry', () => {
    expect(proposeRobustCenterAlignment({
      entities: [], layersById: LAYERS, surveyPoints: [],
    }).method).toBe('needs-manual');
    expect(proposeRobustCenterAlignment({
      entities: pointEntities(scatter(10, 1000, 1)), layersById: LAYERS, surveyPoints: [],
    }).geo).toBeNull();
  });
});
