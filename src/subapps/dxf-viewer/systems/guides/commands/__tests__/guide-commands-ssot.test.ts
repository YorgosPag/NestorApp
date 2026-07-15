/**
 * ADR-613 — Guide command SSoT parity tests.
 *
 * Verifies the migrated guide commands (BaseCommand / CreatedGuidesCommand /
 * BatchRotateGuidesCommand bases + shared geometry helpers) keep their
 * execute / undo / redo / serialize contract against a real GuideStore.
 */

import { GuideStore } from '../../guide-store';
import {
  CreateGuideCommand,
  CreateDiagonalGuideCommand,
  CreateGridFromPresetCommand,
} from '../guide-create-commands';
import { DeleteGuideCommand, BatchDeleteGuidesCommand } from '../guide-delete-commands';
import { RotateAllGuidesCommand, RotateGuideGroupCommand } from '../guide-rotate-commands';
import { MirrorGuidesCommand, CopyGuidePatternCommand, PolarArrayGuidesCommand } from '../guide-pattern-commands';
import { GuideFromEntityCommand, BatchGuideFromEntitiesCommand } from '../guide-entity-commands';

const makeStore = (): GuideStore => new GuideStore();

describe('ADR-613 guide command SSoT', () => {
  describe('BaseCommand envelope', () => {
    it('assigns id + timestamp and a well-formed serialize envelope', () => {
      const store = makeStore();
      const cmd = new CreateGuideCommand(store, 'X', 100);
      cmd.execute();

      expect(typeof cmd.id).toBe('string');
      expect(cmd.id.length).toBeGreaterThan(0);
      expect(typeof cmd.timestamp).toBe('number');
      expect(cmd.canMergeWith(cmd)).toBe(false);

      const s = cmd.serialize();
      expect(s).toMatchObject({
        type: 'create-guide',
        id: cmd.id,
        name: 'CreateGuide',
        timestamp: cmd.timestamp,
        version: 1,
      });
      expect(s.data).toMatchObject({ axis: 'X', offset: 100 });
    });
  });

  describe('CreatedGuidesCommand lifecycle (create)', () => {
    it('execute adds, undo removes, redo re-adds — same guide id', () => {
      const store = makeStore();
      const cmd = new CreateGuideCommand(store, 'Y', 250);

      cmd.execute();
      const created = cmd.getCreatedGuide();
      expect(created).not.toBeNull();
      expect(store.getGuides()).toHaveLength(1);
      expect(cmd.getAffectedEntityIds()).toEqual([created!.id]);

      cmd.undo();
      expect(store.getGuides()).toHaveLength(0);

      cmd.redo();
      expect(store.getGuides()).toHaveLength(1);
      expect(store.getGuides()[0].id).toBe(created!.id);
    });

    it('diagonal create produces one XZ guide', () => {
      const store = makeStore();
      const cmd = new CreateDiagonalGuideCommand(store, { x: 0, y: 0 }, { x: 10, y: 10 });
      cmd.execute();
      expect(store.getGuides()).toHaveLength(1);
      expect(store.getGuides()[0].axis).toBe('XZ');
    });
  });

  describe('CreateGridFromPresetCommand (group-aware, BaseCommand)', () => {
    it('creates X+Y guides under a group; undo clears both', () => {
      const store = makeStore();
      const cmd = new CreateGridFromPresetCommand(store, [0, 100], [0, 200, 400]);
      cmd.execute();
      expect(store.getGuides()).toHaveLength(5);
      expect(cmd.getAffectedEntityIds()).toHaveLength(5);

      cmd.undo();
      expect(store.getGuides()).toHaveLength(0);
    });
  });

  describe('Delete commands (BaseCommand)', () => {
    it('single delete removes then restores on undo', () => {
      const store = makeStore();
      const g = store.addGuideRaw('X', 42)!;
      const cmd = new DeleteGuideCommand(store, g.id);

      cmd.execute();
      expect(store.getGuides()).toHaveLength(0);
      cmd.undo();
      expect(store.getGuides()).toHaveLength(1);
    });

    it('batch delete removes all, restores all', () => {
      const store = makeStore();
      const a = store.addGuideRaw('X', 1)!;
      const b = store.addGuideRaw('Y', 2)!;
      const cmd = new BatchDeleteGuidesCommand(store, [a.id, b.id]);

      cmd.execute();
      expect(store.getGuides()).toHaveLength(0);
      expect(cmd.getAffectedEntityIds()).toHaveLength(2);
      cmd.undo();
      expect(store.getGuides()).toHaveLength(2);
    });
  });

  describe('BatchRotateGuidesCommand', () => {
    it('rotate-all affects every visible guide and restores on undo', () => {
      const store = makeStore();
      store.addGuideRaw('X', 100);
      store.addGuideRaw('Y', 200);

      const cmd = new RotateAllGuidesCommand(store, { x: 0, y: 0 }, 90);
      expect(cmd.getAffectedEntityIds()).toHaveLength(2);

      cmd.execute();
      // rotation converts X/Y guides to XZ segments
      expect(store.getGuides().every((g) => g.axis === 'XZ')).toBe(true);

      cmd.undo();
      expect(store.getGuides()).toHaveLength(2);
      const axes = store.getGuides().map((g) => g.axis).sort();
      expect(axes).toEqual(['X', 'Y']);
    });

    it('rotate-group only targets explicit ids', () => {
      const store = makeStore();
      const a = store.addGuideRaw('X', 100)!;
      store.addGuideRaw('Y', 200);

      const cmd = new RotateGuideGroupCommand(store, [a.id], { x: 0, y: 0 }, 45);
      expect(cmd.getAffectedEntityIds()).toEqual([a.id]);
    });
  });

  describe('Pattern commands (style-aware helper)', () => {
    it('mirror copies guides across an axis guide', () => {
      const store = makeStore();
      const axis = store.addGuideRaw('X', 0)!;
      store.addGuideRaw('X', 100);

      const cmd = new MirrorGuidesCommand(store, axis.id);
      expect(cmd.isValid).toBe(true);
      cmd.execute();
      // original 2 + one mirrored copy of the X=100 guide
      expect(store.getGuides()).toHaveLength(3);
    });

    it('copy pattern repeats source guides', () => {
      const store = makeStore();
      const src = store.addGuideRaw('X', 0)!;
      const cmd = new CopyGuidePatternCommand(store, [src.id], 50, 3);
      expect(cmd.isValid).toBe(true);
      cmd.execute();
      expect(store.getGuides()).toHaveLength(1 + 3);
    });

    it('polar array creates N radial guides', () => {
      const store = makeStore();
      const cmd = new PolarArrayGuidesCommand(store, { x: 0, y: 0 }, 4);
      expect(cmd.isValid).toBe(true);
      cmd.execute();
      expect(store.getGuides()).toHaveLength(4);
      expect(store.getGuides().every((g) => g.axis === 'XZ')).toBe(true);
    });
  });

  describe('Entity commands (shared buildGuidesFromEntityParams)', () => {
    it('CIRCLE → X + Y guides', () => {
      const store = makeStore();
      const cmd = new GuideFromEntityCommand(store, { entityType: 'CIRCLE', center: { x: 5, y: 7 } });
      cmd.execute();
      const axes = store.getGuides().map((g) => g.axis).sort();
      expect(axes).toEqual(['X', 'Y']);
    });

    it('batch mirrors the single-entity result per entity', () => {
      const store = makeStore();
      const cmd = new BatchGuideFromEntitiesCommand(store, [
        { entityType: 'CIRCLE', center: { x: 0, y: 0 } },
        { entityType: 'LINE', lineStart: { x: 0, y: 0 }, lineEnd: { x: 10, y: 0 } },
      ]);
      cmd.execute();
      // CIRCLE → 2 guides, LINE → 1 diagonal guide
      expect(store.getGuides()).toHaveLength(3);
    });
  });
});
