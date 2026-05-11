/**
 * ADR-344 Phase 6.C — TextGripHandler tests.
 */

import { describe, it, expect } from '@jest/globals';
import { TextGripHandler } from '../TextGripHandler';
import { computeGrips } from '../TextGripGeometry';
import type {
  DxfTextSceneEntity,
  ILayerAccessProvider,
} from '../../../core/commands/text/types';
import type {
  ICommand,
  ICommandHistory,
  ISceneManager,
} from '../../../core/commands/interfaces';
import type { Rect } from '../../layout/attachment-point';
import type { DxfTextNode } from '../../types';

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeNode(rotation = 0): DxfTextNode {
  return {
    paragraphs: [
      {
        runs: [
          {
            text: 'X',
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
          },
        ],
        indent: 0,
        leftMargin: 0,
        rightMargin: 0,
        tabs: [],
        justification: 0,
        lineSpacingMode: 'multiple',
        lineSpacingFactor: 1,
      },
    ],
    attachment: 'TL',
    lineSpacing: { mode: 'multiple', factor: 1 },
    rotation,
    isAnnotative: false,
    annotationScales: [],
    currentScale: '',
  };
}

function makeEntity(over: Partial<DxfTextSceneEntity> = {}): DxfTextSceneEntity {
  return {
    id: 'ent_1',
    type: 'mtext',
    layer: '0',
    visible: true,
    position: { x: 0, y: 0 },
    textNode: makeNode(),
    ...over,
  };
}

const BBOX: Rect = { x: 0, y: 0, width: 10, height: 4 };

function makeDeps(initial: DxfTextSceneEntity[] = []): {
  sceneManager: ISceneManager;
  store: Map<string, DxfTextSceneEntity>;
  commandHistory: ICommandHistory & { executed: ICommand[] };
  layerProvider: ILayerAccessProvider;
} {
  const store = new Map<string, DxfTextSceneEntity>();
  for (const e of initial) store.set(e.id, e);
  const scene: ISceneManager = {
    addEntity: (e) => store.set(e.id, e as DxfTextSceneEntity),
    removeEntity: (id) => {
      store.delete(id);
    },
    getEntity: (id) => store.get(id),
    updateEntity: (id, u) => {
      const cur = store.get(id);
      if (!cur) return;
      store.set(id, { ...cur, ...u } as DxfTextSceneEntity);
    },
    updateVertex: () => {},
    insertVertex: () => {},
    removeVertex: () => {},
    getVertices: () => undefined,
  };
  const executed: ICommand[] = [];
  const history: ICommandHistory & { executed: ICommand[] } = {
    executed,
    execute: (c) => {
      executed.push(c);
      c.execute();
    },
    undo: () => false,
    redo: () => false,
    canUndo: () => false,
    canRedo: () => false,
    clear: () => {},
    getUndoStack: () => [],
    getRedoStack: () => [],
    getLastCommand: () => null,
    subscribe: () => () => {},
    size: () => executed.length,
    maxSize: () => 100,
  };
  const provider: ILayerAccessProvider = {
    getLayer: () => ({ name: '0', locked: false, frozen: false }),
    canUnlockLayer: true,
  };
  return { sceneManager: scene, store, commandHistory: history, layerProvider: provider };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('TextGripHandler — lifecycle', () => {
  it('starts idle and reports no ghost', () => {
    const deps = makeDeps();
    const h = new TextGripHandler(deps);
    expect(h.getStatus()).toBe('idle');
    expect(h.getGhost()).toBeNull();
  });

  it('beginDrag sets status to dragging', () => {
    const deps = makeDeps([makeEntity()]);
    const h = new TextGripHandler(deps);
    const grip = computeGrips(makeEntity(), BBOX, { rotationGripOffset: 1 })[0];
    h.beginDrag({ entity: makeEntity(), bbox: BBOX, grip, cursor: { x: 0, y: 0 } });
    expect(h.getStatus()).toBe('dragging');
  });

  it('cancel resets to idle without committing', () => {
    const deps = makeDeps([makeEntity()]);
    const h = new TextGripHandler(deps);
    const grip = h.getGrips(makeEntity(), BBOX).find((g) => g.kind === 'move')!;
    h.beginDrag({ entity: makeEntity(), bbox: BBOX, grip, cursor: { x: 0, y: 0 } });
    h.cancel();
    expect(h.getStatus()).toBe('idle');
    expect(deps.commandHistory.executed).toHaveLength(0);
  });
});

describe('TextGripHandler — move grip', () => {
  it('translates the entity by the cursor delta on commit', () => {
    const deps = makeDeps([makeEntity({ position: { x: 0, y: 0 } })]);
    const h = new TextGripHandler(deps);
    const grip = h.getGrips(makeEntity(), BBOX).find((g) => g.kind === 'move')!;
    h.beginDrag({ entity: makeEntity(), bbox: BBOX, grip, cursor: { x: 0, y: 0 } });
    h.updateDrag({ cursor: { x: 5, y: 3 } });
    h.commit();
    const next = deps.store.get('ent_1')!;
    expect(next.position).toEqual({ x: 5, y: 3 });
  });

  it('uses the snap point when provided', () => {
    const deps = makeDeps([makeEntity()]);
    const h = new TextGripHandler(deps);
    const grip = h.getGrips(makeEntity(), BBOX).find((g) => g.kind === 'move')!;
    h.beginDrag({ entity: makeEntity(), bbox: BBOX, grip, cursor: { x: 0, y: 0 } });
    h.updateDrag({ cursor: { x: 5, y: 3 }, snapPoint: { x: 4, y: 4 } });
    h.commit();
    expect(deps.store.get('ent_1')!.position).toEqual({ x: 4, y: 4 });
  });
});

describe('TextGripHandler — Direct Distance Entry', () => {
  it('applies the typed distance along the drag direction on commit', () => {
    const deps = makeDeps([makeEntity({ position: { x: 0, y: 0 } })]);
    const h = new TextGripHandler(deps);
    const grip = h.getGrips(makeEntity(), BBOX).find((g) => g.kind === 'move')!;
    h.beginDrag({ entity: makeEntity(), bbox: BBOX, grip, cursor: { x: 0, y: 0 } });
    // Direction = +X
    h.updateDrag({ cursor: { x: 1, y: 0 } });
    expect(h.pressKey('5')).toBe(true);
    h.updateDrag({ cursor: { x: 1, y: 0 } });
    h.commit();
    expect(deps.store.get('ent_1')!.position.x).toBeCloseTo(5, 6);
    expect(deps.store.get('ent_1')!.position.y).toBeCloseTo(0, 6);
  });

  it('returns false for keystrokes outside a drag', () => {
    const deps = makeDeps();
    const h = new TextGripHandler(deps);
    expect(h.pressKey('1')).toBe(false);
  });
});

describe('TextGripHandler — rotation grip', () => {
  it('overrides rotation when DDE is set, otherwise uses delta', () => {
    const deps = makeDeps([makeEntity()]);
    const h = new TextGripHandler(deps);
    const grip = h.getGrips(makeEntity(), BBOX).find((g) => g.kind === 'rotation')!;
    h.beginDrag({ entity: makeEntity(), bbox: BBOX, grip, cursor: grip.point });
    expect(h.pressKey('9')).toBe(true);
    expect(h.pressKey('0')).toBe(true);
    h.updateDrag({ cursor: grip.point });
    h.commit();
    expect(deps.store.get('ent_1')!.textNode.rotation).toBeCloseTo(90, 6);
  });
});

describe('TextGripHandler — mirror grip', () => {
  it('commit flips rotation by +180° regardless of drag distance', () => {
    const deps = makeDeps([makeEntity({ textNode: makeNode(20) })]);
    const h = new TextGripHandler(deps);
    const grip = h.getGrips(makeEntity({ textNode: makeNode(20) }), BBOX).find(
      (g) => g.kind === 'mirror',
    )!;
    h.beginDrag({
      entity: makeEntity({ textNode: makeNode(20) }),
      bbox: BBOX,
      grip,
      cursor: grip.point,
    });
    h.commit();
    expect(deps.store.get('ent_1')!.textNode.rotation).toBe(200);
  });
});

describe('TextGripHandler — resize grips', () => {
  it('updates MTEXT column width on resize-br', () => {
    const entity = makeEntity({
      textNode: {
        ...makeNode(),
        columns: { type: 'static', count: 1, width: 10, gutter: 0 },
      },
    });
    const deps = makeDeps([entity]);
    const h = new TextGripHandler(deps);
    const grip = h.getGrips(entity, BBOX).find((g) => g.kind === 'resize-br')!;
    h.beginDrag({ entity, bbox: BBOX, grip, cursor: grip.point });
    h.updateDrag({ cursor: { x: grip.point.x + 5, y: grip.point.y } });
    h.commit();
    expect(deps.store.get('ent_1')!.textNode.columns!.width).toBeCloseTo(15, 6);
  });
});
