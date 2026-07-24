'use client';

/**
 * useSceneMaterials — ADR-687 Φ8. Reactive λίστα «υλικά που περιέχει η σκηνή» (Ν.2 κάτω μπάρα).
 *
 * Διαβάζει το `SceneStore` (SSoT των BIM entities ανά επίπεδο· γράφεται από κάθε paint μέσω
 * `setLevelScene`) με `useSyncExternalStore` + version-gate (mirror `systems/scene/scene-selectors.ts`):
 * ο συλλέκτης `collectSceneAppearanceRefs` τρέχει το πολύ ΜΙΑ φορά ανά mutation, όχι ανά render.
 *
 * **Floor scope (ADR-687 Φ8 follow-up):** η μπάρα είναι scoped στην ενεργή προβολή, όπως Revit «Project
 * Materials in use» / C4D Material Manager / ArchiCAD Attribute Manager. Το SSoT signal είναι το
 * `ViewMode3DStore.floor3DScope`:
 *   - `'single'` → μόνο τα υλικά των οντοτήτων του τρέχοντος ορόφου (`getSceneForLevel(currentLevelId)`).
 *   - `'all'` → όλα τα υλικά όλων των ορόφων (`getSceneRecord()`).
 * Ο collector μένει ΕΝΑΣ (SSoT) — του δίνουμε scoped record (thin wrap), δεν τον διπλασιάζουμε.
 *
 * Το αποτέλεσμα = ο κοινός `LibraryEntry` index (SSoT, `material-library-index.ts`) φιλτραρισμένος σε
 * ό,τι είναι ρητά βαμμένο στη σκηνή, + synth entries για ad-hoc `colorHex` (raw drag/imported χρώματα
 * εκτός καταλόγου) ώστε κάθε βαμμένη όψη να έχει το swatch της. Έτσι το render/apply/drag της μπάρας
 * μένει το ΙΔΙΟ με πριν — αλλάζει μόνο ΠΟΙΑ υλικά τροφοδοτεί (σκηνή scoped αντί όλο το palette).
 *
 * @see ./material-library-index.ts — ο index (γενική βιβλιοθήκη)
 * @see ./scene-material-usage.ts — ο pure συλλέκτης refs
 * @see ../stores/ViewMode3DStore.ts — `floor3DScope` SSoT signal
 */

import { useCallback, useMemo, useSyncExternalStore } from 'react';
import type { TFunction } from 'i18next';
import {
  subscribeScene,
  getSceneRecord,
  getSceneForLevel,
  getSceneVersion,
} from '../../systems/scene/SceneStore';
import type { SceneModel } from '../../types/scene';
import type { BimMaterial } from '../../bim/types/bim-material-types';
import { useViewMode3DStore, selectFloor3DScope, type Floor3DScope } from '../stores/ViewMode3DStore';
import { collectSceneAppearanceRefs, type SceneAppearanceRefs } from './scene-material-usage';
import { buildMaterialLibraryEntries, type LibraryEntry } from './material-library-index';

// Version-gated snapshot cache keyed by scope+level (mirror scene-selectors.ts::byIdCache): recompute
// only when the store's mutation counter advanced OR the scope/active level changed, and return the
// SAME ref otherwise so useSyncExternalStore stays stable. Any scene mutation bumps getSceneVersion(),
// invalidating every key — so a stale «other floor» key can never survive an edit.
const refsCache = new Map<string, { version: number; refs: SceneAppearanceRefs }>();

/** Cache key: μόνο ο scope+level επηρεάζουν ΠΟΙΟΝ record απαριθμούμε. */
function scopeKey(scope: Floor3DScope, currentLevelId: string | null): string {
  return scope === 'all' ? 'all' : `single|${currentLevelId ?? ''}`;
}

/** Τα refs για το ενεργό scope — `all` = όλοι οι όροφοι· `single` = μόνο ο τρέχων. */
function getScopedRefs(scope: Floor3DScope, currentLevelId: string | null): SceneAppearanceRefs {
  const version = getSceneVersion();
  const key = scopeKey(scope, currentLevelId);
  const cached = refsCache.get(key);
  if (cached && cached.version === version) return cached.refs;

  const record: Readonly<Record<string, SceneModel | null>> =
    scope === 'all'
      ? getSceneRecord()
      : currentLevelId
        ? { [currentLevelId]: getSceneForLevel(currentLevelId) }
        : {};
  const refs = collectSceneAppearanceRefs(record);
  refsCache.set(key, { version, refs });
  return refs;
}

/** Test-only: reset the module cache (the store version resets to 0 between tests). */
export function _resetSceneMaterialsCacheForTests(): void {
  refsCache.clear();
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
 * στη σκηνή (paint), στη βιβλιοθήκη (`library`) ΚΑΙ στο floor scope — αλλαγή ορόφου ή `single`↔`all`
 * επαναφιλτράρει άμεσα. `currentLevelId`: ο ενεργός όροφος (αγνοείται όταν το scope είναι `'all'`).
 */
export function useSceneMaterials(
  library: readonly BimMaterial[],
  t: TFunction,
  currentLevelId: string | null,
): LibraryEntry[] {
  const scope = useViewMode3DStore(selectFloor3DScope);
  // getSnapshot κλείνει πάνω στο (scope, currentLevelId): αλλαγή τους → νέα ταυτότητα → το
  // useSyncExternalStore ξαναδιαβάζει τα scoped refs (χωρίς να περιμένει scene mutation).
  const getSnapshot = useCallback(
    () => getScopedRefs(scope, currentLevelId),
    [scope, currentLevelId],
  );
  const refs = useSyncExternalStore(subscribeScene, getSnapshot, getSnapshot);

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
