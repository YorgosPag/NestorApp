/**
 * ADR-650 §M10e — test η: the numbering channel.
 *
 * The claim under test: when the surveyor labelled the drawing, the match is EXACT and needs
 * no heuristic at all. Plus the fail-closed behaviour that makes the channel worth trusting —
 * duplicate numbers and contested nodes produce nothing rather than something plausible.
 */

import { matchByPointNumber } from '../geo-point-number-match';
import { collectCandidatePoints } from '../geo-ref-candidate-points';
import { autoMatchToSurvey } from '../geo-auto-match';
import type { Entity } from '../../../types/entities';
import type { TopoPoint } from '../../topography/topo-types';
import {
  EGSA_ORIGIN, LAYERS, labelEntity, place, pointEntities, scatter, surveyPoints,
} from './geo-match-fixtures';

const ROTATION_DEG = 21.75;

/** A labelled survey: `count` points, each with a TEXT holding its number, offset by 1.2 m. */
function labelledScene(count: number, seed: number, labelCount = count): {
  entities: Entity[];
  survey: TopoPoint[];
} {
  const local = scatter(count, 150_000, seed);
  const world = local.map((p) => place(p, ROTATION_DEG, EGSA_ORIGIN));
  const labels = local.slice(0, labelCount).map((p, i) => labelEntity(p, String(i + 1), i));
  return { entities: [...pointEntities(local), ...labels], survey: surveyPoints(world, true) };
}

describe('matchByPointNumber — η', () => {
  it('fits exactly from 52 labelled points, with sub-millimetre residual', () => {
    const { entities, survey } = labelledScene(93, 6_400, 52);
    const nodes = collectCandidatePoints(entities);

    const match = matchByPointNumber(entities, nodes, survey);

    expect(match).not.toBeNull();
    expect(match!.labelled).toBe(52);
    expect(match!.ambiguous).toBe(0);
    // Every label is accounted for: either it fitted, or it was reported as a blunder. A label
    // that vanished from both counts would mean the channel dropped evidence silently.
    expect(match!.pairs.length + match!.rejected).toBe(52);
    expect(match!.pairs.length).toBeGreaterThanOrEqual(45);
    expect(match!.solution.rmsMm).toBeLessThan(1);
    expect(match!.solution.geo.rotationDeg).toBeCloseTo(ROTATION_DEG, 6);
    expect(match!.solution.scaleEstimate).toBeCloseTo(1, 6);
  });

  it('snaps each label to its POINT, not to the label\'s own drawing position', () => {
    // If the fit used label positions the 1.2 m draughting offset would land in originWorld,
    // and the residual would still look small — which is exactly why this is asserted directly.
    const { entities, survey } = labelledScene(40, 77);
    const match = matchByPointNumber(entities, collectCandidatePoints(entities), survey);

    expect(match!.solution.geo.originWorld.x).toBeCloseTo(EGSA_ORIGIN.x, 3);
    expect(match!.solution.geo.originWorld.y).toBeCloseTo(EGSA_ORIGIN.y, 3);
  });

  it('matches `049` against `49` but never `S12` against `S13`', () => {
    const local = [{ x: 0, y: 0 }, { x: 50_000, y: 0 }, { x: 0, y: 40_000 }];
    const world = local.map((p) => place(p, 0, EGSA_ORIGIN));
    const entities: Entity[] = [
      ...pointEntities(local),
      labelEntity(local[0]!, '049', 0),
      labelEntity(local[1]!, ' S12 ', 1),
      labelEntity(local[2]!, 'S13', 2),
    ];
    const survey: TopoPoint[] = [
      { ...world[0]!, z: 0, pointNumber: '49' },
      { ...world[1]!, z: 0, pointNumber: 's12' },
      { ...world[2]!, z: 0, pointNumber: 'S99' },
    ];

    const match = matchByPointNumber(entities, collectCandidatePoints(entities), survey);

    // `049`→`49` and ` S12 `→`s12` match; `S13` is not a near-miss of `S99`, it is a non-match.
    expect(match!.pairs).toHaveLength(2);
  });

  it('discards a duplicated survey number rather than picking the first', () => {
    const local = [{ x: 0, y: 0 }, { x: 60_000, y: 0 }, { x: 0, y: 60_000 }];
    const world = local.map((p) => place(p, 0, EGSA_ORIGIN));
    const entities: Entity[] = [...pointEntities(local), labelEntity(local[0]!, '7', 0)];
    const survey: TopoPoint[] = [
      { ...world[0]!, z: 0, pointNumber: '7' },
      { ...world[1]!, z: 0, pointNumber: '7' },
      { ...world[2]!, z: 0, pointNumber: '8' },
    ];

    expect(matchByPointNumber(entities, collectCandidatePoints(entities), survey)).toBeNull();
  });

  it('retracts BOTH claims when two labels land on the same node', () => {
    const local = [{ x: 0, y: 0 }, { x: 80_000, y: 0 }, { x: 0, y: 80_000 }, { x: 80_000, y: 80_000 }];
    const world = local.map((p) => place(p, 0, EGSA_ORIGIN));
    const entities: Entity[] = [
      ...pointEntities(local),
      labelEntity(local[0]!, '1', 0, 100),
      labelEntity(local[0]!, '2', 1, 200), // a second label on the SAME point
      labelEntity(local[2]!, '3', 2, 100),
      labelEntity(local[3]!, '4', 3, 100),
    ];
    const survey = surveyPoints(world, true);

    const match = matchByPointNumber(entities, collectCandidatePoints(entities), survey);

    expect(match!.ambiguous).toBe(2);
    // `1` and `2` are both retracted; only the uncontested `3` and `4` remain.
    expect(match!.pairs).toHaveLength(2);
  });

  it('returns null when the survey carries no point numbers at all', () => {
    const { entities } = labelledScene(20, 5);
    const unnumbered = surveyPoints(scatter(20, 150_000, 5), false);
    expect(matchByPointNumber(entities, collectCandidatePoints(entities), unnumbered)).toBeNull();
  });
});

describe('autoMatchToSurvey — prefers the numbering channel over the blind search', () => {
  it('reports method `point-number` when labels are present', () => {
    const { entities, survey } = labelledScene(93, 6_400, 52);

    const result = autoMatchToSurvey({ entities, layersById: LAYERS, surveyPoints: survey });

    expect(result.method).toBe('point-number');
    expect(result.hypotheses).toBe(0); // nothing was guessed
    expect(result.rmsMm).toBeLessThan(1);
    expect(result.geo!.rotationDeg).toBeCloseTo(ROTATION_DEG, 6);
  });
});
