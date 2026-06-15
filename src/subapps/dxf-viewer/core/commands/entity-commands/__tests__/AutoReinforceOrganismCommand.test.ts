/**
 * ADR-459 Phase 4d — AutoReinforceOrganismCommand tests.
 *
 * Verifies the batch auto-apply οπλισμού:
 *   - execute sets `params.reinforcement` σε μέλη ΧΩΡΙΣ (code-suggested)
 *   - idempotent — ήδη-οπλισμένα μέλη δεν αγγίζονται (κανένα patch)
 *   - undo αφαιρεί το reinforcement (επαναφορά στο prev)· redo re-applies
 *   - μικτή επιλογή: μόνο τα ανόπλιστα οπλίζονται
 *   - validate / serialize
 */

import { AutoReinforceOrganismCommand } from '../AutoReinforceOrganismCommand';
import type { ISceneManager, SceneEntity } from '../../interfaces';
import {
  buildColumnEntity,
  buildDefaultColumnParams,
} from '../../../../hooks/drawing/column-completion';
import { EUROCODE_PROVIDER } from '../../../../bim/structural/codes/eurocode-provider';
import type { ColumnEntity } from '../../../../bim/types/column-types';

function makeMockScene(initial: SceneEntity[] = []): { scene: Map<string, SceneEntity>; sm: ISceneManager } {
  const scene = new Map<string, SceneEntity>(initial.map((e) => [e.id, e]));
  const sm: ISceneManager = {
    getEntity: (id) => scene.get(id),
    addEntity: (e) => { scene.set(e.id, e); },
    removeEntity: (id) => { scene.delete(id); },
    updateEntity: (id, updates) => {
      const e = scene.get(id);
      if (e) scene.set(id, { ...e, ...(updates as SceneEntity) });
    },
    updateEntities: (updates) => {
      updates.forEach((partial, id) => {
        const e = scene.get(id);
        if (e) scene.set(id, { ...e, ...(partial as SceneEntity) });
      });
    },
    getVertices: () => undefined,
    insertVertex: () => {},
    removeVertex: () => {},
    updateVertex: () => {},
    getEntityIndex: () => -1,
    reorderEntity: () => {},
    moveEntityToIndex: () => {},
  };
  return { scene, sm };
}

function makeColumn(id: string, overrides: Partial<ColumnEntity['params']> = {}): ColumnEntity {
  const params = { ...buildDefaultColumnParams({ x: 0, y: 0 }, 'rectangular'), ...overrides };
  const r = buildColumnEntity(params, id);
  if (!r.ok) throw new Error('column build failed: ' + r.hardErrors.join(','));
  return r.entity;
}

const reinfOf = (scene: Map<string, SceneEntity>, id: string): unknown =>
  (scene.get(id) as unknown as ColumnEntity).params.reinforcement;

describe('AutoReinforceOrganismCommand', () => {
  it('execute applies code-suggested reinforcement to a member without it', () => {
    const col = makeColumn('C1');
    expect(col.params.reinforcement).toBeUndefined();
    const { scene, sm } = makeMockScene([col as unknown as SceneEntity]);
    const cmd = new AutoReinforceOrganismCommand([col.id], sm, EUROCODE_PROVIDER);
    cmd.execute();
    expect(reinfOf(scene, col.id)).toBeDefined();
  });

  it('idempotent — a member that already has reinforcement is skipped (no patch)', () => {
    const base = makeColumn('C1');
    const suggestion = EUROCODE_PROVIDER.suggestColumnReinforcement({
      widthMm: base.params.width,
      depthMm: base.params.depth,
      heightMm: base.params.height,
      grossAreaMm2: base.params.width * base.params.depth,
    });
    const col = makeColumn('C1', { reinforcement: suggestion });
    const { sm } = makeMockScene([col as unknown as SceneEntity]);
    const cmd = new AutoReinforceOrganismCommand([col.id], sm, EUROCODE_PROVIDER);
    expect(cmd.getReinforcedEntityIds()).toHaveLength(0);
  });

  it('undo removes the reinforcement (back to prev); redo re-applies', () => {
    const col = makeColumn('C1');
    const { scene, sm } = makeMockScene([col as unknown as SceneEntity]);
    const cmd = new AutoReinforceOrganismCommand([col.id], sm, EUROCODE_PROVIDER);
    cmd.execute();
    expect(reinfOf(scene, col.id)).toBeDefined();
    cmd.undo();
    expect(reinfOf(scene, col.id)).toBeUndefined();
    cmd.redo();
    expect(reinfOf(scene, col.id)).toBeDefined();
  });

  it('mixed selection — only the un-reinforced member is reinforced', () => {
    const suggestion = EUROCODE_PROVIDER.suggestColumnReinforcement({ widthMm: 400, depthMm: 400, heightMm: 3000, grossAreaMm2: 160000 });
    const fresh = makeColumn('FRESH');
    const already = makeColumn('DONE', { reinforcement: suggestion });
    const { sm } = makeMockScene([fresh as unknown as SceneEntity, already as unknown as SceneEntity]);
    const cmd = new AutoReinforceOrganismCommand([fresh.id, already.id], sm, EUROCODE_PROVIDER);
    expect(cmd.getReinforcedEntityIds()).toEqual([fresh.id]);
  });

  it('validate + serialize', () => {
    const col = makeColumn('C1');
    const { sm } = makeMockScene([col as unknown as SceneEntity]);
    const ok = new AutoReinforceOrganismCommand([col.id], sm, EUROCODE_PROVIDER);
    expect(ok.validate()).toBeNull();
    expect(new AutoReinforceOrganismCommand([], sm, EUROCODE_PROVIDER).validate()).toMatch(/At least one/);
    const s = ok.serialize();
    expect(s.type).toBe('auto-reinforce-organism');
    expect(s.data).toMatchObject({ entityIds: [col.id] });
    expect(s.version).toBe(1);
  });
});
