/**
 * MEP connector-projection merge adapter (ADR-408/ADR-390) — behavior lock.
 * Mirrors the former inline projection block shared by the 7 MEP persistence hooks.
 */
import { projectMepConnectorsOntoFresh, type MepConnectorEntity } from '../mep-connector-projection-merge';

interface Conn { connectorId: string; systemId?: string }
interface FixtureLike extends MepConnectorEntity {
  id: string;
  params: { connectors?: readonly Conn[]; label?: string };
}

const ent = (id: string, connectors: Conn[], label = 'x'): FixtureLike =>
  ({ id, params: { connectors, label } });

describe('projectMepConnectorsOntoFresh', () => {
  it('returns fresh unchanged on first add (existing = null)', () => {
    const fresh = ent('f1', [{ connectorId: 'c1', systemId: 's-doc' }]);
    expect(projectMepConnectorsOntoFresh(fresh, null)).toBe(fresh);
  });

  it('projects the live systemId onto the fresh entity (ignores the doc systemId)', () => {
    const fresh = ent('f1', [{ connectorId: 'c1', systemId: 's-doc' }]);
    const existing = ent('f1', [{ connectorId: 'c1', systemId: 's-live' }]);
    const out = projectMepConnectorsOntoFresh(fresh, existing);
    expect(out.params.connectors?.[0].systemId).toBe('s-live');
    expect(out).not.toBe(fresh); // new object when projection changed something
    expect(out.params.label).toBe('x'); // non-connector params preserved
  });

  it('identity-bails (returns fresh) when systemIds already agree', () => {
    const fresh = ent('f1', [{ connectorId: 'c1', systemId: 's' }]);
    const existing = ent('f1', [{ connectorId: 'c1', systemId: 's' }]);
    expect(projectMepConnectorsOntoFresh(fresh, existing)).toBe(fresh);
  });

  it('handles a fresh entity with no connectors', () => {
    const fresh = ent('f1', []);
    const existing = ent('f1', [{ connectorId: 'c1', systemId: 's' }]);
    expect(projectMepConnectorsOntoFresh(fresh, existing)).toBe(fresh);
  });
});
