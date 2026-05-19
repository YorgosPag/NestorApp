/**
 * ADR-363 Phase 7.1 Step 6.6 — bim-bulk-update-builder tests.
 *
 * Pure unit tests: ελέγχει dispatching + skip rules, χωρίς να εκτελεί τα
 * commands (recomputation pipelines έχουν δικά τους test suites).
 */

import { buildBulkUpdateCommand, type BimBulkEditPatch } from '../bim-bulk-update-builder';
import { CompoundCommand } from '../../../core/commands/CompoundCommand';
import { UpdateWallParamsCommand } from '../../../core/commands/entity-commands/UpdateWallParamsCommand';
import { UpdateOpeningParamsCommand } from '../../../core/commands/entity-commands/UpdateOpeningParamsCommand';
import { UpdateSlabParamsCommand } from '../../../core/commands/entity-commands/UpdateSlabParamsCommand';
import { UpdateColumnParamsCommand } from '../../../core/commands/entity-commands/UpdateColumnParamsCommand';
import { UpdateBeamParamsCommand } from '../../../core/commands/entity-commands/UpdateBeamParamsCommand';
import { UpdateStairParamsCommand } from '../../../core/commands/entity-commands/UpdateStairParamsCommand';
import type { ISceneManager, SceneEntity } from '../../../core/commands/interfaces';

function makeMockScene(entities: SceneEntity[]): ISceneManager {
  const map = new Map<string, SceneEntity>(entities.map((e) => [e.id, e]));
  return {
    getEntity: (id) => map.get(id),
    addEntity: () => {},
    removeEntity: () => {},
    updateEntity: () => {},
    updateEntities: () => {},
    getVertices: () => undefined,
    insertVertex: () => {},
    removeVertex: () => {},
    updateVertex: () => {},
    getEntityIndex: () => -1,
    reorderEntity: () => {},
    moveEntityToIndex: () => {},
  };
}

// Minimal entity stubs — builder reads `type` + `params` only.
const wall1: SceneEntity = {
  id: 'w1', type: 'wall', visible: true,
  params: { category: 'interior', start: { x: 0, y: 0, z: 0 }, end: { x: 1000, y: 0, z: 0 }, height: 2700, thickness: 150, flip: false },
};
const wall2: SceneEntity = { ...wall1, id: 'w2' };
const opening1: SceneEntity = {
  id: 'o1', type: 'opening', visible: true,
  params: { kind: 'door', wallId: 'w1', offsetFromStart: 500, width: 800, height: 2100, sillHeight: 0 },
};
const slab1: SceneEntity = {
  id: 's1', type: 'slab', visible: true,
  params: { kind: 'flat', outline: { vertices: [] }, elevation: 0, thickness: 200 },
};
const column1: SceneEntity = {
  id: 'c1', type: 'column', visible: true,
  params: { kind: 'rectangular', position: { x: 0, y: 0, z: 0 }, anchor: 'center', width: 300, depth: 300, height: 3000, rotation: 0 },
};
const beam1: SceneEntity = {
  id: 'b1', type: 'beam', visible: true,
  params: { kind: 'straight', startPoint: { x: 0, y: 0, z: 0 }, endPoint: { x: 5000, y: 0, z: 0 }, width: 300, depth: 500, elevation: 3000 },
};
const stair1: SceneEntity = {
  id: 'st1', type: 'stair', visible: true,
  params: { width: 1200, rise: 175, tread: 280 } as unknown as Record<string, unknown>,
};
const slabOpening1: SceneEntity = {
  id: 'so1', type: 'slab-opening', visible: true,
  params: { kind: 'rect', slabId: 's1', outline: { vertices: [] } },
};

describe('bim-bulk-update-builder', () => {
  describe('buildBulkUpdateCommand', () => {
    it('returns CompoundCommand', () => {
      const sm = makeMockScene([wall1]);
      const cmd = buildBulkUpdateCommand(['w1'], { height: 3000 }, sm);
      expect(cmd).toBeInstanceOf(CompoundCommand);
    });

    it('empty ids → empty compound (no-op)', () => {
      const sm = makeMockScene([]);
      const cmd = buildBulkUpdateCommand([], { height: 3000 }, sm);
      expect(cmd.size()).toBe(0);
    });

    it('empty patch → no child commands (all entities filtered)', () => {
      const sm = makeMockScene([wall1, opening1, slab1]);
      const cmd = buildBulkUpdateCommand(['w1', 'o1', 's1'], {}, sm);
      expect(cmd.size()).toBe(0);
    });

    it('missing entity skipped silently', () => {
      const sm = makeMockScene([wall1]);
      const cmd = buildBulkUpdateCommand(['w1', 'missing-id'], { height: 3000 }, sm);
      expect(cmd.size()).toBe(1);
    });

    it('slab-opening kind skipped (registry empty για Phase 7.1)', () => {
      const sm = makeMockScene([slabOpening1, wall1]);
      const cmd = buildBulkUpdateCommand(['so1', 'w1'], { height: 3000 }, sm);
      expect(cmd.size()).toBe(1);
      expect(cmd.commands[0]).toBeInstanceOf(UpdateWallParamsCommand);
    });
  });

  describe('per-kind dispatch (instance type per entity)', () => {
    it.each([
      ['wall',         wall1,     { height: 3000 },     UpdateWallParamsCommand],
      ['opening',      opening1,  { width: 900 },       UpdateOpeningParamsCommand],
      ['slab',         slab1,     { thickness: 250 },   UpdateSlabParamsCommand],
      ['column',       column1,   { width: 400 },       UpdateColumnParamsCommand],
      ['beam',         beam1,     { depth: 600 },       UpdateBeamParamsCommand],
      ['stair',        stair1,    { width: 1500 },      UpdateStairParamsCommand],
    ] as const)('%s → correct command class', (_kind, entity, patch, CommandClass) => {
      const sm = makeMockScene([entity]);
      const cmd = buildBulkUpdateCommand([entity.id], patch as BimBulkEditPatch, sm);
      expect(cmd.size()).toBe(1);
      expect(cmd.commands[0]).toBeInstanceOf(CommandClass);
    });
  });

  describe('patch key filtering per kind', () => {
    it('wall accepts height + thickness, ignores width', () => {
      const sm = makeMockScene([wall1]);
      const cmd = buildBulkUpdateCommand(['w1'], { width: 999, height: 3000 }, sm);
      expect(cmd.size()).toBe(1); // height accepted → command built
    });

    it('wall με μόνο width (ξένο κλειδί) → no command', () => {
      const sm = makeMockScene([wall1]);
      const cmd = buildBulkUpdateCommand(['w1'], { width: 999 }, sm);
      expect(cmd.size()).toBe(0);
    });

    it('opening accepts width + height + sillHeight, ignores thickness', () => {
      const sm = makeMockScene([opening1]);
      const cmd = buildBulkUpdateCommand(['o1'], { thickness: 200, width: 900 }, sm);
      expect(cmd.size()).toBe(1);
    });

    it('stair accepts only width — height ignored', () => {
      const sm = makeMockScene([stair1]);
      const cmd = buildBulkUpdateCommand(['st1'], { height: 3000 }, sm);
      expect(cmd.size()).toBe(0);
    });
  });

  describe('heterogeneous selection (mixed kinds)', () => {
    it('wall + slab + thickness patch → each gets command (shared key)', () => {
      const sm = makeMockScene([wall1, slab1]);
      const cmd = buildBulkUpdateCommand(['w1', 's1'], { thickness: 250 }, sm);
      expect(cmd.size()).toBe(2);
      expect(cmd.commands[0]).toBeInstanceOf(UpdateWallParamsCommand);
      expect(cmd.commands[1]).toBeInstanceOf(UpdateSlabParamsCommand);
    });

    it('wall + column + height patch → each gets command', () => {
      const sm = makeMockScene([wall1, column1]);
      const cmd = buildBulkUpdateCommand(['w1', 'c1'], { height: 3500 }, sm);
      expect(cmd.size()).toBe(2);
      expect(cmd.commands[0]).toBeInstanceOf(UpdateWallParamsCommand);
      expect(cmd.commands[1]).toBeInstanceOf(UpdateColumnParamsCommand);
    });

    it('homogeneous wall×3 + height → 3 commands', () => {
      const sm = makeMockScene([wall1, wall2, { ...wall1, id: 'w3' }]);
      const cmd = buildBulkUpdateCommand(['w1', 'w2', 'w3'], { height: 3000 }, sm);
      expect(cmd.size()).toBe(3);
      cmd.commands.forEach((c) => expect(c).toBeInstanceOf(UpdateWallParamsCommand));
    });
  });

  describe('CompoundCommand metadata', () => {
    it('name περιέχει count entities', () => {
      const sm = makeMockScene([wall1, wall2]);
      const cmd = buildBulkUpdateCommand(['w1', 'w2'], { height: 3000 }, sm);
      expect(cmd.name).toContain('2');
      expect(cmd.name).toContain('Bulk');
    });

    it('getAffectedEntityIds aggregates per child', () => {
      const sm = makeMockScene([wall1, opening1]);
      const cmd = buildBulkUpdateCommand(['w1', 'o1'], { height: 3000, width: 900 }, sm);
      const affected = cmd.getAffectedEntityIds().sort();
      expect(affected).toEqual(['o1', 'w1']);
    });
  });
});
