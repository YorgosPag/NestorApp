/**
 * ADR-632 Φ5 — stair create = undoable `CreateBimEntityCommand`.
 *
 * Το `addStairToScene` είναι thin wrapper πάνω στο `appendEntityToScene` SSoT
 * (μοτίβο `add-column-to-scene`), με ΜΟΝΗ stair-specific λογική το floorId/buildingId
 * enrichment (ADR-358 Φ9C). Εδώ ελέγχεται ότι:
 *  · η δημιουργία σκάλας περνά από command → μπαίνει σε undo stack (Ctrl+Z την αναιρεί)·
 *  · το auto stairwell «well» opening ακολουθεί ΑΤΟΜΙΚΑ (create/undo/redo) — έρχεται από
 *    το create-time reconcile ΜΕΣΑ στο command, χωρίς χειροκίνητη κλήση (μηδέν διπλός cascade)·
 *  · διατηρούνται το `drawing:entity-created` broadcast (deferred) + ο floor stamp·
 *  · το undo εκπέμπει `bim:stair-delete-requested` (Firestore deleteDoc — όχι zombie).
 *
 * Η βαθιά συμπεριφορά planner/coordinator ζει στο
 * `geometry/stairs/__tests__/stairwell-opening-engine.test.ts` και το generic create-trigger
 * στο `cascade/__tests__/stairwell-create-trigger.test.ts` — εδώ ΜΟΝΟ το stair wrapper wiring.
 */

import type { Polygon3D } from '../../types/bim-base';
import type { SlabEntity } from '../../types/slab-types';
import type { StairEntity } from '../../types/stair-types';
import type { SceneModel, AnySceneEntity } from '../../../types/scene';
import { addStairToScene } from '../add-stair-to-scene';
import type { SceneAppendAccessor } from '../../scene/append-entity-to-scene';
import { EventBus } from '../../../systems/events/EventBus';
import {
  getGlobalCommandHistory,
  resetGlobalCommandHistory,
} from '../../../core/commands/CommandHistory';

// ─── Fixtures (mirror stairwell-create-trigger.test.ts· jscpd-ignored test fixtures) ──

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

/** Bare `Point3D[]` per tread — το πραγματικό `StairGeometry.treads` σχήμα (ADR-358). */
const GEOM_TREADS = TREADS.map((t) => t.vertices);

function fakeStair(id = 'stair-1'): StairEntity {
  return {
    id,
    type: 'stair',
    geometry: {
      treads: GEOM_TREADS,
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

// ─── Test harness — live scene ref + accessor (ο adapter διαβάζει live, ADR-527) ──

interface SceneRef {
  current: SceneModel | null;
}

function makeScene(entities: AnySceneEntity[] = []): SceneRef {
  return { current: { entities } as unknown as SceneModel };
}

function makeAccessor(scene: SceneRef, levelId: string | null = 'lvl1'): SceneAppendAccessor {
  return {
    currentLevelId: levelId,
    getLevelScene: (id) => (id === 'lvl1' ? scene.current : null),
    setLevelScene: (_id, s) => {
      scene.current = s;
    },
  };
}

function entityIds(scene: SceneRef): string[] {
  return (scene.current?.entities ?? []).map((e) => e.id);
}

/** Πόσα auto stairwell openings υπάρχουν στη σκηνή. */
function autoOpeningCount(scene: SceneRef): number {
  return (scene.current?.entities ?? []).filter(
    (e) =>
      (e as { type?: string }).type === 'slab-opening' &&
      (e as { params?: { autoStairId?: string } }).params?.autoStairId,
  ).length;
}

const NO_FLOOR = { floorId: null } as const;

beforeEach(() => {
  resetGlobalCommandHistory();
});

// ─── create ──────────────────────────────────────────────────────────────────

describe('addStairToScene — undoable create (ADR-632 Φ5)', () => {
  it('appends the stair (sync) + broadcasts drawing:entity-created (deferred, tool "stair")', async () => {
    const scene = makeScene();
    const events: Array<{ id: string; tool: string }> = [];
    const off = EventBus.on('drawing:entity-created', (p) => events.push({ id: p.entity.id, tool: p.tool }));

    addStairToScene(fakeStair(), makeAccessor(scene), NO_FLOOR, 'stair');

    // Scene mutation is synchronous (CreateBimEntityCommand.execute → adapter.addEntity).
    expect(entityIds(scene)).toContain('stair-1');
    // ADR-390 — persistence broadcast fires in a microtask (deferred).
    await Promise.resolve();
    expect(events).toEqual([{ id: 'stair-1', tool: 'stair' }]);
    off();
  });

  it('«Σκάλα από περιοχή» tag propagates (tool "stair-from-region")', async () => {
    const scene = makeScene();
    const events: string[] = [];
    const off = EventBus.on('drawing:entity-created', (p) => events.push(p.tool));

    addStairToScene(fakeStair(), makeAccessor(scene), NO_FLOOR, 'stair-from-region');

    await Promise.resolve();
    expect(events).toEqual(['stair-from-region']);
    off();
  });

  it('floor stamp — εμπλουτίζει με floorId/buildingId όταν δοθεί', () => {
    const scene = makeScene();
    addStairToScene(fakeStair(), makeAccessor(scene), { floorId: 'floor-1', buildingId: 'bld-1' }, 'stair');

    const stored = scene.current!.entities.find((e) => e.id === 'stair-1') as unknown as {
      floorId?: string;
      buildingId?: string;
    };
    expect(stored.floorId).toBe('floor-1');
    expect(stored.buildingId).toBe('bld-1');
  });

  it('floor stamp — χωρίς floorId ΔΕΝ κολλάει buildingId (μη-enriched)', () => {
    const scene = makeScene();
    addStairToScene(fakeStair(), makeAccessor(scene), { floorId: null, buildingId: 'bld-1' }, 'stair');

    const stored = scene.current!.entities.find((e) => e.id === 'stair-1') as unknown as {
      floorId?: string;
      buildingId?: string;
    };
    expect(stored.floorId).toBeUndefined();
    expect(stored.buildingId).toBeUndefined();
  });

  it('no-op όταν δεν υπάρχει ενεργό επίπεδο', async () => {
    const scene = makeScene();
    let fired = 0;
    const off = EventBus.on('drawing:entity-created', () => { fired += 1; });

    addStairToScene(fakeStair(), makeAccessor(scene, null), NO_FLOOR, 'stair');

    expect(entityIds(scene)).toHaveLength(0);
    await Promise.resolve();
    expect(fired).toBe(0);
    off();
  });

  it('no-op όταν το ενεργό επίπεδο δεν έχει σκηνή', async () => {
    const scene: SceneRef = { current: null };
    let fired = 0;
    const off = EventBus.on('drawing:entity-created', () => { fired += 1; });

    addStairToScene(fakeStair(), makeAccessor(scene), NO_FLOOR, 'stair');

    expect(scene.current).toBeNull();
    await Promise.resolve();
    expect(fired).toBe(0);
    off();
  });
});

// ─── auto «well» opening follows create / undo / redo ────────────────────────

describe('addStairToScene — auto stairwell opening follows undo/redo', () => {
  it('σκάλα κάτω από υπάρχουσα πλάκα → auto well opening εμφανίζεται (1, όχι διπλό)', () => {
    const scene = makeScene([fakeSlab() as unknown as AnySceneEntity]);
    addStairToScene(fakeStair(), makeAccessor(scene), NO_FLOOR, 'stair');

    expect(entityIds(scene)).toContain('stair-1');
    // Ένα μόνο opening — ο cascade έρχεται ΜΟΝΟ από το command (καμία χειροκίνητη 2η κλήση).
    expect(autoOpeningCount(scene)).toBe(1);
  });

  it('Ctrl+Z → αναιρεί ΚΑΙ τη σκάλα ΚΑΙ το auto opening + εκπέμπει bim:stair-delete-requested', async () => {
    const scene = makeScene([fakeSlab() as unknown as AnySceneEntity]);
    const deletes: string[] = [];
    const off = EventBus.on('bim:stair-delete-requested', ({ stairId }) => deletes.push(stairId));

    addStairToScene(fakeStair(), makeAccessor(scene), NO_FLOOR, 'stair');
    expect(autoOpeningCount(scene)).toBe(1);

    const undone = getGlobalCommandHistory().undo();
    expect(undone).toBe(true);
    expect(entityIds(scene)).not.toContain('stair-1');
    expect(autoOpeningCount(scene)).toBe(0);

    await Promise.resolve();
    expect(deletes).toEqual(['stair-1']);
    off();
  });

  it('redo → σκάλα + auto opening ξαναεμφανίζονται', () => {
    const scene = makeScene([fakeSlab() as unknown as AnySceneEntity]);
    addStairToScene(fakeStair(), makeAccessor(scene), NO_FLOOR, 'stair');

    const history = getGlobalCommandHistory();
    history.undo();
    expect(entityIds(scene)).not.toContain('stair-1');

    const redone = history.redo();
    expect(redone).toBe(true);
    expect(entityIds(scene)).toContain('stair-1');
    expect(autoOpeningCount(scene)).toBe(1);
  });
});
