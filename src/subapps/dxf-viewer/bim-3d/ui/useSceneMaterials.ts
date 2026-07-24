'use client';

/**
 * useSceneMaterials — ADR-687 Φ8. Reactive λίστα «υλικά που περιέχει η σκηνή» (Ν.2 κάτω μπάρα).
 *
 * Διαβάζει το `SceneStore` (SSoT των BIM entities ανά επίπεδο· γράφεται από κάθε paint μέσω
 * `setLevelScene`) με `useSyncExternalStore` + version-gate (mirror `systems/scene/scene-selectors.ts`):
 * ο συλλέκτης `collectSceneAppearanceRefs` τρέχει το πολύ ΜΙΑ φορά ανά mutation, όχι ανά render.
 *
 * Το αποτέλεσμα = ο κοινός `LibraryEntry` index (SSoT, `material-library-index.ts`) φιλτραρισμένος σε
 * ό,τι είναι ρητά βαμμένο στη σκηνή, + synth entries για ad-hoc `colorHex` (raw drag/imported χρώματα
 * εκτός καταλόγου) ώστε κάθε βαμμένη όψη να έχει το swatch της. Έτσι το render/apply/drag της μπάρας
 * μένει το ΙΔΙΟ με πριν — αλλάζει μόνο ΠΟΙΑ υλικά τροφοδοτεί (σκηνή αντί όλο το palette).
 *
 * @see ./material-library-index.ts — ο index (γενική βιβλιοθήκη)
 * @see ./scene-material-usage.ts — ο pure συλλέκτης refs
 */

import { useMemo, useSyncExternalStore } from 'react';
import type { TFunction } from 'i18next';
import { subscribeScene, getSceneRecord, getSceneVersion } from '../../systems/scene/SceneStore';
import type { BimMaterial } from '../../bim/types/bim-material-types';
import {
  collectSceneAppearanceRefs,
  EMPTY_SCENE_REFS,
  type SceneAppearanceRefs,
} from './scene-material-usage';
import { buildMaterialLibraryEntries, type LibraryEntry } from './material-library-index';

// Version-gated snapshot cache (mirror scene-selectors.ts): recompute only when the store's
// mutation counter advanced, and return the SAME ref otherwise so useSyncExternalStore is stable.
let cachedVersion = -1;
let cachedRefs: SceneAppearanceRefs = EMPTY_SCENE_REFS;

function getRefsSnapshot(): SceneAppearanceRefs {
  const version = getSceneVersion();
  if (version !== cachedVersion) {
    cachedRefs = collectSceneAppearanceRefs(getSceneRecord());
    cachedVersion = version;
  }
  return cachedRefs;
}

/** Test-only: reset the module cache (the store version resets to 0 between tests). */
export function _resetSceneMaterialsCacheForTests(): void {
  cachedVersion = -1;
  cachedRefs = EMPTY_SCENE_REFS;
}

/** synth entry για ένα ad-hoc χρώμα (colorHex χωρίς αντίστοιχο catalog/paint id). */
function adhocColorEntry(colorHex: string): LibraryEntry {
  return {
    id: `adhoc-color:${colorHex}`,
    label: colorHex.toUpperCase(),
    source: 'paint',
    apply: { colorHex },
    color: colorHex,
    editable: false,
    deletable: false,
  };
}

/**
 * Τα υλικά που περιέχει η σκηνή, ως `LibraryEntry[]` (ίδιο render/apply με τη βιβλιοθήκη). Reactive
 * και στη σκηνή (paint) και στη βιβλιοθήκη (`library`) — ένα νέο υλικό βαμμένο εμφανίζεται αμέσως.
 */
export function useSceneMaterials(
  library: readonly BimMaterial[],
  t: TFunction,
): LibraryEntry[] {
  const refs = useSyncExternalStore(subscribeScene, getRefsSnapshot, getRefsSnapshot);

  return useMemo(() => {
    const index = buildMaterialLibraryEntries(library, t);
    // Ό,τι εφαρμόστηκε by-id (catalog `mat-*`, user `bmat_*`, μπογιά `paint-*`) OR by-color.
    const inScene = index.filter(
      (e) => refs.materialIds.has(e.id) || (e.color !== undefined && refs.colorHexes.has(e.color)),
    );
    // Raw χρώματα που δεν αντιστοιχούν σε καμία εγγραφή → synth swatch (ώστε κάθε βαμμένη όψη να φαίνεται).
    const knownColors = new Set(
      index.filter((e) => e.color !== undefined).map((e) => e.color as string),
    );
    const adhoc = [...refs.colorHexes]
      .filter((c) => !knownColors.has(c))
      .map(adhocColorEntry);
    return [...inScene, ...adhoc];
  }, [library, t, refs]);
}
