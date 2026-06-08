/**
 * ADR-422 L4 — tests για το hydraulic balancing engine (index circuit + kv).
 * jest globals (describe/it/expect) — ΟΧΙ vitest import.
 *
 * Τοπολογία (scene units 'mm'):
 *
 *     πηγή(0,0) ──S1(1m)── κόμβος(1000,0) ──S2(3m)── radA(1000,3000)   ← μακρύ
 *                                          └─S3(1m)── radB(2000,0)     ← κοντό
 *
 * Ίσες παροχές σωμάτων → ίδιο sizing στους κλάδους· η διαφορά ΔP_circuit προέρχεται
 * από το ΜΗΚΟΣ της διαδρομής → radA = index (δυσμενέστερο), radB έχει υπερβάλλουσα.
 * Ο κόμβος(1000,0) έχει degree 3 (S1/S2/S3) → tee ζ στους S2/S3· ο S1 (parent=ρίζα,
 * degree 1) → straight ζ=0.
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
import { sizePipeNetwork, type TerminalFlowContribution } from '../../sizing/pipe-network-sizing';
import { VELOCITY_FRICTION_STANDARD } from '../../sizing/velocity-friction-standard';
import { balanceNetwork } from '../circuit-balancing';
import {
  BALANCING_WATER_DENSITY_KG_M3,
  ZETA_TEE,
  ZETA_STRAIGHT,
} from '../balancing-config';

function makeSeg(id: string, x1: number, y1: number, x2: number, y2: number): MepSegmentEntity {
  const params: MepSegmentParams = {
    domain: 'pipe',
    sectionKind: 'round',
    startPoint: { x: x1, y: y1, z: 0 },
    endPoint: { x: x2, y: y2, z: 0 },
    centerlineElevationMm: 0,
    sceneUnits: 'mm',
  };
  return createMepSegment({ id, params, geometry: computeMepSegmentGeometry(params), layerId: 'layer-0' });
}

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
  return createMepRadiator({ id, params, geometry: computeMepRadiatorGeometry(params), layerId: 'layer-0' });
}

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
  return createMepManifold({ id, params, geometry: computeMepManifoldGeometry(params), layerId: 'layer-0' });
}

const STD = VELOCITY_FRICTION_STANDARD;
const terminals = (entries: Array<[string, TerminalFlowContribution]>) =>
  new Map<string, TerminalFlowContribution>(entries);

/** Δίκτυο με ένα μακρύ (radA) + ένα κοντό (radB) κύκλωμα, κοινός κορμός S1, πηγή. */
function asymmetricNetwork(): Entity[] {
  return [
    makeSeg('s1', 0, 0, 1000, 0),
    makeSeg('s2', 1000, 0, 1000, 3000),
    makeSeg('s3', 1000, 0, 2000, 0),
    makeRad('radA', 1000, 3000),
    makeRad('radB', 2000, 0),
    makeSource('src', 0, 0),
  ];
}

function runBalance(entities: Entity[], flows: Array<[string, TerminalFlowContribution]>) {
  const t = terminals(flows);
  const sizing = sizePipeNetwork({ entities, terminals: t, standard: STD });
  return { sizing, result: balanceNetwork({ entities, sizing, terminals: t }) };
}

describe('balanceNetwork — index circuit + balancing', () => {
  const flows: Array<[string, TerminalFlowContribution]> = [
    ['radA', { massFlowKgS: 0.05, loadW: 500 }],
    ['radB', { massFlowKgS: 0.05, loadW: 500 }],
  ];
  const { sizing, result } = runBalance(asymmetricNetwork(), flows);

  it('το μακρύ κύκλωμα (radA) είναι το index (δυσμενέστερο)', () => {
    expect(result.indexTerminalId).toBe('radA');
    expect(result.terminals.get('radA')!.isIndex).toBe(true);
    expect(result.terminals.get('radB')!.isIndex).toBe(false);
  });

  it('ΔP_radA > ΔP_radB (μεγαλύτερο μήκος διαδρομής)', () => {
    const a = result.terminals.get('radA')!.circuitDropPa;
    const b = result.terminals.get('radB')!.circuitDropPa;
    expect(a).toBeGreaterThan(b);
    expect(b).toBeGreaterThan(0);
  });

  it('το index δεν στραγγαλίζεται (kv=null, surplus=0)· το άλλο έχει finite kv', () => {
    const a = result.terminals.get('radA')!;
    const b = result.terminals.get('radB')!;
    expect(a.requiredKv).toBeNull();
    expect(a.surplusPa).toBeCloseTo(0, 6);
    expect(b.surplusPa).toBeGreaterThan(0);
    expect(b.requiredKv).not.toBeNull();
    expect(b.requiredKv!).toBeGreaterThan(0);
  });

  it('μανομετρικό κυκλοφορητή = ΔP του index (safety factor 1.0)', () => {
    expect(result.pumpHeadPa).toBeCloseTo(result.terminals.get('radA')!.circuitDropPa, 6);
  });

  it('ζ topology-derived: S2/S3 (parent=tee deg3) έχουν τοπική απώλεια, S1 (parent=ρίζα) όχι', () => {
    const ρ = BALANCING_WATER_DENSITY_KG_M3;
    const s2 = sizing.get('s2')!;
    const s3 = sizing.get('s3')!;
    const s1 = sizing.get('s1')!;
    // S2: 3m friction + tee local (ζ=1.0 · ρv²/2)
    const s2Expected = s2.frictionPaM * 3 + ZETA_TEE * (ρ * s2.velocityMS ** 2) / 2;
    const s3Expected = s3.frictionPaM * 1 + ZETA_TEE * (ρ * s3.velocityMS ** 2) / 2;
    // S1: 1m friction + straight (ζ=0) → καθαρή τριβή
    const s1Expected = s1.frictionPaM * 1 + ZETA_STRAIGHT * (ρ * s1.velocityMS ** 2) / 2;
    expect(result.segmentDropPa.get('s2')!).toBeCloseTo(s2Expected, 4);
    expect(result.segmentDropPa.get('s3')!).toBeCloseTo(s3Expected, 4);
    expect(result.segmentDropPa.get('s1')!).toBeCloseTo(s1Expected, 4);
  });

  it('κάθε σωλήνας έχει θετική πτώση πίεσης', () => {
    for (const segId of ['s1', 's2', 's3']) {
      expect(result.segmentDropPa.get(segId)!).toBeGreaterThan(0);
    }
  });
});

describe('balanceNetwork — degenerate', () => {
  it('κανένα entity → άδειο αποτέλεσμα, index null, μανομετρικό 0', () => {
    const result = balanceNetwork({ entities: [], sizing: new Map(), terminals: terminals([]) });
    expect(result.terminals.size).toBe(0);
    expect(result.indexTerminalId).toBeNull();
    expect(result.pumpHeadPa).toBe(0);
  });

  it('σωλήνες χωρίς τερματικά (κενό sizing/terminals) → άδειο αποτέλεσμα', () => {
    const entities = asymmetricNetwork();
    const result = balanceNetwork({ entities, sizing: new Map(), terminals: terminals([]) });
    expect(result.indexTerminalId).toBeNull();
  });
});
