/**
 * ADR-408 Φ5 — resolveCircuitFromSelection (pure SSoT) tests.
 */

import { resolveCircuitFromSelection } from '../mep-circuit-from-selection';
import type { Entity } from '../../../types/entities';
import type { MepSystemEntity, MepSystemParams } from '../../types/mep-system-types';

function panel(id: string): Entity {
  return {
    type: 'electrical-panel',
    id,
    params: { connectors: [{ connectorId: 'out1', domain: 'electrical', flow: 'out', localPosition: { x: 0, y: 0 } }] },
  } as unknown as Entity;
}

function fixture(id: string): Entity {
  return {
    type: 'mep-fixture',
    id,
    params: { connectors: [{ connectorId: 'c1', domain: 'electrical', flow: 'in', localPosition: { x: 0, y: 0 } }] },
  } as unknown as Entity;
}

/** Legacy fixture/panel placed before the Φ1 connector retrofit — no connectors. */
function legacyFixture(id: string): Entity {
  return { type: 'mep-fixture', id, params: {} } as unknown as Entity;
}

function legacyPanel(id: string): Entity {
  return { type: 'electrical-panel', id, params: {} } as unknown as Entity;
}

function sys(id: string, members: Array<[string, string]>, source = 'pnlX'): MepSystemEntity {
  const params: MepSystemParams = {
    systemType: 'electrical-circuit',
    name: id,
    systemClassification: 'lighting',
    sourceEntityId: source,
    sourceConnectorId: 'out1',
    members: members.map(([entityId, connectorId]) => ({ entityId, connectorId })),
  };
  return { id, params };
}

describe('resolveCircuitFromSelection', () => {
  it('resolves source panel + member fixtures', () => {
    const res = resolveCircuitFromSelection([panel('pnl1'), fixture('fx1'), fixture('fx2')], []);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.draft.sourceEntityId).toBe('pnl1');
    expect(res.draft.sourceConnectorId).toBe('out1');
    expect(res.draft.members).toEqual([
      { entityId: 'fx1', connectorId: 'c1' },
      { entityId: 'fx2', connectorId: 'c1' },
    ]);
    expect(res.draft.reassignRemovals).toEqual([]);
  });

  it('errors when no panel is selected', () => {
    const res = resolveCircuitFromSelection([fixture('fx1')], []);
    expect(res).toEqual({ ok: false, reason: 'no-source' });
  });

  it('errors when more than one panel is selected', () => {
    const res = resolveCircuitFromSelection([panel('pnl1'), panel('pnl2'), fixture('fx1')], []);
    expect(res).toEqual({ ok: false, reason: 'multiple-sources' });
  });

  it('errors when no fixture is selected', () => {
    const res = resolveCircuitFromSelection([panel('pnl1')], []);
    expect(res).toEqual({ ok: false, reason: 'no-members' });
  });

  it('legacy panel + fixture (no embedded connectors) fall back to canonical ids', () => {
    const res = resolveCircuitFromSelection([legacyPanel('pnl1'), legacyFixture('fx1')], []);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.draft.sourceConnectorId).toBe('c1');           // PANEL_OUT_CONNECTOR_ID
    expect(res.draft.members).toEqual([{ entityId: 'fx1', connectorId: 'c1' }]); // FIXTURE_POWER_CONNECTOR_ID
  });

  it('produces a reassign removal for a fixture already wired elsewhere', () => {
    const existing = [sys('old', [['fx1', 'c1'], ['fx9', 'c1']])];
    const res = resolveCircuitFromSelection([panel('pnl1'), fixture('fx1')], existing);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.draft.reassignRemovals).toHaveLength(1);
    const removal = res.draft.reassignRemovals[0]!;
    expect(removal.systemId).toBe('old');
    // fx1 dropped from old; fx9 kept.
    expect(removal.nextParams.members).toEqual([{ entityId: 'fx9', connectorId: 'c1' }]);
  });

  it('no removal when the member is not wired anywhere yet', () => {
    const existing = [sys('old', [['fxOther', 'c1']])];
    const res = resolveCircuitFromSelection([panel('pnl1'), fixture('fx1')], existing);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.draft.reassignRemovals).toEqual([]);
  });
});
