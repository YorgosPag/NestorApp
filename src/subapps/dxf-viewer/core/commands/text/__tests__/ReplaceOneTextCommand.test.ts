/**
 * ADR-344 Phase 6.A — Tests for ReplaceOneTextCommand.
 */

import { describe, it, expect } from '@jest/globals';
import { ReplaceOneTextCommand } from '../ReplaceOneTextCommand';
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

function makeEntity(): DxfTextSceneEntity {
  return makeTextEntity('ent_1', {
    layer: '0',
    textNode: makeNode({ paragraphs: [makeParagraph([makeRun('hello world')])] }),
  });
}

describe('ReplaceOneTextCommand', () => {
  it('replaces a single matched range', () => {
    const { scene, store } = makeScene([makeEntity()]);
    const cmd = new ReplaceOneTextCommand(
      {
        entityId: 'ent_1',
        location: { paragraphIndex: 0, runIndex: 0, start: 6, end: 11 },
        replacement: 'Giorgio',
        originalText: 'world',
      },
      scene,
      makeLayerProvider({ '0': {} }),
    );
    cmd.execute();
    const next = store.get('ent_1') as DxfTextSceneEntity;
    const run = next.textNode.paragraphs[0].runs[0] as TextRun;
    expect(run.text).toBe('hello Giorgio');
  });

  it('undo restores the original AST', () => {
    const e = makeEntity();
    const { scene, store } = makeScene([e]);
    const cmd = new ReplaceOneTextCommand(
      {
        entityId: 'ent_1',
        location: { paragraphIndex: 0, runIndex: 0, start: 0, end: 5 },
        replacement: 'HI',
        originalText: 'hello',
      },
      scene,
      makeLayerProvider({ '0': {} }),
    );
    cmd.execute();
    cmd.undo();
    expect((store.get('ent_1') as DxfTextSceneEntity).textNode).toBe(e.textNode);
  });

  it('records exactly one audit entry on a successful replacement', () => {
    const rec = makeRecorder();
    const { scene } = makeScene([makeEntity()]);
    const cmd = new ReplaceOneTextCommand(
      {
        entityId: 'ent_1',
        location: { paragraphIndex: 0, runIndex: 0, start: 0, end: 5 },
        replacement: 'HI',
        originalText: 'hello',
      },
      scene,
      makeLayerProvider({ '0': {} }),
      rec,
    );
    cmd.execute();
    expect(rec.events).toHaveLength(1);
  });

  it('does not record an audit entry if the location is invalid', () => {
    const rec = makeRecorder();
    const { scene } = makeScene([makeEntity()]);
    const cmd = new ReplaceOneTextCommand(
      {
        entityId: 'ent_1',
        location: { paragraphIndex: 0, runIndex: 0, start: 100, end: 200 },
        replacement: 'HI',
        originalText: 'oops',
      },
      scene,
      makeLayerProvider({ '0': {} }),
      rec,
    );
    cmd.execute();
    expect(rec.events).toHaveLength(0);
  });

  it('blocks on locked layer', () => {
    const { scene } = makeScene([makeTextEntity('ent_1', { layer: 'lock' })]);
    const cmd = new ReplaceOneTextCommand(
      {
        entityId: 'ent_1',
        location: { paragraphIndex: 0, runIndex: 0, start: 0, end: 1 },
        replacement: 'X',
        originalText: 'h',
      },
      scene,
      makeLayerProvider({ lock: { locked: true } }, false),
    );
    expect(() => cmd.execute()).toThrow(CanEditLayerError);
  });

  it('validate rejects start >= end', () => {
    const { scene } = makeScene();
    const cmd = new ReplaceOneTextCommand(
      {
        entityId: 'x',
        location: { paragraphIndex: 0, runIndex: 0, start: 5, end: 5 },
        replacement: 'X',
        originalText: '',
      },
      scene,
      makeLayerProvider({}),
    );
    expect(cmd.validate()).toMatch(/end/);
  });
});
