// ============================================================================
// useSceneMaterials — floor-scope regression tests (Giorgio 2026-07-24, ADR-687 Φ8)
//
// Ρίζα του bug: η κάτω μπάρα «Υλικά όψης» τροφοδοτούνταν από
// `collectSceneAppearanceRefs(getSceneRecord())` — ΟΛΟΙ οι όροφοι, πάντα. Έτσι με
// επιλεγμένο ΕΝΑΝ όροφο η μπάρα έδειχνε και υλικά οντοτήτων άλλων ορόφων.
//
// Σωστό (Revit «Project Materials in use» / C4D Material Manager): scoped στην ενεργή
// προβολή μέσω `ViewMode3DStore.floor3DScope` — `'single'` = μόνο ο τρέχων όροφος,
// `'all'` = όλοι. Τα tests κλειδώνουν ότι το feed φιλτράρεται ΚΑΙ ότι το version-gated
// cache invalidate-άρει σε αλλαγή scope/ορόφου (όχι μόνο σε scene mutation).
// ============================================================================

import { act, renderHook } from '@testing-library/react';
import type { TFunction } from 'i18next';

import { SceneStore } from '../../../systems/scene/SceneStore';
import { useViewMode3DStore } from '../../stores/ViewMode3DStore';
import type { Entity } from '../../../types/entities';
import type { SceneModel } from '../../../types/scene';
import { useSceneMaterials, _resetSceneMaterialsCacheForTests } from '../useSceneMaterials';

const L1 = 'lvl-1';
const L2 = 'lvl-2';

// Ο collector διαβάζει faceAppearance από κάθε entity — ένα «βαμμένο» wall ανά χρώμα.
function paintedWall(id: string, colorHex: string): Entity {
  return { id, type: 'wall', faceAppearance: { '*': { colorHex } } } as unknown as Entity;
}
function sceneWith(entities: readonly Entity[]): SceneModel {
  return { entities } as unknown as SceneModel;
}

// t identity — δεν αφορά το scope φιλτράρισμα (ελέγχουμε ad-hoc colorHex swatches).
const t = ((key: string) => key) as unknown as TFunction;
const EMPTY_LIBRARY = [] as const;

/** Τα ad-hoc χρώματα (colorHex χωρίς catalog id) που τροφοδοτεί η μπάρα — αντικατοπτρίζουν τα scoped refs. */
function adhocColors(entries: readonly { id: string }[]): string[] {
  return entries
    .filter((e) => e.id.startsWith('adhoc-color:'))
    .map((e) => e.id.slice('adhoc-color:'.length))
    .sort();
}

describe('useSceneMaterials — floor scope', () => {
  beforeEach(() => {
    SceneStore._resetForTests();
    _resetSceneMaterialsCacheForTests();
    useViewMode3DStore.getState().setFloor3DScope('single');
    SceneStore.setLevelScene(L1, sceneWith([paintedWall('w1', '#111111')]));
    SceneStore.setLevelScene(L2, sceneWith([paintedWall('w2', '#222222')]));
  });

  it('single scope → μόνο τα υλικά του τρέχοντος ορόφου', () => {
    const { result } = renderHook(() => useSceneMaterials(EMPTY_LIBRARY, t, L1));
    expect(adhocColors(result.current)).toEqual(['#111111']);
  });

  it('all scope → όλα τα υλικά όλων των ορόφων', () => {
    useViewMode3DStore.getState().setFloor3DScope('all');
    const { result } = renderHook(() => useSceneMaterials(EMPTY_LIBRARY, t, L1));
    expect(adhocColors(result.current)).toEqual(['#111111', '#222222']);
  });

  it('scope switch single→all re-filters χωρίς scene mutation (cache invalidation)', () => {
    const { result } = renderHook(() => useSceneMaterials(EMPTY_LIBRARY, t, L1));
    expect(adhocColors(result.current)).toEqual(['#111111']);

    act(() => useViewMode3DStore.getState().setFloor3DScope('all'));
    expect(adhocColors(result.current)).toEqual(['#111111', '#222222']);
  });

  it('αλλαγή ενεργού ορόφου σε single scope δείχνει τον νέο όροφο', () => {
    const { result, rerender } = renderHook(
      ({ levelId }: { levelId: string }) => useSceneMaterials(EMPTY_LIBRARY, t, levelId),
      { initialProps: { levelId: L1 } },
    );
    expect(adhocColors(result.current)).toEqual(['#111111']);

    rerender({ levelId: L2 });
    expect(adhocColors(result.current)).toEqual(['#222222']);
  });

  it('single scope χωρίς ενεργό όροφο (null) → κενή μπάρα', () => {
    const { result } = renderHook(() => useSceneMaterials(EMPTY_LIBRARY, t, null));
    expect(adhocColors(result.current)).toEqual([]);
  });
});
