/**
 * ADR-363 Phase 7A — BIM cascade resolver unit tests.
 *
 * Verifies host→hosted entity discovery, partition logic, and the two
 * composition helpers (expandSelectionForDelete + expandSelectionForMove).
 */

import {
  findHostedOpenings,
  findHostedSlabOpenings,
  findAttachedColumns,
  findEntitiesAttachedToHosts,
  partitionBimHosts,
  expandSelectionForDelete,
  expandSelectionForMove,
} from '../bim-cascade-resolver';
import type { Entity } from '../../../types/entities';

type AttachParams = { topBinding?: string; baseBinding?: string; attachTopToIds?: string[]; attachBaseToIds?: string[] };

/** Column with explicit top/base bindings + attach lists (ADR-401 host-delete reverse lookup). */
function attachedColumn(id: string, params: AttachParams): Entity {
  return { id, type: 'column', kind: 'rectangular', params } as unknown as Entity;
}

/** Wall with explicit bindings + attach lists (ADR-401 host-delete reverse lookup). */
function attachedWall(id: string, params: AttachParams): Entity {
  return { id, type: 'wall', kind: 'straight', params } as unknown as Entity;
}

/** Stair with explicit bindings + attach lists (ADR-401 Phase G attachable). */
function attachedStair(id: string, params: AttachParams): Entity {
  return { id, type: 'stair', kind: 'straight', params } as unknown as Entity;
}

function wall(id: string): Entity {
  return { id, type: 'wall', kind: 'straight' } as unknown as Entity;
}

function opening(id: string, wallId: string): Entity {
  return { id, type: 'opening', kind: 'door', params: { wallId } } as unknown as Entity;
}

function slab(id: string): Entity {
  return { id, type: 'slab', kind: 'floor' } as unknown as Entity;
}

function slabOpening(id: string, slabId: string): Entity {
  return { id, type: 'slab-opening', kind: 'shaft', params: { slabId } } as unknown as Entity;
}

function line(id: string): Entity {
  return { id, type: 'line' } as unknown as Entity;
}

describe('ADR-363 Phase 7A — BIM cascade resolver', () => {
  // ─── findHostedOpenings ────────────────────────────────────────────────

  describe('findHostedOpenings', () => {
    it('returns openings whose wallId is in the wall id set', () => {
      const entities = [
        wall('w1'),
        wall('w2'),
        opening('o1', 'w1'),
        opening('o2', 'w1'),
        opening('o3', 'w2'),
        opening('o4', 'w_other'),
      ];
      const result = findHostedOpenings(new Set(['w1']), entities);
      expect(result).toEqual(['o1', 'o2']);
    });

    it('excludes openings already in the exclude set (no duplication)', () => {
      const entities = [opening('o1', 'w1'), opening('o2', 'w1')];
      const result = findHostedOpenings(new Set(['w1']), entities, new Set(['o1']));
      expect(result).toEqual(['o2']);
    });

    it('returns empty array when wall set is empty', () => {
      const entities = [opening('o1', 'w1')];
      expect(findHostedOpenings(new Set(), entities)).toEqual([]);
    });

    it('ignores non-opening entities', () => {
      const entities = [wall('w1'), line('l1'), opening('o1', 'w1')];
      expect(findHostedOpenings(new Set(['w1']), entities)).toEqual(['o1']);
    });
  });

  // ─── findHostedSlabOpenings ────────────────────────────────────────────

  describe('findHostedSlabOpenings', () => {
    it('returns slab-openings whose slabId is in the slab id set', () => {
      const entities = [
        slab('s1'),
        slabOpening('so1', 's1'),
        slabOpening('so2', 's_other'),
        slabOpening('so3', 's1'),
      ];
      const result = findHostedSlabOpenings(new Set(['s1']), entities);
      expect(result).toEqual(['so1', 'so3']);
    });

    it('returns empty when slab set is empty', () => {
      expect(findHostedSlabOpenings(new Set(), [])).toEqual([]);
    });
  });

  // ─── partitionBimHosts ─────────────────────────────────────────────────

  describe('partitionBimHosts', () => {
    it('partitions selection into wall vs slab id sets', () => {
      const entities = [
        wall('w1'),
        wall('w2'),
        slab('s1'),
        opening('o1', 'w1'),
        line('l1'),
      ];
      const { wallIds, slabIds } = partitionBimHosts(['w1', 's1', 'o1', 'l1'], entities);
      expect([...wallIds]).toEqual(['w1']);
      expect([...slabIds]).toEqual(['s1']);
    });

    it('returns empty sets when no BIM hosts selected', () => {
      const { wallIds, slabIds } = partitionBimHosts(['l1'], [line('l1')]);
      expect(wallIds.size).toBe(0);
      expect(slabIds.size).toBe(0);
    });
  });

  // ─── expandSelectionForDelete ──────────────────────────────────────────

  describe('expandSelectionForDelete', () => {
    it('cascades wall→opening + slab→slab-opening atomically', () => {
      const entities = [
        wall('w1'),
        slab('s1'),
        opening('o1', 'w1'),
        opening('o2', 'w1'),
        slabOpening('so1', 's1'),
      ];
      const result = expandSelectionForDelete(['w1', 's1'], { entities });
      expect(result.ids).toEqual(['w1', 's1', 'o1', 'o2', 'so1']);
      expect(result.orphanedOpeningIds).toEqual(['o1', 'o2']);
      expect(result.orphanedSlabOpeningIds).toEqual(['so1']);
    });

    it('does not duplicate openings already in the selection', () => {
      const entities = [wall('w1'), opening('o1', 'w1')];
      const result = expandSelectionForDelete(['w1', 'o1'], { entities });
      expect(result.ids).toEqual(['w1', 'o1']);
      expect(result.orphanedOpeningIds).toEqual([]);
    });

    it('preserves original selection order, then appends orphans', () => {
      const entities = [slab('s1'), wall('w1'), opening('o1', 'w1'), slabOpening('so1', 's1')];
      const result = expandSelectionForDelete(['w1', 's1'], { entities });
      expect(result.ids[0]).toBe('w1');
      expect(result.ids[1]).toBe('s1');
    });

    it('no-op for pure DXF selection', () => {
      const entities = [line('l1'), line('l2')];
      const result = expandSelectionForDelete(['l1', 'l2'], { entities });
      expect(result.ids).toEqual(['l1', 'l2']);
      expect(result.orphanedOpeningIds).toEqual([]);
      expect(result.orphanedSlabOpeningIds).toEqual([]);
    });
  });

  // ─── expandSelectionForMove ────────────────────────────────────────────

  describe('expandSelectionForMove', () => {
    it('cascades slab→slab-opening only (walls do not cascade for move)', () => {
      const entities = [
        wall('w1'),
        slab('s1'),
        opening('o1', 'w1'), // must NOT be cascaded
        slabOpening('so1', 's1'),
        slabOpening('so2', 's1'),
      ];
      const result = expandSelectionForMove(['w1', 's1'], { entities });
      expect(result.ids).toEqual(['w1', 's1', 'so1', 'so2']);
      expect(result.cascadedSlabOpeningIds).toEqual(['so1', 'so2']);
    });

    it('no slab-openings cascaded when only wall in selection', () => {
      const entities = [wall('w1'), opening('o1', 'w1')];
      const result = expandSelectionForMove(['w1'], { entities });
      expect(result.ids).toEqual(['w1']);
      expect(result.cascadedSlabOpeningIds).toEqual([]);
    });

    it('does not duplicate slab-openings already in the selection', () => {
      const entities = [slab('s1'), slabOpening('so1', 's1')];
      const result = expandSelectionForMove(['s1', 'so1'], { entities });
      expect(result.ids).toEqual(['s1', 'so1']);
      expect(result.cascadedSlabOpeningIds).toEqual([]);
    });
  });

  // ─── findAttachedColumns (ADR-401 host-deletion detach reverse lookup) ───

  describe('findAttachedColumns', () => {
    it('partitions top/base columns whose attach list references a deleted host', () => {
      const entities = [
        attachedColumn('cTop', { topBinding: 'attached', attachTopToIds: ['beam1'] }),
        attachedColumn('cBase', { baseBinding: 'attached', attachBaseToIds: ['beam1'] }),
        attachedColumn('cBoth', { topBinding: 'attached', attachTopToIds: ['beam1'], baseBinding: 'attached', attachBaseToIds: ['beam1'] }),
        attachedColumn('cOther', { topBinding: 'attached', attachTopToIds: ['beam2'] }),
      ];
      const { topIds, baseIds } = findAttachedColumns(new Set(['beam1']), entities);
      expect(topIds.sort()).toEqual(['cBoth', 'cTop']);
      expect(baseIds.sort()).toEqual(['cBase', 'cBoth']);
    });

    it('skips columns whose side binding is not "attached"', () => {
      const entities = [
        attachedColumn('c1', { topBinding: 'storey-ceiling', attachTopToIds: ['beam1'] }),
        attachedColumn('c2', { baseBinding: 'storey-floor', attachBaseToIds: ['beam1'] }),
      ];
      const { topIds, baseIds } = findAttachedColumns(new Set(['beam1']), entities);
      expect(topIds).toEqual([]);
      expect(baseIds).toEqual([]);
    });

    it('no-ops on an empty host set or non-column entities', () => {
      const entities = [attachedColumn('c1', { topBinding: 'attached', attachTopToIds: ['beam1'] }), wall('w1')];
      expect(findAttachedColumns(new Set(), entities)).toEqual({ topIds: [], baseIds: [] });
      expect(findAttachedColumns(new Set(['beam1']), [wall('w1')])).toEqual({ topIds: [], baseIds: [] });
    });
  });

  // ─── findEntitiesAttachedToHosts (ADR-401 entity-agnostic reverse-lookup SSoT) ───

  describe('findEntitiesAttachedToHosts', () => {
    it('finds wall top-attached refs to a deleted host (the warning + detach lookup)', () => {
      const entities = [
        attachedWall('wTop', { topBinding: 'attached', attachTopToIds: ['beam1'] }),
        attachedWall('wOther', { topBinding: 'attached', attachTopToIds: ['beam2'] }),
        attachedWall('wPlain', { topBinding: 'storey-ceiling', attachTopToIds: ['beam1'] }),
      ];
      expect(findEntitiesAttachedToHosts(new Set(['beam1']), entities, 'top')).toEqual(['wTop']);
    });

    it('finds wall BASE-attached refs (the new wall base-detach path)', () => {
      const entities = [
        attachedWall('wBase', { baseBinding: 'attached', attachBaseToIds: ['fbeam1'] }),
        attachedWall('wBaseOther', { baseBinding: 'storey-floor', attachBaseToIds: ['fbeam1'] }),
      ];
      expect(findEntitiesAttachedToHosts(new Set(['fbeam1']), entities, 'base')).toEqual(['wBase']);
    });

    it('respects the entity-type guard (top side) — walls only / columns only', () => {
      const entities = [
        attachedWall('w1', { topBinding: 'attached', attachTopToIds: ['beam1'] }),
        attachedColumn('c1', { topBinding: 'attached', attachTopToIds: ['beam1'] }),
      ];
      expect(findEntitiesAttachedToHosts(new Set(['beam1']), entities, 'top', (e) => e.type === 'wall')).toEqual(['w1']);
      expect(findEntitiesAttachedToHosts(new Set(['beam1']), entities, 'top', (e) => e.type === 'column')).toEqual(['c1']);
    });

    it('default guard sweeps all attachable kinds (wall + column + stair)', () => {
      const entities = [
        attachedWall('w1', { topBinding: 'attached', attachTopToIds: ['beam1'] }),
        attachedColumn('c1', { topBinding: 'attached', attachTopToIds: ['beam1'] }),
        attachedStair('st1', { topBinding: 'attached', attachTopToIds: ['beam1'] }),
        wall('wPlain'), // no params → ignored
      ];
      expect(findEntitiesAttachedToHosts(new Set(['beam1']), entities, 'top').sort()).toEqual(['c1', 'st1', 'w1']);
    });

    it('no-ops on an empty host set', () => {
      const entities = [attachedWall('w1', { topBinding: 'attached', attachTopToIds: ['beam1'] })];
      expect(findEntitiesAttachedToHosts(new Set(), entities, 'top')).toEqual([]);
    });
  });
});
