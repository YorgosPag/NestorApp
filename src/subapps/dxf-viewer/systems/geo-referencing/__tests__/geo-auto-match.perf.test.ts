/**
 * ADR-650 §M10e — WORST-CASE COST OF ONE CLICK, at the reference file's real size.
 *
 * `autoMatchToSurvey` is called SYNCHRONOUSLY inside a React callback. Whether that is
 * acceptable is not a matter of opinion — it is a number, and until this file existed nobody
 * had it: the acceptance tests run 60–140 points, while `47_ergasia.dxf` carries 562 POINT +
 * 242 LWPOLYLINE + 1127 TEXT against a 93-point CSV.
 *
 * ⚠️ The ADR's earlier «single-digit ms» claim described the RANSAC design that was never
 * built. It says nothing about this implementation and must not be quoted for it.
 *
 * ## What «worst case» means here
 * The analytic branches are O(n) and win instantly, so the cost that matters is a drawing that
 * reaches the blind search — i.e. every DXF imported before Σκέλος Α, which is all of them
 * today. Two shapes are measured, because they cost differently:
 *   - FOUND    — hypotheses form, get scored, and the winner is refined.
 *   - REFUSED  — the user waits and gets "needs-manual". Nobody profiles this path, and it is
 *                the one a frustrated engineer clicks repeatedly.
 *
 * ## 🔴 MEASURED 2026-07-27: 6.7 s (found) / 9.8 s (refused) — a frozen tab, not a delay
 * Breakdown, measured not guessed: 2 456 hypotheses × ~3.8 ms to score one against the 1 500
 * search points. Of that ~3 ms is the grid probe and ~1.3 ms is `localToWorld` recomputing
 * `cos`/`sin` PER POINT (hoisting the trig out of the loop makes the same work cost 0.08 ms).
 * The pairwise table adds 473 ms. Everything else is noise.
 *
 * ## Why there is NO timing assertion here
 * A bound at 3× the measured value flakes on a loaded machine; a bound set to the number above
 * would read as an accepted budget for a defect. So this file MEASURES and logs, and the
 * number lives in ADR-650 §M10e where a decision can be taken against it. The assertions that
 * remain are about the ANSWER: no other test drives the matcher at the reference file's real
 * size, and «still correct at 1 772 candidates» is worth pinning on its own.
 *
 * ⏱ Costs ~25 s of suite time. That is the price of being the only test at production size.
 */

import { autoMatchToSurvey } from '../geo-auto-match';
import {
  EGSA_ORIGIN, LAYERS, LAYER_ID,
  jitter, labelEntity, place, pointEntities, scatter, surveyPoints,
} from './geo-match-fixtures';
import type { Entity, LWPolylineEntity } from '../../../types/entities';
import type { Point2D } from '../../../rendering/types/Types';

/** The reference file's own census — the point of this file is to be its size, not a round number. */
const SURVEY_POINTS = 93;
const DRAWING_NODES = 562;
const POLYLINES = 242;
const VERTICES_PER_POLYLINE = 5;
const TEXTS = 1_127;
const SITE_SPAN_MM = 150_000;

/** `count` polylines of `VERTICES_PER_POLYLINE` vertices each, scattered over the site. */
function polylineEntities(seed: number): LWPolylineEntity[] {
  const all = scatter(POLYLINES * VERTICES_PER_POLYLINE, SITE_SPAN_MM, seed);
  const out: LWPolylineEntity[] = [];
  for (let i = 0; i < POLYLINES; i++) {
    out.push({
      id: `pl_${i}`,
      type: 'lwpolyline',
      layerId: 'lyr_other',
      vertices: all.slice(i * VERTICES_PER_POLYLINE, (i + 1) * VERTICES_PER_POLYLINE),
    });
  }
  return out;
}

/** Elevation labels — they yield no candidate point, but the numbering branch reads every one. */
function elevationLabels(seed: number): Entity[] {
  return scatter(TEXTS, SITE_SPAN_MM, seed).map((p, i) => labelEntity(p, (i % 40 + 10.5).toFixed(2), i));
}

/** A full drawing at the reference file's size, whose `shared` points are the survey's twins. */
function drawing(shared: readonly Point2D[], seed: number): Entity[] {
  const fill = scatter(DRAWING_NODES - shared.length, SITE_SPAN_MM, seed);
  return [
    ...pointEntities([...shared, ...fill], LAYER_ID),
    ...polylineEntities(seed + 1),
    ...elevationLabels(seed + 2),
  ];
}

function timeMs(run: () => void): number {
  const started = performance.now();
  run();
  return performance.now() - started;
}

describe('autoMatchToSurvey — cost of one click at the reference file\'s size', () => {
  it('FOUND: a rotated 562-node drawing against a 93-point survey', () => {
    const shared = scatter(SURVEY_POINTS, SITE_SPAN_MM, 7_001);
    const world = jitter(shared.map((p) => place(p, 31.7, EGSA_ORIGIN)), 5, 7_002);
    const entities = drawing(shared, 7_003);

    let method = '';
    const elapsed = timeMs(() => {
      const result = autoMatchToSurvey({ entities, layersById: LAYERS, surveyPoints: surveyPoints(world) });
      method = result.method;
    });

    // eslint-disable-next-line no-console -- the measurement IS the deliverable of this test
    console.log(`[M10e perf] FOUND   ${entities.length} entities → ${elapsed.toFixed(0)} ms (${method})`);
    expect(method).toBe('congruent-pairs');
  });

  it('REFUSED: the same size, but the two files are unrelated', () => {
    const entities = drawing(scatter(SURVEY_POINTS, SITE_SPAN_MM, 8_001), 8_002);
    const world = scatter(SURVEY_POINTS, SITE_SPAN_MM, 999_001).map((p) => place(p, 0, EGSA_ORIGIN));

    let method = '';
    const elapsed = timeMs(() => {
      const result = autoMatchToSurvey({ entities, layersById: LAYERS, surveyPoints: surveyPoints(world) });
      method = result.method;
    });

    // eslint-disable-next-line no-console -- the measurement IS the deliverable of this test
    console.log(`[M10e perf] REFUSED ${entities.length} entities → ${elapsed.toFixed(0)} ms (${method})`);
    expect(method).toBe('needs-manual');
  });
});
