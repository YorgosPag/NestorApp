/**
 * ADR-390 — bim-entity-lifecycle-events SSoT (create broadcast + delete-event mapping).
 */

import {
  emitBimEntityCreated,
  emitBimEntityDeleteRequested,
} from '../bim-entity-lifecycle-events';
import { EventBus } from '../EventBus';
import type { AnySceneEntity } from '../../../types/scene';

describe('emitBimEntityCreated', () => {
  it('broadcasts drawing:entity-created with the entity + tool', () => {
    const seen: Array<{ id: string; tool: string }> = [];
    const off = EventBus.on('drawing:entity-created', (p) => seen.push({ id: p.entity.id, tool: p.tool }));
    emitBimEntityCreated({ id: 'col_1', type: 'column' } as unknown as AnySceneEntity, 'column');
    expect(seen).toEqual([{ id: 'col_1', tool: 'column' }]);
    off();
  });
});

describe('emitBimEntityDeleteRequested', () => {
  it('maps column → bim:column-delete-requested { columnId }', () => {
    const seen: string[] = [];
    const off = EventBus.on('bim:column-delete-requested', (p) => seen.push(p.columnId));
    emitBimEntityDeleteRequested('column', 'col_9');
    expect(seen).toEqual(['col_9']);
    off();
  });

  it('maps beam → bim:beam-delete-requested { beamId }', () => {
    const seen: string[] = [];
    const off = EventBus.on('bim:beam-delete-requested', (p) => seen.push(p.beamId));
    emitBimEntityDeleteRequested('beam', 'bm_1');
    expect(seen).toEqual(['bm_1']);
    off();
  });

  it('maps floor-finish → bim:floor-finish-delete-requested { id }', () => {
    const seen: string[] = [];
    const off = EventBus.on('bim:floor-finish-delete-requested', (p) => seen.push(p.id));
    emitBimEntityDeleteRequested('floor-finish', 'ff_2');
    expect(seen).toEqual(['ff_2']);
    off();
  });

  it('maps space-separator → bim:space-separator-delete-requested { id }', () => {
    const seen: string[] = [];
    const off = EventBus.on('bim:space-separator-delete-requested', (p) => seen.push(p.id));
    emitBimEntityDeleteRequested('space-separator', 'ss_3');
    expect(seen).toEqual(['ss_3']);
    off();
  });

  it('is a no-op for an unknown / non-persisted type (no throw, no event)', () => {
    let fired = 0;
    const offs = [
      EventBus.on('bim:column-delete-requested', () => { fired += 1; }),
      EventBus.on('bim:beam-delete-requested', () => { fired += 1; }),
    ];
    expect(() => emitBimEntityDeleteRequested('line', 'ln_1')).not.toThrow();
    expect(fired).toBe(0);
    offs.forEach((off) => off());
  });
});
