/**
 * ADR-363 §7.2 — `bim-clone-persistence` SSoT tests.
 *
 * Covers the clone-identity minting (per-type enterprise ID + fresh IFC GlobalId)
 * and the create / delete / restore EventBus broadcasts that make a cloned BIM
 * entity survive the Firestore subscription (the "copy flashes then vanishes" bug).
 */
import {
  isBimPersistedType,
  mintBimCloneIdentity,
  broadcastBimCloneCreated,
  broadcastBimCloneDeleted,
  broadcastBimCloneRestored,
} from '../bim-clone-persistence';
import { EventBus } from '../../../systems/events/EventBus';

describe('bim-clone-persistence — ADR-363 §7.2', () => {
  describe('isBimPersistedType', () => {
    it('accepts all 7 persisted BIM types', () => {
      for (const t of ['wall', 'opening', 'slab', 'slab-opening', 'column', 'beam', 'stair']) {
        expect(isBimPersistedType(t)).toBe(true);
      }
    });
    it('rejects non-BIM / undefined', () => {
      expect(isBimPersistedType('line')).toBe(false);
      expect(isBimPersistedType('rectangle')).toBe(false);
      expect(isBimPersistedType(undefined)).toBe(false);
    });
  });

  describe('mintBimCloneIdentity', () => {
    it('mints a per-type enterprise id + fresh ifcGuid for BIM types', () => {
      const wall = mintBimCloneIdentity('wall');
      expect(wall).not.toBeNull();
      expect(wall!.id).toMatch(/^wall_/i);
      expect(typeof wall!.ifcGuid).toBe('string');
      expect(wall!.ifcGuid.length).toBeGreaterThan(0);

      const column = mintBimCloneIdentity('column');
      expect(column!.id).toMatch(/^col/i);
    });
    it('returns two DISTINCT ids + ifcGuids on consecutive calls (no collision)', () => {
      const a = mintBimCloneIdentity('slab')!;
      const b = mintBimCloneIdentity('slab')!;
      expect(a.id).not.toBe(b.id);
      expect(a.ifcGuid).not.toBe(b.ifcGuid);
    });
    it('returns null for non-BIM entities', () => {
      expect(mintBimCloneIdentity('line')).toBeNull();
      expect(mintBimCloneIdentity(undefined)).toBeNull();
    });
  });

  describe('broadcastBimCloneCreated', () => {
    it('emits drawing:entity-created with tool = entity type', () => {
      const events: Array<{ tool: string; id: string }> = [];
      const off = EventBus.on('drawing:entity-created', (p) =>
        events.push({ tool: p.tool, id: p.entity.id }));
      broadcastBimCloneCreated({ id: 'wall_x', type: 'wall' });
      off();
      expect(events).toEqual([{ tool: 'wall', id: 'wall_x' }]);
    });
    it('is a no-op for non-BIM entities', () => {
      let count = 0;
      const off = EventBus.on('drawing:entity-created', () => { count++; });
      broadcastBimCloneCreated({ id: 'line_1', type: 'line' });
      off();
      expect(count).toBe(0);
    });
  });

  describe('broadcastBimCloneDeleted', () => {
    it('emits the per-type delete-requested with the right payload key', () => {
      const seen: Record<string, string> = {};
      const offs = [
        EventBus.on('bim:wall-delete-requested', (p) => { seen.wall = p.wallId; }),
        EventBus.on('bim:column-delete-requested', (p) => { seen.column = p.columnId; }),
        EventBus.on('bim:beam-delete-requested', (p) => { seen.beam = p.beamId; }),
        EventBus.on('bim:slab-delete-requested', (p) => { seen.slab = p.slabId; }),
        EventBus.on('bim:stair-delete-requested', (p) => { seen.stair = p.stairId; }),
      ];
      broadcastBimCloneDeleted({ id: 'wall_1', type: 'wall' });
      broadcastBimCloneDeleted({ id: 'col_1', type: 'column' });
      broadcastBimCloneDeleted({ id: 'beam_1', type: 'beam' });
      broadcastBimCloneDeleted({ id: 'slab_1', type: 'slab' });
      broadcastBimCloneDeleted({ id: 'stair_1', type: 'stair' });
      offs.forEach((o) => o());
      expect(seen).toEqual({
        wall: 'wall_1', column: 'col_1', beam: 'beam_1', slab: 'slab_1', stair: 'stair_1',
      });
    });
  });

  describe('broadcastBimCloneRestored', () => {
    it('emits bim:entity-restore-requested with source = redo-restore', () => {
      const payloads: Array<{ type: string; id: string; source: string }> = [];
      const off = EventBus.on('bim:entity-restore-requested', (p) =>
        payloads.push({ type: p.entityType, id: p.entitySnapshot.id, source: p.source }));
      broadcastBimCloneRestored({ id: 'wall_2', type: 'wall' });
      off();
      expect(payloads).toEqual([{ type: 'wall', id: 'wall_2', source: 'redo-restore' }]);
    });
    it('is a no-op for non-BIM entities', () => {
      let count = 0;
      const off = EventBus.on('bim:entity-restore-requested', () => { count++; });
      broadcastBimCloneRestored({ id: 'circle_1', type: 'circle' });
      off();
      expect(count).toBe(0);
    });
  });
});
