/**
 * ADR-344 Phase 6.A — Tests for UpdateTextStyleCommand.
 */

import { describe, it, expect } from '@jest/globals';
import { UpdateTextStyleCommand } from '../UpdateTextStyleCommand';
import { CanEditLayerError } from '../types';
import type { DxfTextSceneEntity } from '../types';
import type { TextRun } from '../../../../text-engine/types';
import {
  makeLayerProvider,
  makeNode,
  makeParagraph,
  makeRecorder,
  makeRun,
  makeScene,
  makeTextEntity,
} from './test-fixtures';

function makeEntityWithMixedRuns(id: string): DxfTextSceneEntity {
  return makeTextEntity(id, {
    layer: '0',
    textNode: makeNode({
      paragraphs: [
        makeParagraph([makeRun('A', { bold: false }), makeRun('B', { italic: true })]),
        makeParagraph([makeRun('C', { underline: false })]),
      ],
    }),
  });
}

describe('UpdateTextStyleCommand', () => {
  it('applies the patch to every run of every paragraph', () => {
    const entity = makeEntityWithMixedRuns('ent_1');
    const { scene, store } = makeScene([entity]);
    const provider = makeLayerProvider({ '0': {} });
    const cmd = new UpdateTextStyleCommand(
      { entityId: 'ent_1', patch: { bold: true } },
      scene,
      provider,
    );
    cmd.execute();
    const next = store.get('ent_1') as DxfTextSceneEntity;
    for (const para of next.textNode.paragraphs) {
      for (const run of para.runs) {
        expect((run as TextRun).style.bold).toBe(true);
      }
    }
  });

  it('undo restores the original run styles', () => {
    const entity = makeEntityWithMixedRuns('ent_1');
    const { scene, store } = makeScene([entity]);
    const provider = makeLayerProvider({ '0': {} });
    const cmd = new UpdateTextStyleCommand(
      { entityId: 'ent_1', patch: { bold: true } },
      scene,
      provider,
    );
    cmd.execute();
    cmd.undo();
    const restored = store.get('ent_1') as DxfTextSceneEntity;
    expect(restored.textNode).toBe(entity.textNode);
  });

  it('blocks on a locked layer when the user lacks unlock capability', () => {
    const entity = makeTextEntity('ent_1', { layer: 'locked' });
    const { scene } = makeScene([entity]);
    const provider = makeLayerProvider({ locked: { locked: true } }, false);
    const cmd = new UpdateTextStyleCommand(
      { entityId: 'ent_1', patch: { bold: true } },
      scene,
      provider,
    );
    expect(() => cmd.execute()).toThrow(CanEditLayerError);
  });

  it('records exactly one audit entry on execute', () => {
    const { scene } = makeScene([makeTextEntity('ent_1', { layer: '0' })]);
    const provider = makeLayerProvider({ '0': {} });
    const rec = makeRecorder();
    const cmd = new UpdateTextStyleCommand(
      { entityId: 'ent_1', patch: { italic: true } },
      scene,
      provider,
      rec,
    );
    cmd.execute();
    expect(rec.events).toHaveLength(1);
    expect(rec.events[0].action).toBe('updated');
  });

  it('canMergeWith returns true for same entity, same command type', () => {
    const { scene } = makeScene([makeTextEntity('ent_1')]);
    const provider = makeLayerProvider({ '0': {} });
    const a = new UpdateTextStyleCommand({ entityId: 'ent_1', patch: { bold: true } }, scene, provider);
    const b = new UpdateTextStyleCommand({ entityId: 'ent_1', patch: { italic: true } }, scene, provider);
    expect(a.canMergeWith(b)).toBe(true);
  });

  it('mergeWith combines patches', () => {
    const { scene, store } = makeScene([makeTextEntity('ent_1')]);
    const provider = makeLayerProvider({ '0': {} });
    const a = new UpdateTextStyleCommand({ entityId: 'ent_1', patch: { bold: true } }, scene, provider);
    const b = new UpdateTextStyleCommand({ entityId: 'ent_1', patch: { italic: true } }, scene, provider);
    const merged = a.mergeWith(b);
    merged.execute();
    const next = store.get('ent_1') as DxfTextSceneEntity;
    const run = next.textNode.paragraphs[0].runs[0] as TextRun;
    expect(run.style.bold).toBe(true);
    expect(run.style.italic).toBe(true);
  });

  it('validate rejects an empty patch', () => {
    const { scene } = makeScene();
    const provider = makeLayerProvider({});
    const cmd = new UpdateTextStyleCommand({ entityId: 'x', patch: {} }, scene, provider);
    expect(cmd.validate()).toMatch(/patch/);
  });
});
