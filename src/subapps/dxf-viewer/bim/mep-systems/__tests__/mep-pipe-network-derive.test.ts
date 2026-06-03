/**
 * ADR-408 Φ10 — derivePipeNetworks tests (physical connectivity grouping).
 */

import type { Entity } from '../../../types/entities';
import {
  derivePipeNetworks,
  DEFAULT_DERIVED_PIPE_CLASSIFICATION,
} from '../mep-pipe-network-derive';
import {
  SEGMENT_START_CONNECTOR_ID,
  SEGMENT_END_CONNECTOR_ID,
} from '../../types/mep-connector-types';

const seg = (
  id: string,
  start: [number, number],
  end: [number, number],
  domain: 'duct' | 'pipe' = 'pipe',
): Entity =>
  ({
    id,
    type: 'mep-segment',
    params: {
      domain,
      sectionKind: 'round',
      startPoint: { x: start[0], y: start[1], z: 0 },
      endPoint: { x: end[0], y: end[1], z: 0 },
      centerlineElevationMm: 0,
    },
  } as unknown as Entity);

describe('derivePipeNetworks', () => {
  it('returns [] when there are no pipe segments', () => {
    expect(derivePipeNetworks([])).toEqual([]);
    expect(derivePipeNetworks([seg('d1', [0, 0], [10, 0], 'duct')])).toEqual([]);
  });

  it('groups two end-to-end touching segments into ONE network (4 members)', () => {
    const nets = derivePipeNetworks([
      seg('p1', [0, 0], [100, 0]),
      seg('p2', [100, 0], [200, 0]),
    ]);
    expect(nets).toHaveLength(1);
    expect(nets[0]!.members).toHaveLength(4);
    expect(nets[0]!.segmentIds).toEqual(['p1', 'p2']);
  });

  it('keeps two disjoint runs as TWO networks', () => {
    const nets = derivePipeNetworks([
      seg('p1', [0, 0], [100, 0]),
      seg('p2', [500, 500], [600, 500]),
    ]);
    expect(nets).toHaveLength(2);
  });

  it('deterministic source = lexicographically-smallest segment start connector', () => {
    const nets = derivePipeNetworks([
      seg('pB', [100, 0], [200, 0]),
      seg('pA', [0, 0], [100, 0]),
    ]);
    expect(nets).toHaveLength(1);
    expect(nets[0]!.sourceEntityId).toBe('pA');
    expect(nets[0]!.sourceConnectorId).toBe(SEGMENT_START_CONNECTOR_ID);
  });

  it('emits both endpoint connectors per segment as members', () => {
    const nets = derivePipeNetworks([seg('p1', [0, 0], [100, 0])]);
    expect(nets[0]!.members).toEqual([
      { entityId: 'p1', connectorId: SEGMENT_START_CONNECTOR_ID },
      { entityId: 'p1', connectorId: SEGMENT_END_CONNECTOR_ID },
    ]);
  });

  it('defaults classification to domestic cold water', () => {
    const nets = derivePipeNetworks([seg('p1', [0, 0], [100, 0])]);
    expect(nets[0]!.systemClassification).toBe(DEFAULT_DERIVED_PIPE_CLASSIFICATION);
    expect(nets[0]!.systemClassification).toBe('domestic-cold-water');
  });

  it('respects the join tolerance (endpoints within tol are connected)', () => {
    const within = derivePipeNetworks(
      [seg('p1', [0, 0], [100, 0]), seg('p2', [100.5, 0], [200, 0])],
      1,
    );
    expect(within).toHaveLength(1);
    const outside = derivePipeNetworks(
      [seg('p1', [0, 0], [100, 0]), seg('p2', [105, 0], [200, 0])],
      1,
    );
    expect(outside).toHaveLength(2);
  });

  it('groups a T-junction (3 segments sharing a node) into one network', () => {
    const nets = derivePipeNetworks([
      seg('p1', [0, 0], [100, 0]),
      seg('p2', [100, 0], [200, 0]),
      seg('p3', [100, 0], [100, 100]),
    ]);
    expect(nets).toHaveLength(1);
    expect(nets[0]!.segmentIds).toEqual(['p1', 'p2', 'p3']);
    expect(nets[0]!.members).toHaveLength(6);
  });
});
