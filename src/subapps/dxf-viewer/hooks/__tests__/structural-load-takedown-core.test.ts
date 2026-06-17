/**
 * ADR-459 Phase 9 — structural-load-takedown-core tests.
 *
 * Καλύπτει τον SSoT πυρήνα που μοιράζονται ο ribbon (`useStructuralLoadTakedown`) και
 * ο proactive (`useProactiveStructuralLoads`) trigger:
 *   - έγκυρα settings + κολόνα → γράφει appliedLoad (source='takedown') + emit count
 *   - idempotent / manual guard: χειροκίνητο appliedLoad → skip, καμία execute, count 0
 *   - κανένα level → 0, καμία emit
 *   - κενή σκηνή → 0 + emit count 0
 *   - αδρανές (storeyCount/area loads = 0) → 0 + emit count 0
 *
 * Light test (mirror του `structural-auto-reinforce-core.test`): settings + guide
 * offset lookup injected → καμία firebase/store chain.
 */

import {
  runStructuralLoadTakedown,
  type LoadTakedownLevelManager,
} from '../structural-load-takedown-core';
import { EventBus } from '../../systems/events/EventBus';
import type { ICommand } from '../../core/commands/interfaces';
import type { TakedownSettings } from '../../bim/structural/loads/load-takedown';
import type { GuideOffsetLookup } from '../../bim/hosting/derive-slots';
import { isColumnEntity, type Entity } from '../../types/entities';
import type { AppliedMemberLoad } from '../../bim/structural/loads/structural-loads-types';
import type { SceneModel } from '../../types/scene';

const LEVEL = 'L1';
const NO_OFFSET: GuideOffsetLookup = () => undefined;
const SETTINGS: TakedownSettings = { storeyCount: 2, deadAreaLoadKpa: 5, liveAreaLoadKpa: 2 };
const ZERO_SETTINGS: TakedownSettings = { storeyCount: 0, deadAreaLoadKpa: 0, liveAreaLoadKpa: 0 };

/** Column fixture (canvas = mm) με footprint — mirror του load-path-takedown test. */
function column(id: string, cx: number, cy: number, appliedLoad?: AppliedMemberLoad): Entity {
  const h = 300;
  return {
    id, type: 'column', kind: 'rectangular',
    params: {
      kind: 'rectangular', position: { x: cx, y: cy, z: 0 }, anchor: 'center',
      width: 600, depth: 600, height: 3000, rotation: 0, sceneUnits: 'mm',
      ...(appliedLoad ? { appliedLoad } : {}),
    },
    geometry: {
      area: 0.36,
      footprint: { vertices: [
        { x: cx - h, y: cy - h }, { x: cx + h, y: cy - h },
        { x: cx + h, y: cy + h }, { x: cx - h, y: cy + h },
      ] },
    },
  } as unknown as Entity;
}

/** Level manager backed by mutable in-memory scene (real LevelSceneManagerAdapter path). */
function makeLevelManager(
  entities: Entity[],
  currentLevelId: string | null = LEVEL,
): LoadTakedownLevelManager & { entities(): readonly Entity[] } {
  let scene: SceneModel = {
    entities: entities as unknown as SceneModel['entities'],
    layersById: {},
    bounds: { min: { x: 0, y: 0 }, max: { x: 1000, y: 1000 } },
    units: 'mm',
  } as unknown as SceneModel;
  return {
    currentLevelId,
    getLevelScene: (id) => (id === LEVEL ? scene : null),
    setLevelScene: (id, s) => {
      if (id === LEVEL) scene = s;
    },
    entities: () => scene.entities as unknown as readonly Entity[],
  };
}

const realExec = (cmd: ICommand): void => cmd.execute();

function captureLoads(): { events: { entityIds: string[]; count: number }[]; stop: () => void } {
  const events: { entityIds: string[]; count: number }[] = [];
  const unsub = EventBus.on('bim:structural-loads-computed', (p) => events.push(p));
  return { events, stop: unsub };
}

const appliedOf = (lm: { entities(): readonly Entity[] }, id: string): AppliedMemberLoad | undefined => {
  const e = lm.entities().find((x) => x.id === id);
  return e && isColumnEntity(e) ? e.params.appliedLoad : undefined;
};

describe('runStructuralLoadTakedown', () => {
  it('έγκυρα settings + κολόνα → γράφει appliedLoad (takedown) + emit count', () => {
    const lm = makeLevelManager([column('c1', 0, 0)]);
    const cap = captureLoads();
    const n = runStructuralLoadTakedown(lm, SETTINGS, NO_OFFSET, realExec);
    cap.stop();
    expect(n).toBeGreaterThanOrEqual(1);
    expect(appliedOf(lm, 'c1')?.source).toBe('takedown');
    expect(cap.events).toHaveLength(1);
    expect(cap.events[0].count).toBe(n);
    expect(cap.events[0].entityIds).toContain('c1');
  });

  it('execute καλείται ακριβώς μία φορά στο επιτυχές path', () => {
    const lm = makeLevelManager([column('c1', 0, 0)]);
    let executed = 0;
    const n = runStructuralLoadTakedown(lm, SETTINGS, NO_OFFSET, (cmd) => {
      executed++;
      cmd.execute();
    });
    expect(n).toBeGreaterThanOrEqual(1);
    expect(executed).toBe(1);
  });

  it('manual guard — χειροκίνητο appliedLoad → skip, καμία execute, emit count 0', () => {
    const manual: AppliedMemberLoad = { deadAxialKn: 900, liveAxialKn: 0, source: 'manual' };
    const lm = makeLevelManager([column('c1', 0, 0, manual)]);
    let executed = 0;
    const cap = captureLoads();
    const n = runStructuralLoadTakedown(lm, SETTINGS, NO_OFFSET, () => {
      executed++;
    });
    cap.stop();
    expect(n).toBe(0);
    expect(executed).toBe(0);
    expect(appliedOf(lm, 'c1')).toEqual(manual); // αμετάβλητο
    expect(cap.events).toEqual([{ entityIds: [], count: 0 }]);
  });

  it('κανένα ενεργό level → 0, καμία emit', () => {
    const lm = makeLevelManager([column('c1', 0, 0)], null);
    const cap = captureLoads();
    const n = runStructuralLoadTakedown(lm, SETTINGS, NO_OFFSET, realExec);
    cap.stop();
    expect(n).toBe(0);
    expect(cap.events).toHaveLength(0);
  });

  it('κενή σκηνή → 0 + emit count 0', () => {
    const lm = makeLevelManager([]);
    const cap = captureLoads();
    const n = runStructuralLoadTakedown(lm, SETTINGS, NO_OFFSET, realExec);
    cap.stop();
    expect(n).toBe(0);
    expect(cap.events).toEqual([{ entityIds: [], count: 0 }]);
  });

  it('αδρανές (storeyCount/area loads = 0) → 0 + emit count 0', () => {
    const lm = makeLevelManager([column('c1', 0, 0)]);
    const cap = captureLoads();
    const n = runStructuralLoadTakedown(lm, ZERO_SETTINGS, NO_OFFSET, realExec);
    cap.stop();
    expect(n).toBe(0);
    expect(appliedOf(lm, 'c1')).toBeUndefined();
    expect(cap.events).toEqual([{ entityIds: [], count: 0 }]);
  });
});
