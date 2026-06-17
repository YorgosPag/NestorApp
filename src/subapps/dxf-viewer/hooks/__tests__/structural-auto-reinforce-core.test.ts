/**
 * ADR-459 Phase 8 — structural-auto-reinforce-core tests.
 *
 * Καλύπτει τον SSoT πυρήνα που μοιράζονται ο ribbon (`useStructuralAutoReinforce`)
 * και ο proactive (`useProactiveOrganismReinforce`) trigger:
 *   - level-wide scope (κενά ids → όλος ο reinforceable οργανισμός) → οπλίζει + emit
 *   - selection scope (ρητά ids) → οπλίζει μόνο τα επιλεγμένα
 *   - idempotent: ήδη-οπλισμένα → no-op, καμία execute, emit count 0
 *   - κανένα level / κενή σκηνή → 0
 *   - emit payload (`bim:structural-auto-reinforced`) σε όλα τα μονοπάτια
 */

import {
  runOrganismAutoReinforce,
  isReinforceable,
  type ReinforceLevelManager,
} from '../structural-auto-reinforce-core';
import { EventBus } from '../../systems/events/EventBus';
import type { ICommand } from '../../core/commands/interfaces';
import {
  buildColumnEntity,
  buildDefaultColumnParams,
} from '../drawing/column-completion';
import { EUROCODE_PROVIDER } from '../../bim/structural/codes/eurocode-provider';
import type { ColumnEntity } from '../../bim/types/column-types';
import type { SceneModel } from '../../types/scene';
import type { Entity } from '../../types/entities';

const LEVEL = 'L1';

/** Χτίζει κολόνα — `buildColumnEntity` παράγει το πραγματικό id (ULID), όχι από input. */
function makeColumn(overrides: Partial<ColumnEntity['params']> = {}): ColumnEntity {
  const params = { ...buildDefaultColumnParams({ x: 0, y: 0 }, 'rectangular'), ...overrides };
  const r = buildColumnEntity(params, 'layer-0');
  if (!r.ok) throw new Error('column build failed: ' + r.hardErrors.join(','));
  return r.entity;
}

function reinforcedColumn(): ColumnEntity {
  const base = makeColumn();
  const suggestion = EUROCODE_PROVIDER.suggestColumnReinforcement({
    widthMm: base.params.width,
    depthMm: base.params.depth,
    heightMm: base.params.height,
    grossAreaMm2: base.params.width * base.params.depth,
  });
  return { ...base, params: { ...base.params, reinforcement: suggestion } };
}

/** Level manager backed by a mutable in-memory scene (real LevelSceneManagerAdapter path). */
function makeLevelManager(
  entities: Entity[],
  currentLevelId: string | null = LEVEL,
): ReinforceLevelManager & { entities(): readonly Entity[] } {
  let scene: SceneModel = {
    entities: entities as unknown as SceneModel['entities'],
    layersById: {},
    bounds: { min: { x: 0, y: 0 }, max: { x: 1000, y: 1000 } },
    units: 'mm',
  };
  return {
    currentLevelId,
    getLevelScene: (id) => (id === LEVEL ? scene : null),
    setLevelScene: (id, s) => {
      if (id === LEVEL) scene = s;
    },
    entities: () => scene.entities as unknown as readonly Entity[],
  };
}

/** exec που εκτελεί πραγματικά το command (mirror command-history.execute). */
const realExec = (cmd: ICommand): void => cmd.execute();

function captureReinforced(): { events: { entityIds: string[]; count: number }[]; stop: () => void } {
  const events: { entityIds: string[]; count: number }[] = [];
  const unsub = EventBus.on('bim:structural-auto-reinforced', (p) => events.push(p));
  return { events, stop: unsub };
}

const reinfOf = (lm: { entities(): readonly Entity[] }, id: string): unknown =>
  (lm.entities().find((e) => e.id === id) as unknown as ColumnEntity)?.params.reinforcement;

describe('isReinforceable', () => {
  it('κολόνα → true', () => {
    expect(isReinforceable(makeColumn() as unknown as Entity)).toBe(true);
  });
});

describe('runOrganismAutoReinforce', () => {
  it('level-wide scope (κενά ids) → οπλίζει όλος τον οργανισμό + emit count', () => {
    const col = makeColumn();
    const lm = makeLevelManager([col as unknown as Entity]);
    const cap = captureReinforced();
    const n = runOrganismAutoReinforce(lm, [], EUROCODE_PROVIDER, realExec);
    cap.stop();
    expect(n).toBe(1);
    expect(reinfOf(lm, col.id)).toBeDefined();
    expect(cap.events).toEqual([{ entityIds: [col.id], count: 1 }]);
  });

  it('selection scope (ρητά ids) → οπλίζει μόνο το επιλεγμένο', () => {
    const fresh = makeColumn();
    const other = makeColumn();
    const lm = makeLevelManager([fresh as unknown as Entity, other as unknown as Entity]);
    const n = runOrganismAutoReinforce(lm, [fresh.id], EUROCODE_PROVIDER, realExec);
    expect(n).toBe(1);
    expect(reinfOf(lm, fresh.id)).toBeDefined();
    expect(reinfOf(lm, other.id)).toBeUndefined();
  });

  it('idempotent — ήδη οπλισμένα → no-op, καμία execute, emit count 0', () => {
    const lm = makeLevelManager([reinforcedColumn() as unknown as Entity]);
    let executed = 0;
    const cap = captureReinforced();
    const n = runOrganismAutoReinforce(lm, [], EUROCODE_PROVIDER, () => {
      executed++;
    });
    cap.stop();
    expect(n).toBe(0);
    expect(executed).toBe(0);
    expect(cap.events).toEqual([{ entityIds: [], count: 0 }]);
  });

  it('μικτό level-wide — μόνο το ανόπλιστο οπλίζεται', () => {
    const fresh = makeColumn();
    const done = reinforcedColumn();
    const lm = makeLevelManager([fresh as unknown as Entity, done as unknown as Entity]);
    const n = runOrganismAutoReinforce(lm, [], EUROCODE_PROVIDER, realExec);
    expect(n).toBe(1);
    expect(reinfOf(lm, fresh.id)).toBeDefined();
  });

  it('κανένα ενεργό level → 0, καμία emit', () => {
    const lm = makeLevelManager([makeColumn() as unknown as Entity], null);
    const cap = captureReinforced();
    const n = runOrganismAutoReinforce(lm, [], EUROCODE_PROVIDER, realExec);
    cap.stop();
    expect(n).toBe(0);
    expect(cap.events).toHaveLength(0);
  });

  it('κενή σκηνή (κανένα reinforceable) → 0 + emit count 0', () => {
    const lm = makeLevelManager([]);
    const cap = captureReinforced();
    const n = runOrganismAutoReinforce(lm, [], EUROCODE_PROVIDER, realExec);
    cap.stop();
    expect(n).toBe(0);
    expect(cap.events).toEqual([{ entityIds: [], count: 0 }]);
  });
});
