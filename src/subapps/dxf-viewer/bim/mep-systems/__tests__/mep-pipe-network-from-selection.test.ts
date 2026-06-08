/**
 * ADR-408 Φ13 — mep-pipe-network-from-selection (pure SSoT) tests.
 */

import {
  resolvePipeNetworkFromSelection,
  buildAddPipeMembersUpdate,
  pipeSegmentMembers,
} from '../mep-pipe-network-from-selection';
import type { Entity } from '../../../types/entities';
import type { MepSystemEntity, MepSystemParams } from '../../types/mep-system-types';
import {
  MANIFOLD_INLET_CONNECTOR_ID,
  MANIFOLD_OUTLET_CONNECTOR_ID_PREFIX,
  SEGMENT_START_CONNECTOR_ID,
  SEGMENT_END_CONNECTOR_ID,
} from '../../types/mep-connector-types';

const OUT0 = `${MANIFOLD_OUTLET_CONNECTOR_ID_PREFIX}0`;

function manifold(id: string, withConnectors = true, classification?: string): Entity {
  const connectors = withConnectors
    ? [
        { connectorId: MANIFOLD_INLET_CONNECTOR_ID, domain: 'pipe', flow: 'in', localPosition: { x: 0, y: 0, z: 0 } },
        { connectorId: OUT0, domain: 'pipe', flow: 'out', localPosition: { x: 0, y: 0, z: 0 } },
      ]
    : [];
  return {
    type: 'mep-manifold',
    id,
    params: { connectors, ...(classification ? { systemClassification: classification } : {}) },
  } as unknown as Entity;
}

function pipe(id: string): Entity {
  return { type: 'mep-segment', id, params: { domain: 'pipe' } } as unknown as Entity;
}

function duct(id: string): Entity {
  return { type: 'mep-segment', id, params: { domain: 'duct' } } as unknown as Entity;
}

/** A sanitary fixture (washbasin) with drain + cold + hot water connectors. */
function sanitaryFixture(id: string): Entity {
  return {
    type: 'mep-fixture',
    id,
    params: {
      kind: 'washbasin',
      connectors: [
        { connectorId: 'san-drain', domain: 'pipe', flow: 'out', localPosition: { x: 0, y: 0, z: 0 }, pipe: { systemClassification: 'sanitary-drainage', diameterMm: 40 } },
        { connectorId: 'san-cold', domain: 'pipe', flow: 'in', localPosition: { x: -1, y: 1, z: 0 }, pipe: { systemClassification: 'domestic-cold-water', diameterMm: 15 } },
        { connectorId: 'san-hot', domain: 'pipe', flow: 'in', localPosition: { x: 1, y: 1, z: 0 }, pipe: { systemClassification: 'domestic-hot-water', diameterMm: 15 } },
      ],
    },
  } as unknown as Entity;
}

function net(id: string, members: Array<[string, string]>, source = 'mfldX'): MepSystemEntity {
  const params: MepSystemParams = {
    systemType: 'pipe-network',
    name: id,
    systemClassification: 'domestic-cold-water',
    sourceEntityId: source,
    sourceConnectorId: OUT0,
    members: members.map(([entityId, connectorId]) => ({ entityId, connectorId })),
  };
  return { id, params };
}

describe('pipeSegmentMembers', () => {
  it('contributes both endpoint connectors of a pipe segment', () => {
    expect(pipeSegmentMembers(pipe('p1') as never)).toEqual([
      { entityId: 'p1', connectorId: SEGMENT_START_CONNECTOR_ID },
      { entityId: 'p1', connectorId: SEGMENT_END_CONNECTOR_ID },
    ]);
  });
});

describe('resolvePipeNetworkFromSelection', () => {
  it('resolves manifold (source) + pipes (members) into a draft', () => {
    const res = resolvePipeNetworkFromSelection([manifold('m1'), pipe('p1')], []);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.draft.sourceEntityId).toBe('m1');
    expect(res.draft.sourceConnectorId).toBe(OUT0);
    expect(res.draft.members).toEqual([
      { entityId: 'p1', connectorId: SEGMENT_START_CONNECTOR_ID },
      { entityId: 'p1', connectorId: SEGMENT_END_CONNECTOR_ID },
    ]);
    expect(res.draft.reassignRemovals).toEqual([]);
  });

  it('falls back to the canonical first outlet when the manifold has no connectors', () => {
    const res = resolvePipeNetworkFromSelection([manifold('m1', false), pipe('p1')], []);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.draft.sourceConnectorId).toBe(OUT0);
  });

  it('inherits the heating classification from the source manifold (ADR-408 Φ-heating)', () => {
    const res = resolvePipeNetworkFromSelection([manifold('m1', true, 'hydronic-supply'), pipe('p1')], []);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.draft.systemClassification).toBe('hydronic-supply');
  });

  it('defaults the network classification to domestic-cold-water for a pre-heating manifold', () => {
    const res = resolvePipeNetworkFromSelection([manifold('m1'), pipe('p1')], []);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.draft.systemClassification).toBe('domestic-cold-water');
  });

  it('admits a sanitary fixture as a member via its matching-classification connector', () => {
    // manifold defaults to domestic-cold-water → only the fixture's cold inlet joins.
    const res = resolvePipeNetworkFromSelection([manifold('m1'), pipe('p1'), sanitaryFixture('wb1')], []);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.draft.members).toContainEqual({ entityId: 'wb1', connectorId: 'san-cold' });
    expect(res.draft.members).not.toContainEqual({ entityId: 'wb1', connectorId: 'san-hot' });
    expect(res.draft.members).not.toContainEqual({ entityId: 'wb1', connectorId: 'san-drain' });
  });

  it('fails with no-source when no manifold is selected', () => {
    const res = resolvePipeNetworkFromSelection([pipe('p1')], []);
    expect(res).toEqual({ ok: false, reason: 'no-source' });
  });

  it('fails with multiple-sources when two manifolds are selected', () => {
    const res = resolvePipeNetworkFromSelection([manifold('m1'), manifold('m2'), pipe('p1')], []);
    expect(res).toEqual({ ok: false, reason: 'multiple-sources' });
  });

  it('fails with no-members when only duct segments accompany the manifold', () => {
    const res = resolvePipeNetworkFromSelection([manifold('m1'), duct('d1')], []);
    expect(res).toEqual({ ok: false, reason: 'no-members' });
  });

  it('moves a pipe wired elsewhere (reassign removal from the old network)', () => {
    const other = net('B', [['p1', SEGMENT_START_CONNECTOR_ID], ['p1', SEGMENT_END_CONNECTOR_ID], ['p9', SEGMENT_START_CONNECTOR_ID]], 'mfld2');
    const res = resolvePipeNetworkFromSelection([manifold('m1'), pipe('p1')], [other]);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.draft.reassignRemovals).toHaveLength(1);
    expect(res.draft.reassignRemovals[0]!.systemId).toBe('B');
    expect(res.draft.reassignRemovals[0]!.nextParams.members).toEqual([
      { entityId: 'p9', connectorId: SEGMENT_START_CONNECTOR_ID },
    ]);
  });
});

describe('buildAddPipeMembersUpdate', () => {
  it('adds a new pipe (two endpoint members) to the active network', () => {
    const active = net('A', [['p1', SEGMENT_START_CONNECTOR_ID], ['p1', SEGMENT_END_CONNECTOR_ID]], 'mfld1');
    const plan = buildAddPipeMembersUpdate(active, [pipe('p2')], [active]);
    expect(plan).not.toBeNull();
    expect(plan!.addedCount).toBe(1);
    expect(plan!.update.nextParams.members).toEqual([
      { entityId: 'p1', connectorId: SEGMENT_START_CONNECTOR_ID },
      { entityId: 'p1', connectorId: SEGMENT_END_CONNECTOR_ID },
      { entityId: 'p2', connectorId: SEGMENT_START_CONNECTOR_ID },
      { entityId: 'p2', connectorId: SEGMENT_END_CONNECTOR_ID },
    ]);
    expect(plan!.reassignRemovals).toEqual([]);
  });

  it('returns null when every selected pipe is already a member (idempotent)', () => {
    const active = net('A', [['p1', SEGMENT_START_CONNECTOR_ID], ['p1', SEGMENT_END_CONNECTOR_ID]], 'mfld1');
    expect(buildAddPipeMembersUpdate(active, [pipe('p1')], [active])).toBeNull();
  });

  it('ignores duct segments in the add selection', () => {
    const active = net('A', [], 'mfld1');
    expect(buildAddPipeMembersUpdate(active, [duct('d1')], [active])).toBeNull();
  });

  it('adds a sanitary fixture to a cold-water network via its cold connector only', () => {
    const active = net('A', [], 'mfld1'); // classification domestic-cold-water
    const plan = buildAddPipeMembersUpdate(active, [sanitaryFixture('wb1')], [active]);
    expect(plan).not.toBeNull();
    expect(plan!.addedCount).toBe(1);
    expect(plan!.update.nextParams.members).toEqual([{ entityId: 'wb1', connectorId: 'san-cold' }]);
  });
});
