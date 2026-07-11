/**
 * ADR-635 Φάση B Batch 2 Part B — a LEADER must scale with the canonical-mm import
 * factor like every other entity. Before the `case 'leader'` fix it fell through to
 * `default: {}`, so the callout stayed at raw DXF coordinates while the rest of the
 * drawing scaled → misplaced arrow in metre/cm files. These tests lock the SSoT case.
 */
import { scaleEntity } from '../scale-entity-transform';
import type { Entity } from '../../../types/entities';

function leader(): Entity {
  return {
    id: 'leader_0',
    type: 'leader',
    layerId: 'L1',
    visible: true,
    vertices: [{ x: 0, y: 0 }, { x: 2, y: 1 }],
    arrowHead: { type: 'closed', size: 2.5 },
    hookLineLength: 1,
  } as unknown as Entity;
}

describe('scaleEntity — leader (ADR-635 Φάση B Batch 2 Part B)', () => {
  const origin = { x: 0, y: 0 };

  it('κλιμακώνει τα vertices με τον mm factor (μέτρα → ×1000)', () => {
    const out = scaleEntity(leader(), origin, 1000, 1000) as {
      vertices: Array<{ x: number; y: number }>;
    };
    expect(out.vertices).toEqual([{ x: 0, y: 0 }, { x: 2000, y: 1000 }]);
  });

  it('κλιμακώνει το arrowHead.size + hookLineLength ως scalar (|sx|)', () => {
    const out = scaleEntity(leader(), origin, 1000, 1000) as {
      arrowHead: { type: string; size: number };
      hookLineLength: number;
    };
    expect(out.arrowHead).toEqual({ type: 'closed', size: 2500 });
    expect(out.hookLineLength).toBe(1000);
  });

  it('δεν πέφτει πλέον στο default {} (επιστρέφει scaled geometry)', () => {
    const out = scaleEntity(leader(), origin, 2, 2) as { vertices?: unknown };
    expect(out.vertices).toBeDefined();
  });
});
