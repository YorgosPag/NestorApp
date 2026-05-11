/**
 * ADR-344 Phase 6.A — Tests for ReplaceAllTextCommand.
 */

import { describe, it, expect } from '@jest/globals';
import { ReplaceAllTextCommand } from '../ReplaceAllTextCommand';
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

const PLAIN = { caseSensitive: false, wholeWord: false, regex: false };

function makeFooEntity(id: string): DxfTextSceneEntity {
  return makeTextEntity(id, {
    layer: '0',
    textNode: makeNode({ paragraphs: [makeParagraph([makeRun('foo bar foo')])] }),
  });
}

describe('ReplaceAllTextCommand', () => {
  it('replaces every occurrence across all selected entities', () => {
    const { scene, store } = makeScene([makeFooEntity('a'), makeFooEntity('b')]);
    const cmd = new ReplaceAllTextCommand(
      { entityIds: ['a', 'b'], pattern: 'foo', replacement: 'X', matchOptions: PLAIN },
      scene,
      makeLayerProvider({ '0': {} }),
    );
    cmd.execute();
    for (const id of ['a', 'b']) {
      const next = store.get(id) as DxfTextSceneEntity;
      const run0 = next.textNode.paragraphs[0].runs[0] as TextRun;
      expect(run0.text).toBe('X bar X');
    }
  });

  it('skips entities with no matches and does not snapshot them', () => {
    const a = makeFooEntity('a');
    const b = makeTextEntity('b', {
      textNode: makeNode({ paragraphs: [makeParagraph([makeRun('no match here')])] }),
    });
    const { scene } = makeScene([a, b]);
    const cmd = new ReplaceAllTextCommand(
      { entityIds: ['a', 'b'], pattern: 'foo', replacement: 'X', matchOptions: PLAIN },
      scene,
      makeLayerProvider({ '0': {} }),
    );
    cmd.execute();
    expect(cmd.getAffectedEntityIds()).toEqual(['a']);
  });

  it('undo restores every affected entity to its snapshot', () => {
    const a = makeFooEntity('a');
    const aNode = a.textNode;
    const { scene, store } = makeScene([a]);
    const cmd = new ReplaceAllTextCommand(
      { entityIds: ['a'], pattern: 'foo', replacement: 'X', matchOptions: PLAIN },
      scene,
      makeLayerProvider({ '0': {} }),
    );
    cmd.execute();
    cmd.undo();
    const restored = store.get('a') as DxfTextSceneEntity;
    expect(restored.textNode).toBe(aNode);
  });

  it('emits one audit entry per affected entity', () => {
    const rec = makeRecorder();
    const { scene } = makeScene([makeFooEntity('a'), makeFooEntity('b')]);
    const cmd = new ReplaceAllTextCommand(
      { entityIds: ['a', 'b'], pattern: 'foo', replacement: 'X', matchOptions: PLAIN },
      scene,
      makeLayerProvider({ '0': {} }),
      rec,
    );
    cmd.execute();
    expect(rec.events).toHaveLength(2);
    expect(rec.events.every((e) => e.action === 'updated')).toBe(true);
  });

  it('validate rejects an empty entity set or empty pattern', () => {
    const { scene } = makeScene();
    const provider = makeLayerProvider({});
    expect(
      new ReplaceAllTextCommand(
        { entityIds: [], pattern: 'x', replacement: 'y', matchOptions: PLAIN },
        scene,
        provider,
      ).validate(),
    ).toMatch(/entityIds/);
    expect(
      new ReplaceAllTextCommand(
        { entityIds: ['a'], pattern: '', replacement: 'y', matchOptions: PLAIN },
        scene,
        provider,
      ).validate(),
    ).toMatch(/pattern/);
  });
});
