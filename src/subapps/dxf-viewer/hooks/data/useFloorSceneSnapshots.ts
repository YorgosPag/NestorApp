'use client';

/**
 * useFloorSceneSnapshots — **ΕΝΑΣ** φορτωτής στιγμιοτύπων για τους aggregators «όλοι οι όροφοι»
 * (ADR-914 §2.14).
 *
 * ## Γιατί υπάρχει
 *
 * Έξι hooks (`useFloors3DAggregator` · `useFloors3DDxfOverlay` · `useEnvelopeFloorSlabs` ·
 * `useCrossLevelStairwellOpenings` · `useBuildingFloorScenes` · `useSiteNeighbourMasses`) κουβαλούσαν
 * το ίδιο σώμα σε έξι αντίγραφα: κατάσταση `loaded` + effect που βρίσκει ποιοι όροφοι **λείπουν**,
 * τους φορτώνει έναν-έναν, αγνοεί το αποτέλεσμα αν ακυρώθηκε και το συγχωνεύει στον χάρτη. Διέφεραν
 * μόνο σε **τρία** σημεία — και αυτά είναι οι παράμετροι:
 *
 *   · `needsSnapshot` — ποιος όροφος χρειάζεται στιγμιότυπο (ο ενεργός όχι· όποιος ζει στη μνήμη όχι)
 *   · `load`          — από πού έρχεται και σε τι μετατρέπεται
 *   · `fallback`      — τι γράφεται όταν το φόρτωμα πετάξει
 *
 * ## Συμβόλαιο
 *
 * Η προσπάθεια είναι **μία ανά επίπεδο**: ό,τι γυρίσει ο `load` (ακόμη και «κενό») γράφεται στον
 * χάρτη και το επίπεδο δεν ξαναζητείται. Οι `needsSnapshot` / `load` μπαίνουν στις εξαρτήσεις του
 * effect — ο καλών τις δίνει **σταθερές** (`useCallback` ή συνάρτηση module), αλλιώς το effect
 * ξανατρέχει σε κάθε render.
 *
 * @see ./floor-scoped-scene-loader — ο φορτωτής με φράχτη ορόφου + εφεδρεία ανά οντότητα
 * @see docs/centralized-systems/reference/adrs/ADR-914-open-create-entry.md §2.14
 */

import { useCallback, useEffect, useState } from 'react';
import { DxfFirestoreService } from '../../services/dxf-firestore.service';
import type { SceneModel } from '../../types/scene';

/** Το ελάχιστο που πρέπει να ξέρει ο φορτωτής για έναν όροφο. */
export interface FloorSnapshotTarget {
  readonly levelId: string;
  readonly sceneFileId: string | null;
}

/** Ο αναγνώστης σκηνής του `LevelsSystem` — απών έξω από αυτό (ADR-371). */
export type LevelSceneGetter = ((levelId: string) => SceneModel | null) | undefined;

interface FloorSceneSnapshotsOptions<T extends FloorSnapshotTarget, V> {
  /** `false` ⇒ κανένα φόρτωμα (ο χάρτης κρατά ό,τι έχει ήδη). */
  readonly enabled: boolean;
  readonly targets: readonly T[];
  /** Χρειάζεται αυτός ο όροφος στιγμιότυπο; (σταθερή αναφορά) */
  readonly needsSnapshot: (target: T) => boolean;
  /** Φόρτωσε + μετέτρεψε. Το `isCancelled` επιτρέπει να κοπεί ένα δεύτερο αίτημα στη μέση. */
  readonly load: (target: T, isCancelled: () => boolean) => Promise<V>;
  /** Η τιμή που γράφεται όταν ο `load` πετάξει. */
  readonly fallback: V;
}

/** Η ζωντανή σκηνή ενός επιπέδου, **μόνο** αν έχει οντότητες — αλλιώς `null`. */
export function liveSceneOf(getLevelScene: LevelSceneGetter, levelId: string): SceneModel | null {
  const scene = getLevelScene?.(levelId);
  return scene && scene.entities.length > 0 ? scene : null;
}

/**
 * Το αποθηκευμένο στιγμιότυπο του ορόφου, ή `null` αν δεν έχει αρχείο / έγκυρη σκηνή.
 * Χωρίς φράχτη ορόφου — για καταναλωτές που διαβάζουν **ό,τι** γράφει το αρχείο.
 */
export async function loadSnapshotScene(target: FloorSnapshotTarget): Promise<SceneModel | null> {
  if (!target.sceneFileId) return null;
  const rec = await DxfFirestoreService.loadFileV2(target.sceneFileId);
  return rec?.scene && Array.isArray(rec.scene.entities) ? (rec.scene as SceneModel) : null;
}

/**
 * Το συνηθέστερο κριτήριο: όροφος **με αρχείο**, που δεν είναι ο ενεργός (αυτός διαβάζεται
 * ζωντανά) και δεν ζει ήδη στη μνήμη. `activeLevelId === null` ⇒ κανένας δεν εξαιρείται ως ενεργός.
 */
export function useUnvisitedFloorPredicate(
  activeLevelId: string | null,
  getLevelScene: LevelSceneGetter,
): (target: FloorSnapshotTarget) => boolean {
  return useCallback(
    (t) => Boolean(t.sceneFileId) && t.levelId !== activeLevelId && !liveSceneOf(getLevelScene, t.levelId),
    [activeLevelId, getLevelScene],
  );
}

export function useFloorSceneSnapshots<T extends FloorSnapshotTarget, V>(
  options: FloorSceneSnapshotsOptions<T, V>,
): ReadonlyMap<string, V> {
  const { enabled, targets, needsSnapshot, load, fallback } = options;
  const [loaded, setLoaded] = useState<ReadonlyMap<string, V>>(new Map());

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const isCancelled = (): boolean => cancelled;
    const missing = targets.filter((t) => !loaded.has(t.levelId) && needsSnapshot(t));
    if (missing.length === 0) return;

    void (async () => {
      const entries: [string, V][] = [];
      for (const t of missing) {
        try {
          const value = await load(t, isCancelled);
          if (cancelled) return;
          entries.push([t.levelId, value]);
        } catch {
          entries.push([t.levelId, fallback]);
        }
      }
      if (cancelled || entries.length === 0) return;
      setLoaded((prev) => {
        const next = new Map(prev);
        for (const [k, v] of entries) next.set(k, v);
        return next;
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, targets, loaded, needsSnapshot, load, fallback]);

  return loaded;
}
