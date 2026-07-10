/**
 * ADR-632 Φ4.1 — CREATE-time stairwell trigger.
 *
 * Καλύπτει:
 *  · `reconcileAssociativeGeometryOnCreate` — type gate (σκάλα/πλάκα → cascade·
 *    κάθε άλλο create → no-op) + full-recompute convergence σε create ΚΑΙ undo.
 *  · `CreateBimEntityCommand` integration — σχεδίαση πλάκας πάνω από υπάρχουσα σκάλα
 *    → auto «well» opening εμφανίζεται ΑΜΕΣΩΣ· undo το σβήνει· redo το ξαναφτιάχνει.
 *
 * Η βαθιά συμπεριφορά του planner/coordinator (create/update/delete/idempotent) είναι
 * ήδη σε `geometry/stairs/__tests__/stairwell-opening-engine.test.ts` — εδώ ελέγχεται
 * ΜΟΝΟ το νέο create-time wiring.
 */

import type { Polygon3D } from '../../types/bim-base';
import type { Entity } from '../../../types/entities';
import type { SlabEntity } from '../../types/slab-types';
import type { StairEntity } from '../../types/stair-types';
import { reconcileAssociativeGeometryOnCreate } from '../associative-geometry-reconcile';
import { CreateBimEntityCommand } from '../../../core/commands/entity-commands/CreateBimEntityCommand';
import { createMockSceneManager } from '../../../core/commands/__tests__/mock-scene-manager';
import type { AnySceneEntity } from '../../../types/scene';

// ─── Fixtures (mirror stairwell-opening-engine.test.ts· tests jscpd-ignored) ──

function makeTread(x0: number, depth: number, z: number, y0 = 0, width = 1000): Polygon3D {
  return {
    vertices: [
      { x: x0, y: y0, z },
      { x: x0 + depth, y: y0, z },
      { x: x0 + depth, y: y0 + width, z },
      { x: x0, y: y0 + width, z },
    ],
  };
}

function makeRect(x0: number, y0: number, x1: number, y1: number, z = 0): Polygon3D {
  return {
    vertices: [
      { x: x0, y: y0, z },
      { x: x1, y: y0, z },
      { x: x1, y: y1, z },
      { x: x0, y: y1, z },
    ],
  };
}

const TREADS: Polygon3D[] = [
  makeTread(0, 300, 300),
  makeTread(300, 300, 600),
  makeTread(600, 300, 900),
  makeTread(900, 300, 1200),
];

function fakeStair(id = 'stair-1'): StairEntity {
  return {
    id,
    type: 'stair',
    geometry: {
      treads: TREADS,
      bbox: { min: { x: 0, y: 0, z: 0 }, max: { x: 1200, y: 1000, z: 1200 } },
    },
    params: {
      basePoint: { x: 0, y: 0, z: 0 },
      direction: 0,
      rise: 300,
      stepCount: 4,
      totalRise: 1200,
      totalRun: 1200,
      width: 1000,
      codeProfile: 'nok',
    },
  } as unknown as StairEntity;
}

/** Πλάκα οροφής (underside 2800 < Hmin 2200+nosing → παράβαση → opening). */
function fakeSlab(id = 'slab-1'): SlabEntity {
  return {
    id,
    type: 'slab',
    layerId: 'layer-bim',
    geometry: { polygon: makeRect(-500, -500, 2000, 1500, 3000) },
    params: {
      kind: 'floor',
      outline: makeRect(-500, -500, 2000, 1500, 3000),
      levelElevation: 3000,
      thickness: 200,
    },
  } as unknown as SlabEntity;
}

function fakeColumn(id = 'col-1'): Entity {
  return { id, type: 'column', params: { width: 400 } } as unknown as Entity;
}

/** Πόσα auto stairwell openings υπάρχουν στη σκηνή. */
function autoOpeningCount(store: ReadonlyMap<string, unknown>): number {
  return [...store.values()].filter(
    (e) => (e as { type?: string }).type === 'slab-opening'
      && (e as { params?: { autoStairId?: string } }).params?.autoStairId,
  ).length;
}

// ─── reconcileAssociativeGeometryOnCreate ────────────────────────────────────

describe('reconcileAssociativeGeometryOnCreate', () => {
  it('πλάκα πάνω από σκάλα → auto well opening εμφανίζεται', () => {
    const sm = createMockSceneManager([fakeStair() as unknown as AnySceneEntity, fakeSlab() as unknown as AnySceneEntity]);
    reconcileAssociativeGeometryOnCreate(fakeSlab() as unknown as Entity, sm);
    expect(autoOpeningCount(sm.store)).toBe(1);
  });

  it('σκάλα κάτω από πλάκα → auto well opening εμφανίζεται', () => {
    const sm = createMockSceneManager([fakeSlab() as unknown as AnySceneEntity, fakeStair() as unknown as AnySceneEntity]);
    reconcileAssociativeGeometryOnCreate(fakeStair() as unknown as Entity, sm);
    expect(autoOpeningCount(sm.store)).toBe(1);
  });

  it('μη σκάλα/πλάκα create (κολόνα) → no-op (κανένα opening)', () => {
    const sm = createMockSceneManager([fakeStair() as unknown as AnySceneEntity, fakeSlab() as unknown as AnySceneEntity]);
    reconcileAssociativeGeometryOnCreate(fakeColumn(), sm);
    expect(autoOpeningCount(sm.store)).toBe(0);
  });

  it('idempotent — 2ο run πάνω στην ίδια σκηνή → κανένα διπλό opening', () => {
    const sm = createMockSceneManager([fakeStair() as unknown as AnySceneEntity, fakeSlab() as unknown as AnySceneEntity]);
    reconcileAssociativeGeometryOnCreate(fakeSlab() as unknown as Entity, sm);
    reconcileAssociativeGeometryOnCreate(fakeSlab() as unknown as Entity, sm);
    expect(autoOpeningCount(sm.store)).toBe(1);
  });

  it('undo convergence — ο host αφαιρέθηκε → σβήνει το orphan opening', () => {
    const sm = createMockSceneManager([fakeStair() as unknown as AnySceneEntity, fakeSlab() as unknown as AnySceneEntity]);
    reconcileAssociativeGeometryOnCreate(fakeSlab() as unknown as Entity, sm);
    expect(autoOpeningCount(sm.store)).toBe(1);
    // Προσομοίωση undo: αφαίρεσε την πλάκα, μετά τρέξε ξανά με τον τύπο της πλάκας.
    sm.store.delete('slab-1');
    reconcileAssociativeGeometryOnCreate(fakeSlab() as unknown as Entity, sm);
    expect(autoOpeningCount(sm.store)).toBe(0);
  });
});

// ─── CreateBimEntityCommand integration ──────────────────────────────────────

describe('CreateBimEntityCommand — ADR-632 Φ4.1 create-trigger', () => {
  it('execute (πλάκα πάνω από σκάλα) → πλάκα + auto opening στη σκηνή', () => {
    const sm = createMockSceneManager([fakeStair() as unknown as AnySceneEntity]);
    new CreateBimEntityCommand(fakeSlab() as unknown as AnySceneEntity, 'slab', sm).execute();
    expect(sm.store.has('slab-1')).toBe(true);
    expect(autoOpeningCount(sm.store)).toBe(1);
  });

  it('undo → πλάκα ΚΑΙ auto opening αφαιρούνται (atomic revert)', () => {
    const sm = createMockSceneManager([fakeStair() as unknown as AnySceneEntity]);
    const cmd = new CreateBimEntityCommand(fakeSlab() as unknown as AnySceneEntity, 'slab', sm);
    cmd.execute();
    expect(autoOpeningCount(sm.store)).toBe(1);
    cmd.undo();
    expect(sm.store.has('slab-1')).toBe(false);
    expect(autoOpeningCount(sm.store)).toBe(0);
  });

  it('redo → πλάκα + auto opening ξαναεμφανίζονται', () => {
    const sm = createMockSceneManager([fakeStair() as unknown as AnySceneEntity]);
    const cmd = new CreateBimEntityCommand(fakeSlab() as unknown as AnySceneEntity, 'slab', sm);
    cmd.execute();
    cmd.undo();
    cmd.redo();
    expect(sm.store.has('slab-1')).toBe(true);
    expect(autoOpeningCount(sm.store)).toBe(1);
  });

  it('create μη-δομικού (κολόνα) → κανένα stairwell opening (gate)', () => {
    const sm = createMockSceneManager([fakeStair() as unknown as AnySceneEntity, fakeSlab() as unknown as AnySceneEntity]);
    new CreateBimEntityCommand(fakeColumn() as unknown as AnySceneEntity, 'column', sm).execute();
    expect(autoOpeningCount(sm.store)).toBe(0);
  });
});
