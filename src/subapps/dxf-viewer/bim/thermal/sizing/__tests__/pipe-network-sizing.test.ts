/**
 * ADR-422 L3 — tests για το pipe-network sizing walk (D5).
 * jest globals (describe/it/expect) — ΟΧΙ vitest import.
 *
 * Τοπολογία (scene units 'mm', κόμβοι >25mm μεταξύ τους):
 *
 *     πηγή(0,0) ──S1── κόμβος(1000,0) ──S2── radA(1000,1000)
 *                                      └─S3── radB(2000,0)
 *
 * Ο κορμός S1 κουβαλά radA+radB (μεγάλο DN)· οι κλάδοι S2/S3 ένα σώμα (μικρό DN).
 */

import { createMepSegment } from '@/services/factories/mep-segment.factory';
import { createMepRadiator } from '@/services/factories/mep-radiator.factory';
import { createMepManifold } from '@/services/factories/mep-manifold.factory';
import { computeMepSegmentGeometry } from '../../../geometry/mep-segment-geometry';
import { computeMepRadiatorGeometry } from '../../../mep-radiators/mep-radiator-geometry';
import { computeMepManifoldGeometry } from '../../../mep-manifolds/mep-manifold-geometry';
import type { MepSegmentEntity, MepSegmentParams } from '../../../types/mep-segment-types';
import type { MepRadiatorEntity, MepRadiatorParams } from '../../../types/mep-radiator-types';
import type { MepManifoldEntity, MepManifoldParams } from '../../../types/mep-manifold-types';
import type { MepConnector } from '../../../types/mep-connector-types';
import type { Entity } from '../../../../types/entities';
import {
  sizePipeNetwork,
  type TerminalFlowContribution,
} from '../pipe-network-sizing';
import { VELOCITY_FRICTION_STANDARD } from '../velocity-friction-standard';
import { MAX_VELOCITY_M_S } from '../pipe-sizing-config';

function makeSeg(id: string, x1: number, y1: number, x2: number, y2: number): MepSegmentEntity {
  const params: MepSegmentParams = {
    domain: 'pipe',
    sectionKind: 'round',
    startPoint: { x: x1, y: y1, z: 0 },
    endPoint: { x: x2, y: y2, z: 0 },
    centerlineElevationMm: 0,
    sceneUnits: 'mm',
  };
  return createMepSegment({
    id,
    params,
    geometry: computeMepSegmentGeometry(params),
    layerId: 'layer-0',
  });
}

/** Σώμα με ΕΝΑ pipe connector στο insertion point (localPosition 0 → world=position). */
function makeRad(id: string, x: number, y: number): MepRadiatorEntity {
  const connector: MepConnector = {
    connectorId: `${id}-c1`,
    domain: 'pipe',
    flow: 'in',
    localPosition: { x: 0, y: 0, z: 0 },
  };
  const params: MepRadiatorParams = {
    kind: 'panel-radiator',
    shape: 'rectangular',
    position: { x, y, z: 0 },
    rotation: 0,
    width: 1000,
    length: 100,
    bodyHeightMm: 600,
    mountingElevationMm: 450,
    connectorDiameterMm: 15,
    sceneUnits: 'mm',
    connectors: [connector],
  };
  return createMepRadiator({
    id,
    params,
    geometry: computeMepRadiatorGeometry(params),
    layerId: 'layer-0',
  });
}

/** Πηγή (συλλέκτης) με ΕΝΑ outlet connector στο insertion point. */
function makeSource(id: string, x: number, y: number): MepManifoldEntity {
  const connector: MepConnector = {
    connectorId: 'm-out-0',
    domain: 'pipe',
    flow: 'out',
    localPosition: { x: 0, y: 0, z: 0 },
  };
  const params: MepManifoldParams = {
    kind: 'floor-manifold',
    shape: 'rectangular',
    position: { x, y, z: 0 },
    rotation: 0,
    width: 200,
    length: 100,
    bodyHeightMm: 200,
    mountingElevationMm: 100,
    outletCount: 1,
    inletDiameterMm: 20,
    outletDiameterMm: 16,
    sceneUnits: 'mm',
    connectors: [connector],
  };
  return createMepManifold({
    id,
    params,
    geometry: computeMepManifoldGeometry(params),
    layerId: 'layer-0',
  });
}

const STD = VELOCITY_FRICTION_STANDARD;
const terminals = (entries: Array<[string, TerminalFlowContribution]>) =>
  new Map<string, TerminalFlowContribution>(entries);

function branchNetwork(): Entity[] {
  return [
    makeSeg('s1', 0, 0, 1000, 0),
    makeSeg('s2', 1000, 0, 1000, 1000),
    makeSeg('s3', 1000, 0, 2000, 0),
    makeRad('radA', 1000, 1000),
    makeRad('radB', 2000, 0),
  ];
}

describe('sizePipeNetwork — branch network (fallback root)', () => {
  const result = sizePipeNetwork({
    entities: branchNetwork(),
    terminals: terminals([
      ['radA', { massFlowKgS: 0.18, loadW: 2000 }],
      ['radB', { massFlowKgS: 0.05, loadW: 500 }],
    ]),
    standard: STD,
  });

  it('ο κορμός S1 κουβαλά το άθροισμα των δύο σωμάτων', () => {
    expect(result.get('s1')!.massFlowKgS).toBeCloseTo(0.23, 6);
    expect(result.get('s1')!.cumulativeLoadW).toBeCloseTo(2500, 6);
  });

  it('οι κλάδοι κουβαλούν ένα σώμα ο καθένας', () => {
    expect(result.get('s2')!.massFlowKgS).toBeCloseTo(0.18, 6);
    expect(result.get('s3')!.massFlowKgS).toBeCloseTo(0.05, 6);
    expect(result.get('s2')!.cumulativeLoadW).toBeCloseTo(2000, 6);
    expect(result.get('s3')!.cumulativeLoadW).toBeCloseTo(500, 6);
  });

  it('οι διάμετροι μικραίνουν προς τα τερματικά (S1 ≥ S2 ≥ S3· S3 < S1)', () => {
    const d1 = result.get('s1')!.dnMm;
    const d2 = result.get('s2')!.dnMm;
    const d3 = result.get('s3')!.dnMm;
    expect(d1).toBeGreaterThanOrEqual(d2);
    expect(d2).toBeGreaterThanOrEqual(d3);
    expect(d3).toBeLessThan(d1);
  });

  it('ταχύτητα εντός ορίου για μη-saturated τμήματα', () => {
    for (const r of result.values()) {
      if (!r.saturated) expect(r.velocityMS).toBeLessThanOrEqual(MAX_VELOCITY_M_S + 1e-9);
    }
  });
});

describe('sizePipeNetwork — explicit source re-roots the tree', () => {
  it('πηγή στη θέση του radB → ο κορμός S1 δεν κουβαλά φορτίο (radB στη ρίζα)', () => {
    const entities: Entity[] = [...branchNetwork(), makeSource('src', 2000, 0)];
    const result = sizePipeNetwork({
      entities,
      terminals: terminals([
        ['radA', { massFlowKgS: 0.18, loadW: 2000 }],
        ['radB', { massFlowKgS: 0.05, loadW: 500 }],
      ]),
      standard: STD,
    });
    // Ρίζα = κόμβος(2000,0): radB κάθεται στη ρίζα (δεν διασχίζει σωλήνα),
    // το radA τροφοδοτείται μέσω S3→S2. Ο S1 (προς 0,0) είναι αδιέξοδο = 0.
    expect(result.get('s1')!.massFlowKgS).toBeCloseTo(0, 6);
    expect(result.get('s3')!.massFlowKgS).toBeCloseTo(0.18, 6);
    expect(result.get('s2')!.massFlowKgS).toBeCloseTo(0.18, 6);
  });
});

describe('sizePipeNetwork — degenerate', () => {
  it('καμία σωλήνωση → άδειο map', () => {
    expect(sizePipeNetwork({ entities: [], terminals: terminals([]), standard: STD }).size).toBe(0);
  });

  it('σωλήνες χωρίς τερματικά → όλα μηδενική παροχή, ελάχιστο DN', () => {
    const result = sizePipeNetwork({
      entities: branchNetwork(),
      terminals: terminals([]),
      standard: STD,
    });
    expect(result.get('s1')!.massFlowKgS).toBe(0);
    expect(result.get('s1')!.dnMm).toBe(15);
  });
});
