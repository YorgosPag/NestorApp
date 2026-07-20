// ============================================================================
// useLiveSelectedEntity — regression tests (Giorgio 2026-07-20)
//
// Ρίζα του bug: τα ribbon widgets διάβαζαν την οντότητα με
// `useMemo(..., [levelManager, universalSelection])`. Και τα δύο deps είναι
// ΣΤΑΘΕΡΑ refs (οι σκηνές ζουν στο `SceneStore`), άρα το snapshot πάγωνε στο
// mount → το commit συνέθετε patch πάνω σε μπαγιάτικα params: αλλαγή ΠΑΧΟΥΣ
// επανέγραφε το παλιό `end` (⇒ επανέφερε το ΜΗΚΟΣ) και αντίστροφα.
//
// Τα tests κλειδώνουν ότι το hook είναι ΖΩΝΤΑΝΟ: βλέπει κάθε mutation της
// επιλεγμένης οντότητας, χωρίς να απαιτεί αλλαγή στα context refs.
// ============================================================================

import { act, renderHook } from '@testing-library/react';

import { SelectedEntitiesStore } from '../SelectedEntitiesStore';
import { SceneStore } from '../../scene/SceneStore';
import { useLiveSelectedEntity } from '../useLiveSelectedEntity';
import type { Entity } from '../../../types/entities';
import type { SceneModel } from '../../../types/scene';

const LEVEL_ID = 'lvl-1';

// Το hook διαβάζει ΜΟΝΟ το `currentLevelId` από το LevelsSystem context — ένα
// σταθερό mock αναπαράγει ακριβώς τη συνθήκη του bug (context ref που ΔΕΝ αλλάζει).
jest.mock('../../levels/useLevels', () => ({
  useLevelsOptional: () => ({ currentLevelId: 'lvl-1' }),
}));

const isWall = (e: Entity): e is Entity & { type: 'wall' } => e.type === 'wall';

function wall(id: string, thicknessMm: number, endX: number): Entity {
  return {
    id,
    type: 'wall',
    params: { thickness: thicknessMm, start: { x: 0, y: 0, z: 0 }, end: { x: endX, y: 0, z: 0 } },
  } as unknown as Entity;
}

function sceneWith(entities: readonly Entity[]): SceneModel {
  return { entities: [...entities] } as unknown as SceneModel;
}

beforeEach(() => {
  SelectedEntitiesStore._resetForTests();
  SceneStore._resetForTests();
});

describe('useLiveSelectedEntity', () => {
  it('returns null χωρίς επιλογή', () => {
    SceneStore.setLevelScene(LEVEL_ID, sceneWith([wall('w1', 250, 6571)]));
    const { result } = renderHook(() => useLiveSelectedEntity(isWall));
    expect(result.current).toBeNull();
  });

  it('βλέπει mutation της επιλεγμένης οντότητας (ΔΕΝ παγώνει στο mount)', () => {
    SceneStore.setLevelScene(LEVEL_ID, sceneWith([wall('w1', 250, 6571)]));
    act(() => { SelectedEntitiesStore.selectEntity({ id: 'w1', type: 'dxf-entity' }); });

    const { result } = renderHook(() => useLiveSelectedEntity(isWall));
    expect(result.current?.id).toBe('w1');

    // Επεξεργασία ΜΗΚΟΥΣ (νέο end) — καμία αλλαγή σε context refs.
    act(() => { SceneStore.setLevelScene(LEVEL_ID, sceneWith([wall('w1', 250, 3000)])); });

    // Αν το hook πάγωνε, εδώ θα έβλεπε ακόμη end.x === 6571 και το επόμενο
    // commit πάχους θα επανέφερε το παλιό μήκος (το bug του Giorgio).
    const params = result.current?.params as { end: { x: number } } | undefined;
    expect(params?.end.x).toBe(3000);
  });

  it('ακολουθεί την αλλαγή του primary selection', () => {
    SceneStore.setLevelScene(LEVEL_ID, sceneWith([wall('w1', 250, 1000), wall('w2', 100, 2000)]));
    act(() => { SelectedEntitiesStore.selectEntity({ id: 'w1', type: 'dxf-entity' }); });

    const { result } = renderHook(() => useLiveSelectedEntity(isWall));
    expect(result.current?.id).toBe('w1');

    act(() => { SelectedEntitiesStore.selectEntity({ id: 'w2', type: 'dxf-entity' }); });
    expect(result.current?.id).toBe('w2');
  });

  it('null όταν ο τύπος δεν περνά το guard', () => {
    const column = { id: 'c1', type: 'column', params: {} } as unknown as Entity;
    SceneStore.setLevelScene(LEVEL_ID, sceneWith([column]));
    act(() => { SelectedEntitiesStore.selectEntity({ id: 'c1', type: 'dxf-entity' }); });

    const { result } = renderHook(() => useLiveSelectedEntity(isWall));
    expect(result.current).toBeNull();
  });
});
