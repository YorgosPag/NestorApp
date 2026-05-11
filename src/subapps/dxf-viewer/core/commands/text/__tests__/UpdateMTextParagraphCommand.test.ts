/**
 * ADR-344 Phase 6.A — Tests for UpdateMTextParagraphCommand.
 */

import { describe, it, expect } from '@jest/globals';
import { UpdateMTextParagraphCommand } from '../UpdateMTextParagraphCommand';
import { CanEditLayerError } from '../types';
import type { DxfTextSceneEntity } from '../types';
import {
  makeLayerProvider,
  makeNode,
  makeParagraph,
  makeRecorder,
  makeRun,
  makeScene,
  makeTextEntity,
} from './test-fixtures';

function makeMultiParagraphEntity(): DxfTextSceneEntity {
  return makeTextEntity('ent_1', {
    textNode: makeNode({
      paragraphs: [
        makeParagraph([makeRun('A')]),
        makeParagraph([makeRun('B')]),
        makeParagraph([makeRun('C')]),
      ],
    }),
  });
}

describe('UpdateMTextParagraphCommand', () => {
  it('applies a paragraph patch to every paragraph when index is omitted', () => {
    const { scene, store } = makeScene([makeMultiParagraphEntity()]);
    const cmd = new UpdateMTextParagraphCommand(
      { entityId: 'ent_1', patch: { justification: 2 } },
      scene,
      makeLayerProvider({ '0': {} }),
    );
    cmd.execute();
    const next = store.get('ent_1') as DxfTextSceneEntity;
    for (const para of next.textNode.paragraphs) {
      expect(para.justification).toBe(2);
    }
  });

  it('applies a paragraph patch only to the selected index', () => {
    const { scene, store } = makeScene([makeMultiParagraphEntity()]);
    const cmd = new UpdateMTextParagraphCommand(
      { entityId: 'ent_1', patch: { indent: 5 }, paragraphIndex: 1 },
      scene,
      makeLayerProvider({ '0': {} }),
    );
    cmd.execute();
    const next = store.get('ent_1') as DxfTextSceneEntity;
    expect(next.textNode.paragraphs[0].indent).toBe(0);
    expect(next.textNode.paragraphs[1].indent).toBe(5);
    expect(next.textNode.paragraphs[2].indent).toBe(0);
  });

  it('updates the node-level columns when columns is provided', () => {
    const { scene, store } = makeScene([makeMultiParagraphEntity()]);
    const cmd = new UpdateMTextParagraphCommand(
      {
        entityId: 'ent_1',
        patch: {},
        columns: { type: 'static', count: 3, width: 80, gutter: 4 },
      },
      scene,
      makeLayerProvider({ '0': {} }),
    );
    cmd.execute();
    const next = store.get('ent_1') as DxfTextSceneEntity;
    expect(next.textNode.columns).toEqual({ type: 'static', count: 3, width: 80, gutter: 4 });
  });

  it('undo restores the snapshot', () => {
    const entity = makeMultiParagraphEntity();
    const { scene, store } = makeScene([entity]);
    const cmd = new UpdateMTextParagraphCommand(
      { entityId: 'ent_1', patch: { justification: 2 } },
      scene,
      makeLayerProvider({ '0': {} }),
    );
    cmd.execute();
    cmd.undo();
    const restored = store.get('ent_1') as DxfTextSceneEntity;
    expect(restored.textNode).toBe(entity.textNode);
  });

  it('blocks on locked layer when user cannot unlock', () => {
    const entity = makeTextEntity('ent_1', { layer: 'lock' });
    const { scene } = makeScene([entity]);
    const cmd = new UpdateMTextParagraphCommand(
      { entityId: 'ent_1', patch: { indent: 1 } },
      scene,
      makeLayerProvider({ lock: { locked: true } }, false),
    );
    expect(() => cmd.execute()).toThrow(CanEditLayerError);
  });

  it('records one audit entry per execute', () => {
    const rec = makeRecorder();
    const { scene } = makeScene([makeMultiParagraphEntity()]);
    const cmd = new UpdateMTextParagraphCommand(
      { entityId: 'ent_1', patch: { justification: 2 } },
      scene,
      makeLayerProvider({ '0': {} }),
      rec,
    );
    cmd.execute();
    expect(rec.events).toHaveLength(1);
    expect(rec.events[0].action).toBe('updated');
  });

  it('validate rejects when both patch and columns are absent', () => {
    const { scene } = makeScene();
    const cmd = new UpdateMTextParagraphCommand(
      { entityId: 'x', patch: {} },
      scene,
      makeLayerProvider({}),
    );
    expect(cmd.validate()).toMatch(/patch|columns/);
  });
});
