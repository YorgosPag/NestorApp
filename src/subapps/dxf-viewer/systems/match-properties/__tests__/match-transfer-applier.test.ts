/**
 * ADR-581 — Transfer applier tests.
 */

import { buildMatchTransferCommand } from '../match-transfer-applier';
import { __clearMatchRegistryCache } from '../match-registry';
import type { SemanticRole } from '../match-types';
import {
  ROLE_STYLE_COLOR,
  ROLE_STYLE_LINETYPE,
  ROLE_STYLE_LINEWEIGHT,
  ROLE_GEOM_WIDTH,
  ROLE_MATERIAL_PRIMARY,
} from '../semantic-roles';
import type { ISceneManager, SceneEntity } from '../../../core/commands/interfaces';

beforeEach(() => __clearMatchRegistryCache());

function makeSM(entities: SceneEntity[]): { sm: ISceneManager; get: (id: string) => SceneEntity | undefined } {
  const map = new Map(entities.map((e) => [e.id, e]));
  const sm = {
    getEntity: (id: string) => map.get(id),
    getEntities: () => [...map.values()],
    updateEntity: (id: string, patch: Partial<SceneEntity>) => {
      const e = map.get(id);
      if (e) map.set(id, { ...e, ...patch });
    },
  } as unknown as ISceneManager;
  return { sm, get: (id) => map.get(id) };
}

const roles = (...r: SemanticRole[]): ReadonlySet<SemanticRole> => new Set(r);

describe('buildMatchTransferCommand', () => {
  it('DXF line → line: μεταφέρει μόνο τους επιλεγμένους ρόλους (color+linetype, ΟΧΙ lineweight)', () => {
    const src: SceneEntity = { id: 'l1', type: 'line', visible: true, color: '#ff0000', colorMode: 'Concrete', linetypeName: 'DASHED', lineweightMm: 0.5 };
    const dst: SceneEntity = { id: 'l2', type: 'line', visible: true, color: '#000000', lineweightMm: 0.1 };
    const { sm, get } = makeSM([src, dst]);

    const res = buildMatchTransferCommand({
      sourceId: 'l1', targetIds: ['l2'], selectedRoles: roles(ROLE_STYLE_COLOR, ROLE_STYLE_LINETYPE), sceneManager: sm,
    });
    res.command.execute();

    expect(get('l2')?.color).toBe('#ff0000');
    expect(get('l2')?.colorMode).toBe('Concrete');
    expect(get('l2')?.linetypeName).toBe('DASHED');
    expect(get('l2')?.lineweightMm).toBe(0.1); // δεν επιλέχθηκε → αμετάβλητο
  });

  it('undo επαναφέρει το target', () => {
    const src: SceneEntity = { id: 'l1', type: 'line', visible: true, color: '#ff0000' };
    const dst: SceneEntity = { id: 'l2', type: 'line', visible: true, color: '#00ff00' };
    const { sm, get } = makeSM([src, dst]);
    const res = buildMatchTransferCommand({ sourceId: 'l1', targetIds: ['l2'], selectedRoles: roles(ROLE_STYLE_COLOR), sceneManager: sm });
    res.command.execute();
    expect(get('l2')?.color).toBe('#ff0000');
    res.command.undo();
    expect(get('l2')?.color).toBe('#00ff00');
  });

  it('BIM params target → emit list περιέχει τον τύπο/id (χωρίς execute)', () => {
    const src: SceneEntity = { id: 'c1', type: 'column', visible: true, params: { width: 500, depth: 400, height: 3000 } };
    const dst: SceneEntity = { id: 'c2', type: 'column', visible: true, params: { width: 300, depth: 300, height: 3000 } };
    const { sm } = makeSM([src, dst]);
    const res = buildMatchTransferCommand({ sourceId: 'c1', targetIds: ['c2'], selectedRoles: roles(ROLE_GEOM_WIDTH), sceneManager: sm });
    expect(res.emit).toEqual([{ type: 'column', id: 'c2' }]);
  });

  it('source αποκλείεται από τα targets· missing source → κενό command', () => {
    const src: SceneEntity = { id: 'l1', type: 'line', visible: true, color: '#ff0000' };
    const { sm } = makeSM([src]);
    const self = buildMatchTransferCommand({ sourceId: 'l1', targetIds: ['l1'], selectedRoles: roles(ROLE_STYLE_COLOR), sceneManager: sm });
    expect(self.command.size()).toBe(0);
    const missing = buildMatchTransferCommand({ sourceId: 'zzz', targetIds: ['l1'], selectedRoles: roles(ROLE_STYLE_COLOR), sceneManager: sm });
    expect(missing.command.size()).toBe(0);
  });

  it('params σε μη-υποστηριζόμενο kind (foundation) → skipped, όχι command', () => {
    const src: SceneEntity = { id: 'c1', type: 'column', visible: true, params: { width: 500, material: 'steel' } };
    const dst: SceneEntity = { id: 'f1', type: 'foundation', visible: true, params: { material: 'rc' } };
    const { sm } = makeSM([src, dst]);
    const res = buildMatchTransferCommand({ sourceId: 'c1', targetIds: ['f1'], selectedRoles: roles(ROLE_MATERIAL_PRIMARY), sceneManager: sm });
    expect(res.skipped).toEqual([{ targetId: 'f1', reason: 'unsupported-params-kind' }]);
    expect(res.emit).toHaveLength(0);
  });

  it('lineweight ρόλος μόνος → μεταφέρεται', () => {
    const src: SceneEntity = { id: 'l1', type: 'line', visible: true, lineweightMm: 0.7 };
    const dst: SceneEntity = { id: 'l2', type: 'line', visible: true, lineweightMm: 0.1 };
    const { sm, get } = makeSM([src, dst]);
    buildMatchTransferCommand({ sourceId: 'l1', targetIds: ['l2'], selectedRoles: roles(ROLE_STYLE_LINEWEIGHT), sceneManager: sm }).command.execute();
    expect(get('l2')?.lineweightMm).toBe(0.7);
  });
});
