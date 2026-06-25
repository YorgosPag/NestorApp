/**
 * ADR-527 — Singleton-per-(accessor, level) adapter cache.
 *
 * Καλύπτει τη ρίζα του «νέος adapter ανά κλήση → race». ADR-527: ΕΝΑΣ singleton adapter
 * + stateless pass-through στο live SSoT (`levelScenesRef`), μηδέν per-instance cache.
 *   - ίδιο (getLevelScene, setLevelScene, levelId) → ΤΟ ΙΔΙΟ instance
 *   - ίδιος accessor, άλλο levelId → διαφορετικά instances
 *   - `levelSceneManagerFor` ≡ `createLevelSceneManagerAdapter` για ίδιο accessor/level
 *   - διαφορετική ταυτότητα getLevelScene/setLevelScene → νέο instance (μηδέν stale binding)
 *   - `clearLevelSceneManagerCache` → η επόμενη κλήση φτιάχνει νέο instance
 *   - shared singleton → δεύτερη κλήση βλέπει τις mutations της πρώτης (μέσω live SSoT)
 */

import {
  createLevelSceneManagerAdapter,
  levelSceneManagerFor,
  clearLevelSceneManagerCache,
  type LevelSceneAccess,
} from '../LevelSceneManagerAdapter';
import type { SceneModel } from '../../../types/scene';
import type { SceneEntity } from '../../../core/commands/interfaces';

const LEVEL_A = 'L1';
const LEVEL_B = 'L2';

/** Live-ref scene store — mirror του `useSceneManager` (sync ref, read-after-write). */
function makeLiveAccessor(): LevelSceneAccess & { current: Record<string, SceneModel> } {
  const store: Record<string, SceneModel> = {};
  return {
    current: store,
    getLevelScene: (levelId: string) => store[levelId] ?? null,
    setLevelScene: (levelId: string, scene: SceneModel) => {
      store[levelId] = scene;
    },
  };
}

function emptyScene(): SceneModel {
  return { entities: [], layersById: {}, bounds: { min: { x: 0, y: 0 }, max: { x: 1, y: 1 } }, units: 'mm' };
}

function ent(id: string): SceneEntity {
  return { id, type: 'line', visible: true };
}

describe('ADR-527 — singleton LevelSceneManagerAdapter cache', () => {
  it('ίδιο (accessor, level) → ΤΟ ΙΔΙΟ instance', () => {
    const acc = makeLiveAccessor();
    const a1 = createLevelSceneManagerAdapter(acc.getLevelScene, acc.setLevelScene, LEVEL_A);
    const a2 = createLevelSceneManagerAdapter(acc.getLevelScene, acc.setLevelScene, LEVEL_A);
    expect(a2).toBe(a1);
  });

  it('ίδιος accessor, άλλο level → διαφορετικά instances', () => {
    const acc = makeLiveAccessor();
    const a = createLevelSceneManagerAdapter(acc.getLevelScene, acc.setLevelScene, LEVEL_A);
    const b = createLevelSceneManagerAdapter(acc.getLevelScene, acc.setLevelScene, LEVEL_B);
    expect(b).not.toBe(a);
    expect(a.getLevelId()).toBe(LEVEL_A);
    expect(b.getLevelId()).toBe(LEVEL_B);
  });

  it('levelSceneManagerFor ≡ createLevelSceneManagerAdapter (ίδιο cached instance)', () => {
    const acc = makeLiveAccessor();
    const viaFactory = createLevelSceneManagerAdapter(acc.getLevelScene, acc.setLevelScene, LEVEL_A);
    const viaConvenience = levelSceneManagerFor(acc, LEVEL_A);
    expect(viaConvenience).toBe(viaFactory);
  });

  it('διαφορετική ταυτότητα accessor → νέο instance (κανένα stale binding)', () => {
    const acc1 = makeLiveAccessor();
    const acc2 = makeLiveAccessor();
    const a1 = levelSceneManagerFor(acc1, LEVEL_A);
    const a2 = levelSceneManagerFor(acc2, LEVEL_A);
    expect(a2).not.toBe(a1);
  });

  it('διαφορετικό setLevelScene με ίδιο getLevelScene → νέο instance', () => {
    const acc = makeLiveAccessor();
    const first = createLevelSceneManagerAdapter(acc.getLevelScene, acc.setLevelScene, LEVEL_A);
    const otherSet = (levelId: string, scene: SceneModel) => { acc.current[levelId] = scene; };
    const second = createLevelSceneManagerAdapter(acc.getLevelScene, otherSet, LEVEL_A);
    expect(second).not.toBe(first);
  });

  it('clearLevelSceneManagerCache → η επόμενη κλήση φτιάχνει νέο instance', () => {
    const acc = makeLiveAccessor();
    const before = levelSceneManagerFor(acc, LEVEL_A);
    clearLevelSceneManagerCache(acc.getLevelScene, LEVEL_A);
    const after = levelSceneManagerFor(acc, LEVEL_A);
    expect(after).not.toBe(before);
  });

  it('shared singleton → δεύτερη κλήση βλέπει τις mutations της πρώτης', () => {
    const acc = makeLiveAccessor();
    acc.setLevelScene(LEVEL_A, emptyScene());

    // 1η «κλήση»: προσθήκη οντότητας μέσω του cached adapter
    const first = levelSceneManagerFor(acc, LEVEL_A);
    first.addEntity(ent('e1'));

    // 2η «κλήση» (ίδιο sync batch): ΙΔΙΟ instance → βλέπει την e1 μέσω του live SSoT
    const second = levelSceneManagerFor(acc, LEVEL_A);
    expect(second).toBe(first);
    second.addEntity(ent('e2'));

    expect(second.getEntities().map((e) => e.id)).toEqual(['e1', 'e2']);
    // και ο live store έχει αμφότερες (καμία mutation δεν πάτησε την άλλη)
    expect(acc.current[LEVEL_A].entities.map((e) => e.id)).toEqual(['e1', 'e2']);
  });
});
