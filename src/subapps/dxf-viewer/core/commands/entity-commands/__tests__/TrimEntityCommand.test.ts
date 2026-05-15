/**
 * Tests for TrimEntityCommand (ADR-350 §Test Plan G10 — execute/undo round-trips).
 *
 * Uses a lightweight in-memory ISceneManager (store map) so tests are
 * pure and fast — no React, no Firestore, no browser APIs.
 */

import { TrimEntityCommand } from '../TrimEntityCommand';
import type { ISceneManager, SceneEntity } from '../../interfaces';
import type { TrimOperation } from '../../../../systems/trim/trim-types';
import type { LineEntity, ArcEntity } from '../../../../types/entities';

// ── Mock scene manager ────────────────────────────────────────────────────────

function makeSceneManager(initial: SceneEntity[] = []): { sm: ISceneManager; store: Map<string, SceneEntity> } {
  const store = new Map<string, SceneEntity>(initial.map((e) => [e.id, e]));
  const sm: ISceneManager = {
    addEntity: (e) => { store.set(e.id, e); },
    removeEntity: (id) => { store.delete(id); },
    getEntity: (id) => store.get(id),
    updateEntity: (id, updates) => {
      const cur = store.get(id);
      if (cur) store.set(id, { ...cur, ...updates });
    },
    updateVertex: () => {},
    insertVertex: () => {},
    removeVertex: () => {},
    getVertices: () => undefined,
  };
  return { sm, store };
}

// ── Entity fixtures ───────────────────────────────────────────────────────────

function makeLine(id: string, x1 = 0, y1 = 0, x2 = 10, y2 = 0): LineEntity {
  return { id, type: 'line', start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, layer: '0' };
}

function makeArc(id: string): ArcEntity {
  return { id, type: 'arc', center: { x: 0, y: 0 }, radius: 5, startAngle: 0, endAngle: Math.PI, layer: '0' };
}

const PICK = { x: 5, y: 0 };

// ── Helper to build a TrimEntityCommand ───────────────────────────────────────

function makeCmd(ops: TrimOperation[], sm: ISceneManager, inverse = false): TrimEntityCommand {
  return new TrimEntityCommand({ operations: ops, pickPoint: PICK, inverse }, sm);
}

// ── shorten ───────────────────────────────────────────────────────────────────

describe('TrimEntityCommand — shorten', () => {
  it('execute updates entity geometry', () => {
    const orig = makeLine('l1', 0, 0, 10, 0);
    const shortened = { ...orig, end: { x: 5, y: 0 } };
    const op: TrimOperation = { kind: 'shorten', entityId: 'l1', originalGeom: orig, newGeom: shortened };
    const { sm, store } = makeSceneManager([orig]);
    makeCmd([op], sm).execute();
    expect((store.get('l1') as LineEntity).end.x).toBeCloseTo(5);
  });

  it('undo restores original geometry', () => {
    const orig = makeLine('l1', 0, 0, 10, 0);
    const shortened = { ...orig, end: { x: 5, y: 0 } };
    const op: TrimOperation = { kind: 'shorten', entityId: 'l1', originalGeom: orig, newGeom: shortened };
    const { sm, store } = makeSceneManager([orig]);
    const cmd = makeCmd([op], sm);
    cmd.execute();
    cmd.undo();
    expect((store.get('l1') as LineEntity).end.x).toBeCloseTo(10);
  });
});

// ── split ─────────────────────────────────────────────────────────────────────

describe('TrimEntityCommand — split', () => {
  it('execute removes original and adds replacements', () => {
    const orig = makeLine('l1', 0, 0, 10, 0);
    const r1 = { ...orig, id: 'r1', end: { x: 3, y: 0 } };
    const r2 = { ...orig, id: 'r2', start: { x: 7, y: 0 } };
    const op: TrimOperation = { kind: 'split', entityId: 'l1', originalGeom: orig, replacements: [r1, r2] };
    const { sm, store } = makeSceneManager([orig]);
    makeCmd([op], sm).execute();
    expect(store.has('l1')).toBe(false);
    expect(store.has('r1')).toBe(true);
    expect(store.has('r2')).toBe(true);
  });

  it('undo removes replacements and restores original', () => {
    const orig = makeLine('l1', 0, 0, 10, 0);
    const r1 = { ...orig, id: 'r1', end: { x: 3, y: 0 } };
    const r2 = { ...orig, id: 'r2', start: { x: 7, y: 0 } };
    const op: TrimOperation = { kind: 'split', entityId: 'l1', originalGeom: orig, replacements: [r1, r2] };
    const { sm, store } = makeSceneManager([orig]);
    const cmd = makeCmd([op], sm);
    cmd.execute();
    cmd.undo();
    expect(store.has('l1')).toBe(true);
    expect(store.has('r1')).toBe(false);
    expect(store.has('r2')).toBe(false);
  });
});

// ── promote ───────────────────────────────────────────────────────────────────

describe('TrimEntityCommand — promote', () => {
  it('execute removes original and adds promoted entity', () => {
    const orig = { id: 'c1', type: 'circle' as const, center: { x: 0, y: 0 }, radius: 5, layer: '0' };
    const promoted = makeArc('c1');
    const op: TrimOperation = {
      kind: 'promote', entityId: 'c1',
      originalType: 'circle', originalGeom: orig,
      newType: 'arc', newGeom: promoted,
    };
    const { sm, store } = makeSceneManager([orig]);
    makeCmd([op], sm).execute();
    expect(store.get('c1')?.type).toBe('arc');
  });

  it('undo removes promoted entity and restores original', () => {
    const orig = { id: 'c1', type: 'circle' as const, center: { x: 0, y: 0 }, radius: 5, layer: '0' };
    const promoted = makeArc('c1');
    const op: TrimOperation = {
      kind: 'promote', entityId: 'c1',
      originalType: 'circle', originalGeom: orig,
      newType: 'arc', newGeom: promoted,
    };
    const { sm, store } = makeSceneManager([orig]);
    const cmd = makeCmd([op], sm);
    cmd.execute();
    cmd.undo();
    expect(store.get('c1')?.type).toBe('circle');
  });
});

// ── delete ────────────────────────────────────────────────────────────────────

describe('TrimEntityCommand — delete', () => {
  it('execute removes the entity', () => {
    const orig = makeLine('l1');
    const op: TrimOperation = { kind: 'delete', entityId: 'l1', originalGeom: orig };
    const { sm, store } = makeSceneManager([orig]);
    makeCmd([op], sm).execute();
    expect(store.has('l1')).toBe(false);
  });

  it('undo restores the deleted entity', () => {
    const orig = makeLine('l1');
    const op: TrimOperation = { kind: 'delete', entityId: 'l1', originalGeom: orig };
    const { sm, store } = makeSceneManager([orig]);
    const cmd = makeCmd([op], sm);
    cmd.execute();
    cmd.undo();
    expect(store.has('l1')).toBe(true);
  });

  it('undo without execute is a no-op', () => {
    const orig = makeLine('l1');
    const op: TrimOperation = { kind: 'delete', entityId: 'l1', originalGeom: orig };
    const { sm, store } = makeSceneManager([orig]);
    makeCmd([op], sm).undo();
    expect(store.has('l1')).toBe(true);
  });
});

// ── validate / metadata ───────────────────────────────────────────────────────

describe('TrimEntityCommand — validate + metadata', () => {
  it('validate returns error for empty operations', () => {
    const { sm } = makeSceneManager();
    const cmd = makeCmd([], sm);
    expect(cmd.validate()).not.toBeNull();
  });

  it('validate returns null for valid operations', () => {
    const orig = makeLine('l1');
    const op: TrimOperation = { kind: 'delete', entityId: 'l1', originalGeom: orig };
    const { sm } = makeSceneManager([orig]);
    expect(makeCmd([op], sm).validate()).toBeNull();
  });

  it('getDescription uses "Extend" when inverse=true', () => {
    const orig = makeLine('l1');
    const op: TrimOperation = { kind: 'delete', entityId: 'l1', originalGeom: orig };
    const { sm } = makeSceneManager([orig]);
    const cmd = makeCmd([op], sm, true);
    expect(cmd.getDescription()).toContain('Extend');
  });
});
