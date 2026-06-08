/**
 * ADR-428 — Heating (Hydronic) Auto-Design (Slice 1): orchestrator integration tests.
 *
 * `designHeating` over a recognized storey: two networks (supply + return), correct
 * classifications, root-large/leaf-small diameters, flow conservation, the underfloor
 * (area-host, identity-transform connectors) path, and honest missing-endpoint warnings.
 */

import type { Entity } from '../../../../types/entities';
import { recognizeScene } from '../../../recognition/recognition-engine';
import { heatingTerminalRecognizer } from '../../../recognition/recognizers/heating-terminal-recognizer';
import { designHeating } from '../design-heating';

// ─── Scene builders ───────────────────────────────────────────────────────────

function radiator(id: string, x: number, y: number, thermalOutputW: number): Entity {
  return {
    id,
    type: 'mep-radiator',
    layerId: 'heating',
    params: {
      kind: 'panel-radiator',
      shape: 'rectangular',
      position: { x, y, z: 0 },
      rotation: 0,
      width: 1000,
      length: 100,
      bodyHeightMm: 600,
      mountingElevationMm: 450,
      connectorDiameterMm: 15,
      thermalOutputW,
      connectors: [
        {
          connectorId: 'rad-supply',
          domain: 'pipe',
          flow: 'in',
          localPosition: { x: 0, y: 0, z: 0 },
          pipe: { systemClassification: 'hydronic-supply', diameterMm: 15 },
        },
        {
          connectorId: 'rad-return',
          domain: 'pipe',
          flow: 'out',
          localPosition: { x: 0, y: 0, z: 0 },
          pipe: { systemClassification: 'hydronic-return', diameterMm: 15 },
        },
      ],
    },
  } as unknown as Entity;
}

/** An underfloor loop (area host: identity transform, connectors in world coords). */
function underfloor(id: string, cx: number, cy: number, thermalOutputW: number): Entity {
  return {
    id,
    type: 'mep-underfloor',
    layerId: 'heating',
    params: {
      kind: 'hydronic-loop',
      footprint: {
        vertices: [
          { x: cx - 500, y: cy - 500, z: 0 },
          { x: cx + 500, y: cy - 500, z: 0 },
          { x: cx + 500, y: cy + 500, z: 0 },
          { x: cx - 500, y: cy + 500, z: 0 },
        ],
      },
      pipeSpacingMm: 150,
      edgeClearanceMm: 100,
      patternType: 'boustrophedon',
      screedOffsetMm: 50,
      connectorDiameterMm: 16,
      thermalOutputW,
      connectors: [
        {
          connectorId: 'uf-supply',
          domain: 'pipe',
          flow: 'in',
          localPosition: { x: cx, y: cy, z: 0 },
          pipe: { systemClassification: 'hydronic-supply', diameterMm: 16 },
        },
        {
          connectorId: 'uf-return',
          domain: 'pipe',
          flow: 'out',
          localPosition: { x: cx, y: cy, z: 0 },
          pipe: { systemClassification: 'hydronic-return', diameterMm: 16 },
        },
      ],
    },
  } as unknown as Entity;
}

function boiler(id: string, x: number, y: number): Entity {
  return {
    id,
    type: 'mep-boiler',
    layerId: 'heating',
    params: {
      kind: 'wall-hung-gas',
      position: { x, y, z: 0 },
      rotation: 0,
      connectors: [
        {
          connectorId: 'boiler-supply',
          domain: 'pipe',
          flow: 'out',
          localPosition: { x: 0, y: 0, z: 0 },
          pipe: { systemClassification: 'hydronic-supply', diameterMm: 22 },
        },
        {
          connectorId: 'boiler-return',
          domain: 'pipe',
          flow: 'in',
          localPosition: { x: 0, y: 0, z: 0 },
          pipe: { systemClassification: 'hydronic-return', diameterMm: 22 },
        },
      ],
    },
  } as unknown as Entity;
}

function recognize(entities: readonly Entity[]) {
  return recognizeScene(
    { entities, storeyId: 'floor-1', sceneUnits: 'mm' },
    { recognizers: [heatingTerminalRecognizer] },
  );
}

// ─── Orchestrator ─────────────────────────────────────────────────────────────

describe('ADR-428 — designHeating orchestrator', () => {
  it('emits a supply + a return network with correct classifications', () => {
    const entities: Entity[] = [
      boiler('b', 0, 0),
      radiator('r1', 1500, 800, 2000),
      radiator('r2', 3000, 800, 1500),
    ];
    const proposal = designHeating(recognize(entities), entities);

    expect(proposal.networks).toHaveLength(2);
    const supply = proposal.networks.find((n) => n.role === 'supply')!;
    const ret = proposal.networks.find((n) => n.role === 'return')!;

    expect(supply.classification).toBe('hydronic-supply');
    expect(ret.classification).toBe('hydronic-return');
    expect(supply.sourceConnectorId).toBe('boiler-supply');
    expect(ret.sourceConnectorId).toBe('boiler-return');
    expect(supply.servedTerminalIds).toHaveLength(2);

    // Closed loop: supply and return carry the same total flow.
    expect(supply.totalFlowLps).toBeCloseTo(ret.totalFlowLps, 6);
    expect(supply.segments.length).toBeGreaterThan(0);
    expect(supply.segments.every((s) => s.networkRole === 'supply')).toBe(true);
    expect(ret.segments.every((s) => s.classification === 'hydronic-return')).toBe(true);
  });

  it('sizes the trunk (cumulative flow, near boiler) ≥ any branch', () => {
    const entities: Entity[] = [
      boiler('b', 0, 0),
      radiator('r1', 1500, 800, 3000),
      radiator('r2', 3000, 800, 3000),
      radiator('r3', 4500, 800, 3000),
    ];
    const proposal = designHeating(recognize(entities), entities);
    for (const net of proposal.networks) {
      const trunks = net.segments.filter((s) => s.role === 'trunk');
      const branches = net.segments.filter((s) => s.role === 'branch');
      expect(trunks.length).toBeGreaterThan(0);
      const maxTrunk = Math.max(...trunks.map((s) => s.diameterMm));
      const maxBranch = Math.max(...branches.map((s) => s.diameterMm));
      expect(maxTrunk).toBeGreaterThanOrEqual(maxBranch);
      // cumulative flow grows toward the boiler root (first trunk carries all three)
      const maxCumulative = Math.max(...net.segments.map((s) => s.cumulativeFlowLps));
      expect(maxCumulative).toBeCloseTo(net.totalFlowLps, 6);
    }
  });

  it('routes an underfloor loop as a point terminal (area host, identity connectors)', () => {
    const entities: Entity[] = [boiler('b', 0, 0), underfloor('uf', 2000, 1000, 4000)];
    const proposal = designHeating(recognize(entities), entities);

    expect(proposal.networks).toHaveLength(2);
    const supply = proposal.networks.find((n) => n.role === 'supply')!;
    expect(supply.servedConnectors).toEqual([{ entityId: 'uf', connectorId: 'uf-supply' }]);
    // the connector world point (identity transform) is the underfloor entry at (2000,1000)
    const reachesLoop = supply.segments.some((s) => s.end.x === 2000 && s.end.y === 1000);
    expect(reachesLoop).toBe(true);
  });

  it('warns and skips a network when its boiler endpoint is missing', () => {
    // Boiler-less scene → both supply and return are skipped with warnings.
    const entities: Entity[] = [radiator('r1', 1500, 800, 2000)];
    const proposal = designHeating(recognize(entities), entities);
    expect(proposal.networks).toHaveLength(0);
    expect(proposal.warnings.some((w) => w.includes('hydronic-supply'))).toBe(true);
    expect(proposal.warnings.some((w) => w.includes('hydronic-return'))).toBe(true);
  });

  it('emits nothing (no warnings) when there are no heating terminals', () => {
    const proposal = designHeating(recognize([boiler('b', 0, 0)]), [boiler('b', 0, 0)]);
    expect(proposal.networks).toHaveLength(0);
    expect(proposal.warnings).toHaveLength(0);
  });
});
