/**
 * ADR-344 Phase 6.A — Tests for CreateTextCommand.
 */

import { describe, it, expect } from '@jest/globals';
import { CreateTextCommand } from '../CreateTextCommand';
import type {
  DxfTextSceneEntity,
  IDxfTextAuditRecorder,
} from '../types';
import type { DxfTextNode, TextParagraph, TextRun } from '../../../../text-engine/types';
import type { ISceneManager, SceneEntity } from '../../interfaces';
import type { Point2D } from '../../../../rendering/types/Types';

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeRun(text: string): TextRun {
  return {
    text,
    style: {
      fontFamily: 'Arial',
      bold: false,
      italic: false,
      underline: false,
      overline: false,
      strikethrough: false,
      height: 2.5,
      widthFactor: 1,
      obliqueAngle: 0,
      tracking: 1,
      color: { kind: 'byLayer' },
    },
  };
}

function makeParagraph(text: string): TextParagraph {
  return {
    runs: [makeRun(text)],
    indent: 0,
    leftMargin: 0,
    rightMargin: 0,
    tabs: [],
    justification: 0,
    lineSpacingMode: 'multiple',
    lineSpacingFactor: 1,
  };
}

function makeSimpleNode(text: string): DxfTextNode {
  return {
    paragraphs: [makeParagraph(text)],
    attachment: 'TL',
    lineSpacing: { mode: 'multiple', factor: 1 },
    rotation: 0,
    isAnnotative: false,
    annotationScales: [],
    currentScale: '',
  };
}

function makeRichNode(): DxfTextNode {
  return {
    ...makeSimpleNode('A'),
    paragraphs: [makeParagraph('A'), makeParagraph('B')],
  };
}

function makeScene(): {
  scene: ISceneManager;
  added: Map<string, SceneEntity>;
} {
  const added = new Map<string, SceneEntity>();
  const scene: ISceneManager = {
    addEntity: (e) => {
      added.set(e.id, e);
    },
    removeEntity: (id) => {
      added.delete(id);
    },
    getEntity: (id) => added.get(id),
    updateEntity: () => {},
    updateVertex: () => {},
    insertVertex: () => {},
    removeVertex: () => {},
    getVertices: () => undefined,
  };
  return { scene, added };
}

function makeRecorder(): IDxfTextAuditRecorder & { calls: number; lastAction?: string } {
  const rec = {
    calls: 0,
    lastAction: undefined as string | undefined,
    record(ev: { action: string }) {
      this.calls += 1;
      this.lastAction = ev.action;
    },
  };
  return rec;
}

const POS: Point2D = { x: 10, y: 20 };

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('CreateTextCommand — entity type selection', () => {
  it('selects TEXT for a single-paragraph single-run node without columns', () => {
    const { scene, added } = makeScene();
    const cmd = new CreateTextCommand(
      { position: POS, layer: '0', textNode: makeSimpleNode('hello') },
      scene,
    );
    cmd.execute();
    const entity = [...added.values()][0] as DxfTextSceneEntity;
    expect(entity.type).toBe('text');
  });

  it('selects MTEXT for multi-paragraph nodes', () => {
    const { scene, added } = makeScene();
    const cmd = new CreateTextCommand(
      { position: POS, layer: '0', textNode: makeRichNode() },
      scene,
    );
    cmd.execute();
    expect([...added.values()][0].type).toBe('mtext');
  });

  it('selects MTEXT when columns are defined', () => {
    const { scene, added } = makeScene();
    const node: DxfTextNode = {
      ...makeSimpleNode('A'),
      columns: { type: 'static', count: 2, width: 50, gutter: 5 },
    };
    const cmd = new CreateTextCommand({ position: POS, layer: '0', textNode: node }, scene);
    cmd.execute();
    expect([...added.values()][0].type).toBe('mtext');
  });
});

describe('CreateTextCommand — execute / undo / redo round-trip', () => {
  it('adds, removes, re-adds the same entity instance', () => {
    const { scene, added } = makeScene();
    const cmd = new CreateTextCommand(
      { position: POS, layer: '0', textNode: makeSimpleNode('x') },
      scene,
    );
    cmd.execute();
    expect(added.size).toBe(1);
    const created = cmd.getCreatedEntity();
    expect(created).not.toBeNull();
    const id = created!.id;

    cmd.undo();
    expect(added.size).toBe(0);

    cmd.redo();
    expect(added.size).toBe(1);
    expect(added.get(id)).toBe(created);
  });

  it('reuses existingId when provided (ADR-057)', () => {
    const { scene } = makeScene();
    const cmd = new CreateTextCommand(
      { position: POS, layer: '0', textNode: makeSimpleNode('x'), existingId: 'ent_fixed' },
      scene,
    );
    cmd.execute();
    expect(cmd.getCreatedEntity()!.id).toBe('ent_fixed');
  });
});

describe('CreateTextCommand — audit (Q12)', () => {
  it('records "created" on execute and "deleted" on undo', () => {
    const { scene } = makeScene();
    const rec = makeRecorder();
    const cmd = new CreateTextCommand(
      { position: POS, layer: '0', textNode: makeSimpleNode('x') },
      scene,
      rec,
    );

    cmd.execute();
    expect(rec.calls).toBe(1);
    expect(rec.lastAction).toBe('created');

    cmd.undo();
    expect(rec.calls).toBe(2);
    expect(rec.lastAction).toBe('deleted');

    cmd.redo();
    expect(rec.calls).toBe(3);
    expect(rec.lastAction).toBe('created');
  });

  it('falls back to the no-op recorder when none is injected', () => {
    const { scene } = makeScene();
    const cmd = new CreateTextCommand(
      { position: POS, layer: '0', textNode: makeSimpleNode('x') },
      scene,
    );
    expect(() => cmd.execute()).not.toThrow();
  });
});

describe('CreateTextCommand — validate / serialize / affectedIds', () => {
  it('validate() returns null for a valid input', () => {
    const { scene } = makeScene();
    const cmd = new CreateTextCommand(
      { position: POS, layer: '0', textNode: makeSimpleNode('x') },
      scene,
    );
    expect(cmd.validate()).toBeNull();
  });

  it('validate() rejects empty layer', () => {
    const { scene } = makeScene();
    const cmd = new CreateTextCommand(
      { position: POS, layer: '', textNode: makeSimpleNode('x') },
      scene,
    );
    expect(cmd.validate()).toMatch(/layer/i);
  });

  it('validate() rejects empty paragraphs', () => {
    const { scene } = makeScene();
    const empty: DxfTextNode = { ...makeSimpleNode('x'), paragraphs: [] };
    const cmd = new CreateTextCommand({ position: POS, layer: '0', textNode: empty }, scene);
    expect(cmd.validate()).toMatch(/paragraph/i);
  });

  it('serialize() captures input + entityId after execute', () => {
    const { scene } = makeScene();
    const cmd = new CreateTextCommand(
      { position: POS, layer: '0', textNode: makeSimpleNode('x'), existingId: 'ent_42' },
      scene,
    );
    cmd.execute();
    const ser = cmd.serialize();
    expect(ser.type).toBe('create-text');
    expect(ser.data.entityId).toBe('ent_42');
    expect(ser.version).toBe(1);
  });

  it('getAffectedEntityIds returns [] before execute and [id] after', () => {
    const { scene } = makeScene();
    const cmd = new CreateTextCommand(
      { position: POS, layer: '0', textNode: makeSimpleNode('x'), existingId: 'ent_9' },
      scene,
    );
    expect(cmd.getAffectedEntityIds()).toEqual([]);
    cmd.execute();
    expect(cmd.getAffectedEntityIds()).toEqual(['ent_9']);
  });

  it('cannot be merged', () => {
    const { scene } = makeScene();
    const cmd = new CreateTextCommand(
      { position: POS, layer: '0', textNode: makeSimpleNode('x') },
      scene,
    );
    expect(cmd.canMergeWith()).toBe(false);
  });
});

