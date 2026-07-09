/**
 * ADR-614 — Text command SSoT parity tests.
 *
 * Verifies the migrated text commands (BaseCommand / DxfTextCommandBase /
 * DxfTextNodeMutationCommand bases + shared resolve/audit free helpers) keep
 * their execute / undo / redo / serialize / validate / audit contract against a
 * real mock scene + LayerStore. Complements the per-command behaviour suites.
 */

import { UpdateTextStyleCommand } from '../UpdateTextStyleCommand';
import { UpdateTextCurrentScaleCommand } from '../UpdateTextCurrentScaleCommand';
import { DeleteTextCommand } from '../DeleteTextCommand';
import { InsertTextTokenCommand } from '../InsertTextTokenCommand';
import { ReplaceAllTextCommand } from '../ReplaceAllTextCommand';
import { CreateTextCommand } from '../CreateTextCommand';
import { CanEditLayerError } from '../types';
import type { DxfTextSceneEntity } from '../types';
import type { DxfTextNode } from '../../../../text-engine/types';
import {
  makeScene,
  makeTextEntity,
  makeLayerProvider,
  makeRecorder,
  makeNode,
} from './test-fixtures';

const firstRunBold = (node: DxfTextNode): boolean | undefined =>
  (node.paragraphs[0].runs[0] as { style: { bold?: boolean } }).style.bold;

const readEntity = (store: Map<string, unknown>, id: string): DxfTextSceneEntity =>
  store.get(id) as DxfTextSceneEntity;

describe('ADR-614 text command SSoT', () => {
  describe('BaseCommand envelope', () => {
    it('assigns id + timestamp and a well-formed serialize envelope', () => {
      const { scene } = makeScene([makeTextEntity('e1')]);
      const cmd = new UpdateTextCurrentScaleCommand(
        { entityId: 'e1', scaleName: '1:50' },
        scene,
        makeLayerProvider(),
      );

      expect(typeof cmd.id).toBe('string');
      expect(cmd.id.length).toBeGreaterThan(0);
      expect(typeof cmd.timestamp).toBe('number');
      expect(cmd.canMergeWith({ type: 'other' } as never)).toBe(false);

      const s = cmd.serialize();
      expect(s).toMatchObject({
        type: 'update-text-current-scale',
        id: cmd.id,
        name: 'UpdateTextCurrentScale',
        timestamp: cmd.timestamp,
        version: 1,
      });
      expect(s.data).toMatchObject({ entityId: 'e1', scaleName: '1:50' });
    });
  });

  describe('DxfTextCommandBase validation + affected ids', () => {
    it('rejects an empty entityId with the shared message', () => {
      const { scene } = makeScene();
      const cmd = new UpdateTextStyleCommand(
        { entityId: '', patch: { bold: true } },
        scene,
        makeLayerProvider(),
      );
      expect(cmd.validate()).toBe('entityId is required');
    });

    it('reports the single affected entity id', () => {
      const { scene } = makeScene([makeTextEntity('e9')]);
      const cmd = new DeleteTextCommand({ entityId: 'e9' }, scene, makeLayerProvider());
      expect(cmd.getAffectedEntityIds()).toEqual(['e9']);
    });
  });

  describe('DxfTextNodeMutationCommand lifecycle', () => {
    it('execute mutates the node, undo restores the snapshot, redo re-applies', () => {
      const { scene, store } = makeScene([makeTextEntity('e1', { textNode: makeNode() })]);
      const cmd = new UpdateTextStyleCommand(
        { entityId: 'e1', patch: { bold: true } },
        scene,
        makeLayerProvider(),
      );

      expect(firstRunBold(readEntity(store, 'e1').textNode)).toBe(false);
      cmd.execute();
      expect(firstRunBold(readEntity(store, 'e1').textNode)).toBe(true);
      cmd.undo();
      expect(firstRunBold(readEntity(store, 'e1').textNode)).toBe(false);
      cmd.redo();
      expect(firstRunBold(readEntity(store, 'e1').textNode)).toBe(true);
    });

    it('routes the audit event through the shared recorder helper', () => {
      const { scene } = makeScene([makeTextEntity('e1')]);
      const rec = makeRecorder();
      const cmd = new UpdateTextCurrentScaleCommand(
        { entityId: 'e1', scaleName: '1:100' },
        scene,
        makeLayerProvider(),
        rec,
      );
      cmd.execute();
      expect(rec.events).toEqual([{ action: 'updated', entityId: 'e1' }]);
    });
  });

  describe('shared guarded resolve (resolveEditableTextEntity)', () => {
    it('throws CanEditLayerError on a locked layer the user cannot unlock', () => {
      const { scene } = makeScene([makeTextEntity('e1', { layer: 'locked' })]);
      const provider = makeLayerProvider({ locked: { locked: true } }, false);
      const cmd = new UpdateTextStyleCommand(
        { entityId: 'e1', patch: { bold: true } },
        scene,
        provider,
      );
      expect(() => cmd.execute()).toThrow(CanEditLayerError);
    });

    it('no-ops (never mutates / never audits) when the entity is gone', () => {
      const { scene } = makeScene();
      const rec = makeRecorder();
      const cmd = new UpdateTextStyleCommand(
        { entityId: 'missing', patch: { bold: true } },
        scene,
        makeLayerProvider(),
        rec,
      );
      cmd.execute();
      cmd.undo();
      expect(rec.events).toHaveLength(0);
    });
  });

  describe('bespoke-lifecycle leaves still inherit the boilerplate', () => {
    it('InsertTextToken no-ops on an unknown token (guarded null path)', () => {
      const { scene, store } = makeScene([makeTextEntity('e1')]);
      const rec = makeRecorder();
      const before = readEntity(store, 'e1').textNode;
      const cmd = new InsertTextTokenCommand(
        { entityId: 'e1', token: 'zzz' },
        scene,
        makeLayerProvider(),
        rec,
      );
      cmd.execute();
      expect(readEntity(store, 'e1').textNode).toBe(before);
      expect(rec.events).toHaveLength(0);
    });

    it('DeleteText removes then restores the exact entity on undo', () => {
      const entity = makeTextEntity('e1');
      const { scene, store } = makeScene([entity]);
      const cmd = new DeleteTextCommand({ entityId: 'e1' }, scene, makeLayerProvider());
      cmd.execute();
      expect(store.has('e1')).toBe(false);
      cmd.undo();
      expect(store.get('e1')).toBe(entity);
    });
  });

  describe('multi-entity / no-layer outliers (BaseCommand + free helpers)', () => {
    it('ReplaceAll updates every matching entity and restores all on undo', () => {
      const node = (t: string): DxfTextNode =>
        makeNode({ paragraphs: [{ ...makeNode().paragraphs[0], runs: [{ ...makeNode().paragraphs[0].runs[0], text: t } as never] }] });
      const { scene, store } = makeScene([
        makeTextEntity('a', { textNode: node('foo bar') }),
        makeTextEntity('b', { textNode: node('foo baz') }),
      ]);
      const cmd = new ReplaceAllTextCommand(
        { entityIds: ['a', 'b'], pattern: 'foo', replacement: 'X', matchOptions: { caseSensitive: true, wholeWord: false, useRegex: false } },
        scene,
        makeLayerProvider(),
      );
      cmd.execute();
      expect(cmd.getAffectedEntityIds().sort()).toEqual(['a', 'b']);
      cmd.undo();
      const runText = (id: string): string =>
        (readEntity(store, id).textNode.paragraphs[0].runs[0] as { text: string }).text;
      expect(runText('a')).toBe('foo bar');
      expect(runText('b')).toBe('foo baz');
    });

    it('CreateText adds, undo removes, redo (BaseCommand default) re-adds same entity', () => {
      const { scene, store } = makeScene();
      const cmd = new CreateTextCommand(
        { position: { x: 1, y: 2 }, layer: '0', textNode: makeNode() },
        scene,
      );
      cmd.execute();
      const created = cmd.getCreatedEntity();
      expect(created).not.toBeNull();
      cmd.undo();
      expect(store.has(created!.id)).toBe(false);
      cmd.redo();
      expect(store.get(created!.id)).toBe(created);
    });
  });
});
