/**
 * ADR-581 — Round-trip lock για το structural paramKey SSoT (§Risk).
 *
 * Για κάθε structural descriptor: read-key ΠΡΕΠΕΙ να ισούται με write-key. Πιάνει
 * κάθε λάθος `paramKey` ντετερμινιστικά (θα «έγραφε» σε άλλο πεδίο από αυτό που διαβάζει).
 */

import { getStructuralMatchables } from '../param-matchables-by-type';
import { getMatchableProperties, __clearMatchRegistryCache } from '../match-registry';
import type { MatchableValue } from '../match-types';
import type { EntityType } from '../../../types/entities';
import type { SceneEntity } from '../../../core/commands/interfaces';

beforeEach(() => __clearMatchRegistryCache());

const BIM_TYPES: readonly EntityType[] = ['column', 'beam', 'slab', 'wall', 'foundation'];

function sampleFor(valueType: string, enumValues?: readonly string[]): MatchableValue {
  if (valueType === 'enum') return enumValues?.[0] ?? 'x';
  if (valueType === 'boolean') return true;
  if (valueType === 'number') return 3;
  return 'sample';
}

describe('structural paramKey round-trip', () => {
  it('read-key === write-key για κάθε structural descriptor', () => {
    for (const type of BIM_TYPES) {
      for (const desc of getStructuralMatchables(type)) {
        expect(desc.channel).toBe('params');
        const sample = sampleFor(desc.valueType, desc.enumValues);
        const fragment = desc.buildFragment(sample);
        const entity: SceneEntity = { id: 't', type, visible: true, params: { ...fragment.patch } };
        expect(desc.read(entity)).toBe(sample);
      }
    }
  });

  it('τα structural descriptors μπαίνουν στο registry (π.χ. column concreteGrade)', () => {
    const keys = getMatchableProperties('column').map((d) => d.key);
    expect(keys).toContain('params.concreteGrade');
    expect(keys).toContain('params.envelopeFunction');
  });

  it('cross-type concreteGrade μοιράζεται ρόλο (column↔beam↔slab)', () => {
    const roleOf = (type: EntityType) =>
      getStructuralMatchables(type).find((d) => d.key === 'params.concreteGrade')?.role;
    expect(roleOf('column')).toBeDefined();
    expect(roleOf('column')).toBe(roleOf('beam'));
    expect(roleOf('column')).toBe(roleOf('slab'));
  });
});
