'use client';

/**
 * ADR-557 / **ADR-721 §2** — `useCurrentLevelScene`: THE single source of truth for "the LIVE
 * `SceneModel` of the currently active level" as a React render-time value.
 *
 * WHY it exists (Giorgio 2026-07-08): the derivation `currentLevelId ? getLevelScene(currentLevelId)
 * ?? null : null` was hand-copied into ~15 hooks (`useSceneState`, `useCurrentSceneModel`,
 * `useLayerManagerState`, `useProSnapIntegration`, the analytical-overlay painters, …). Two of
 * them wrapped it in a `useMemo` keyed on `[currentLevelId, getLevelScene]` — but `getLevelScene`
 * is a STABLE `useCallback([])` ref, so the memo froze the scene snapshot and never saw content
 * mutations → the text ribbon looked the selection up in a stale scene → `selectedIds: []` → every
 * edit silently no-op'd. Collapsing the derivation here fixes that class of bug in ONE place.
 *
 * ## ADR-721 — γιατί ΔΕΝ αρκούσε ο σκέτος getter (η ρίζα του «τα ματάκια δεν κάνουν τίποτα»)
 *
 * Μέχρι τις 2026-07-28 αυτό το hook έκανε **σκέτη κλήση getter κατά το render**, χωρίς καμία
 * συνδρομή. Πριν το ADR-547 Stage 0 αυτό ήταν ανεκτό: η σκηνή ζούσε σε `useState` μέσα στο
 * `useSceneManager`, οπότε κάθε γραφή προκαλούσε από μόνη της re-render cascade. Μετά το Stage 0
 * η σκηνή μετακόμισε στο zero-React `SceneStore` και **η μόνη** συνδρομή έμεινε μέσα στο
 * `useSceneManager` — του οποίου το αποτέλεσμα ΔΕΝ μπαίνει στα deps του `LevelsContext` memo
 * (`LevelsSystem.tsx` §contextValue: μόνο `fileRecordId`/`saveContext`· βλ. ADR-547 §2, που
 * περιγράφει αυτή τη σταθερότητα ως **επιθυμητή** για perf).
 *
 * Αποτέλεσμα: `setLevelScene(...)` → το store ενημερωνόταν σωστά → αλλά **κανένας consumer δεν
 * ειδοποιούνταν**. Η εφαρμογή έμοιαζε να δουλεύει μόνο επειδή σχεδόν κάθε άλλη ενέργεια
 * (επιλογή, εργαλείο, drag) πυροδοτεί re-render από ΑΛΛΟ store, οπότε η σκηνή ξαναδιαβαζόταν
 * παρεμπιπτόντως. Μια ενέργεια που αλλάζει **μόνο** τη σκηνή — ακριβώς το toggle ορατότητας
 * layer — έμενε αόρατη για πάντα.
 *
 * **Μετρημένο ζωντανά** (browser probe, 2026-07-28, `47_ergasia.dxf`): μετά από κλικ στο μάτι,
 * `SceneStore.getLevelScene(id)` → `VT_POINT.visible === true`, ενώ το `scene` prop σε panel ΚΑΙ
 * καμβά → `visible === false`. Δύο διαφορετικά αντικείμενα, μόνιμα αποκλίνοντα.
 *
 * ## Η θεραπεία, και γιατί ΔΕΝ επαναφέρει τον cascade του ADR-547
 *
 * `useSyncExternalStore` πάνω στο **per-level** getter, όχι στο ολόκληρο record:
 *
 *   - `getSceneForLevel(levelId)` επιστρέφει την **ίδια αναφορά** μέχρι να γραφτεί ΑΥΤΟ το level
 *     (`SceneStore.setLevelScene` κάνει `if (record[levelId] === scene) return`). Άρα το
 *     getSnapshot είναι reference-stable — η προϋπόθεση του React για να μην μπει σε βρόχο
 *     («The result of getSnapshot should be cached»).
 *   - Γραφή σε **άλλο** level δεν αγγίζει αυτή την αναφορά ⇒ μηδέν re-render εδώ (το
 *     `getSceneRecord` θα άλλαζε — γι' αυτό ΔΕΝ το χρησιμοποιούμε).
 *   - Οι 27 persistence hosts του ADR-547 Stage 2/3 έχουν ΗΔΗ φύγει από το `currentScene` prop
 *     προς granular slices + `React.memo`. Άρα η ειδοποίηση εδώ φτάνει στους λίγους πραγματικούς
 *     scene-readers (orchestrator, panels, converter), όχι στο δέντρο που το Stage 2 απάλλαξε.
 *
 * Το `getServerSnapshot` είναι το ίδιο `getSnapshot` (καθαρό store read, SSR-safe: `null` πριν
 * φορτωθεί σκηνή).
 *
 * Returns `null` when no level is active — callers short-circuit before using the scene.
 *
 * @module systems/levels/useCurrentLevelScene
 * @see systems/scene/SceneStore — ο SSoT· §Caching rule εξηγεί τη σταθερότητα αναφοράς
 * @see docs/centralized-systems/reference/adrs/ADR-721 — root cause + απόδειξη από browser
 */

import { useCallback, useSyncExternalStore } from 'react';
import { useLevelsOptional } from './useLevels';
import { subscribeScene, getSceneForLevel } from '../scene/SceneStore';
import type { SceneModel } from '../../types/scene';

/** Σταθερό snapshot για «κανένα ενεργό level» — ίδια αναφορά ⇒ κανένα re-render loop. */
const NO_SCENE: SceneModel | null = null;

/**
 * The live scene of the active level (or `null` if none), **reactively**.
 *
 * Uses `useLevelsOptional` (NOT `useLevels`) so it is safe for EVERY caller: the analytical-overlay
 * painters and other consumers that render defensively outside a `LevelsSystem` provider get `null`
 * instead of a thrown error.
 */
export function useCurrentLevelScene(): SceneModel | null {
  const levels = useLevelsOptional();
  const currentLevelId = levels?.currentLevelId ?? null;

  // Reference-stable per-level read (see module note). Recreated only when the active
  // level changes — `useSyncExternalStore` re-subscribes then, which is exactly right.
  const getSnapshot = useCallback(
    (): SceneModel | null => (currentLevelId ? getSceneForLevel(currentLevelId) : NO_SCENE),
    [currentLevelId],
  );

  return useSyncExternalStore(subscribeScene, getSnapshot, getSnapshot);
}
