'use client';

/**
 * ADR-441 Slice 3 — Associative Grid Hosting reconciler subscriber (follow-on-move).
 *
 * Το ΜΟΝΟ stateful/imperative κομμάτι του hosting. Ακούει τον κάναβο
 * (`guide-store.subscribe` → `notify`) και, **RAF-throttled (1×/frame)**, re-derives
 * όλα τα hosted foundation strips ώστε να ακολουθούν live όταν μετακινείται ένας
 * άξονας (Revit/Tekla associative grid).
 *
 * ADR-040 συμμόρφωση:
 *   - Καμία `useSyncExternalStore` σε orchestrator· η συνδρομή γίνεται imperative
 *     στο guide-store (όχι React), coalesced σε 1 scene write ανά frame.
 *   - Διαβάζει/γράφει τη σκηνή μέσω `levelManager` (getLevelScene/setLevelScene) —
 *     ίδιο imperative path με τα persistence hooks. **Only-changed writes**: αν
 *     κανένας bound άξονας δεν μετακινήθηκε → μηδέν scene write.
 *   - **Loop-free**: ακούει ΜΟΝΟ το guide-store· το scene write δεν ξανα-notify-άρει
 *     τον κάναβο.
 *
 * Persistence (drag-complete, ΟΧΙ ανά frame): μετά το settle (debounce) εκπέμπει
 * `bim:entities-moved` με τις τελικές moved strips → ο υπάρχων
 * `useBimEntityMovedPersistEffect` (ADR-436) τις persist-άρει (non-selected included).
 *
 * @see bim/hosting/guide-hosting-reconciler.ts — pure reconcile + inverted index
 * @see docs/centralized-systems/reference/adrs/ADR-441-foundation-strip-grid-auto-design.md §10
 * @see docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 */

import { useEffect, useRef } from 'react';
import type { AnySceneEntity, SceneModel } from '../../types/scene';
import type { SceneWriteOrigin } from '../scene/scene-write-origin';
import { isFoundationEntity } from '../../types/entities';
import type { FoundationEntity } from '../../bim/types/foundation-types';
import { getGlobalGuideStore } from '../../systems/guides/guide-store';
import { getDraggingGuideId } from '../../systems/guides/guide-drag-store';
import { EventBus } from '../../systems/events/EventBus';
import {
  buildHostingIndex,
  reconcileHostedFoundations,
  type HostingUpdate,
} from '../../bim/hosting/guide-hosting-reconciler';
import { hasGuideBindings } from '../../bim/hosting/guide-binding-types';
import type { GuideOffsetLookup } from '../../bim/hosting/derive-params-from-guides';

interface LevelManagerLike {
  readonly currentLevelId: string | null;
  getLevelScene(levelId: string): SceneModel | null;
  setLevelScene(levelId: string, scene: SceneModel, origin?: SceneWriteOrigin): void;
}

export interface UseHostingReconcilerParams {
  readonly levelManager: LevelManagerLike;
}

/** ms μετά το τελευταίο guide move πριν persist-άρουμε τις moved strips. */
const SETTLE_PERSIST_MS = 350;

/** Stable signature του συνόλου hosted entities — rebuild index μόνο όταν αλλάζει. */
function hostedSignature(entities: readonly FoundationEntity[]): string {
  return entities.map((e) => e.id).join('|');
}

/** Current offset ενός X/Y άξονα (XZ/διαγραμμένος → undefined → slot αγνοείται). */
function makeOffsetLookup(): GuideOffsetLookup {
  const store = getGlobalGuideStore();
  return (id) => {
    const g = store.getGuideById(id);
    return g && g.axis !== 'XZ' ? g.offset : undefined;
  };
}

export function useHostingReconciler({ levelManager }: UseHostingReconcilerParams): void {
  const levelManagerRef = useRef(levelManager);
  levelManagerRef.current = levelManager;

  // Caches reused across ticks (ADR-040 — only stateful piece).
  const indexRef = useRef<Map<string, Set<string>>>(new Map());
  const indexSigRef = useRef<string>('');
  const lastOffsetsRef = useRef<Map<string, number>>(new Map());
  const rafIdRef = useRef<number | null>(null);
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPersistIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const flushSettlePersist = (): void => {
      const lm = levelManagerRef.current;
      const levelId = lm.currentLevelId;
      const ids = pendingPersistIdsRef.current;
      pendingPersistIdsRef.current = new Set();
      if (!levelId || ids.size === 0) return;
      const scene = lm.getLevelScene(levelId);
      if (!scene) return;
      const moved = scene.entities.filter((e) => ids.has(e.id));
      if (moved.length > 0) EventBus.emit('bim:entities-moved', { movedEntities: moved });
    };

    const applyUpdates = (scene: SceneModel, levelId: string, updates: HostingUpdate[]): void => {
      const byId = new Map(updates.map((u) => [u.id, u]));
      const nextEntities = scene.entities.map((e): AnySceneEntity => {
        const u = byId.get(e.id);
        return u ? ({ ...e, params: u.nextParams, geometry: u.nextGeometry, validation: u.nextValidation } as AnySceneEntity) : e;
      });
      levelManagerRef.current.setLevelScene(levelId, { ...scene, entities: nextEntities }, 'system-reconcile');
      for (const u of updates) pendingPersistIdsRef.current.add(u.id);
      if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
      settleTimerRef.current = setTimeout(flushSettlePersist, SETTLE_PERSIST_MS);
    };

    const tick = (): void => {
      rafIdRef.current = null;
      // ADR-441 Slice 3-perf — όσο σύρεται οδηγός, το live follow το αναλαμβάνει το
      // GuideFollowGhostOverlay (zero-lag, αποκλειστικό canvas). Skip το per-frame
      // `setLevelScene` (μηδέν React churn / bitmap rebuild ανά frame). Το
      // `lastOffsetsRef` ΔΕΝ ανανεώνεται → ο πρώτος tick μετά το release ανιχνεύει
      // το συνολικό offset diff → ΕΝΑ commit (+ persist on settle).
      if (getDraggingGuideId() !== null) return;
      const lm = levelManagerRef.current;
      const levelId = lm.currentLevelId;
      if (!levelId) return;
      const scene = lm.getLevelScene(levelId);
      if (!scene) return;

      const hosted = scene.entities.filter(
        (e): e is FoundationEntity => isFoundationEntity(e) && hasGuideBindings(e),
      );
      if (hosted.length === 0) return;

      // Rebuild inverted index only when the hosted set changes.
      const sig = hostedSignature(hosted);
      if (sig !== indexSigRef.current) {
        indexRef.current = buildHostingIndex(hosted);
        indexSigRef.current = sig;
      }

      // Which bound axes actually moved since last tick? (skip unrelated notifies)
      const getOffset = makeOffsetLookup();
      const changedIds = new Set<string>();
      const nextOffsets = new Map<string, number>();
      for (const guideId of indexRef.current.keys()) {
        const off = getOffset(guideId);
        if (off === undefined) continue;
        nextOffsets.set(guideId, off);
        for (const entityId of indexRef.current.get(guideId) ?? []) changedIds.add(entityId);
      }
      // Narrow to axes whose offset differs from the previous tick.
      const movedAxes = [...nextOffsets].some(([id, off]) => lastOffsetsRef.current.get(id) !== off);
      lastOffsetsRef.current = nextOffsets;
      if (!movedAxes) return;

      const affected = hosted.filter((e) => changedIds.has(e.id));
      const updates = reconcileHostedFoundations(affected, getOffset);
      if (updates.length > 0) applyUpdates(scene, levelId, updates);
    };

    const schedule = (): void => {
      if (rafIdRef.current !== null) return;
      rafIdRef.current = requestAnimationFrame(tick);
    };

    const unsubscribe = getGlobalGuideStore().subscribe(schedule);
    return () => {
      unsubscribe();
      if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current);
      if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
    };
  }, []);
}
