'use client';

/**
 * ADR-441 Slice 7 — Grid-guide settle emitter (auto re-split/reflow trigger).
 *
 * Όταν ο μηχανικός μετακινεί έναν άξονα του κανάβου, οι hosted πεδιλοδοκοί
 * ακολουθούν live (coordinate-follow, `useHostingReconciler`) αλλά **η τοπολογία
 * δεν αλλάζει** (split-on-cross + reflow γωνιών γίνεται μόνο στο «Εσχάρα»). Αυτός ο
 * emitter γεφυρώνει το κενό: ακούει τον κάναβο (imperative, ADR-040-clean — όπως ο
 * reconciler), και **μόλις ο οδηγός «καθίσει»** (drag-complete settle) ΚΑΙ το σύνολο
 * των ορατών offsets όντως άλλαξε → εκπέμπει `bim:grid-guides-settled`. Ο foundation
 * bridge το ακούει και τρέχει αυτόματα το ίδιο managed reconcile με το κουμπί.
 *
 * ADR-040 συμμόρφωση: καμία `useSyncExternalStore` — η συνδρομή είναι imperative,
 * debounce-coalesced. Loop-free: ακούει ΜΟΝΟ guide-store· το επακόλουθο foundation
 * write δεν notify-άρει τον κάναβο. Το coordinate-follow scene write έχει ήδη
 * προσγειωθεί (πρώτο post-release RAF tick) πριν το settle (≥`SETTLE_MS`).
 *
 * @see ./useHostingReconciler.ts — id-preserving coordinate-follow (τρέχει ΠΡΩΤΟ)
 * @see ../../ui/ribbon/hooks/useRibbonFoundationBridge.ts — consumer (auto «Εσχάρα»)
 * @see docs/centralized-systems/reference/adrs/ADR-441-foundation-strip-grid-auto-design.md §10
 */

import { useEffect, useRef } from 'react';
import { DXF_TIMING } from '../../config/dxf-timing';
import { getGlobalGuideStore } from '../../systems/guides/guide-store';
import { getDraggingGuideId } from '../../systems/guides/guide-drag-store';
import { EventBus } from '../../systems/events/EventBus';
import type { AxisGuideReader } from '../../bim/foundations/foundation-from-grid';

interface LevelManagerLike {
  readonly currentLevelId: string | null;
}

export interface UseGridGuideSettleEmitterParams {
  readonly levelManager: LevelManagerLike;
}

/** ms αδράνειας κανάβου πριν θεωρηθεί «καθισμένος» ο οδηγός (μετά το coordinate-follow). */
const SETTLE_MS = DXF_TIMING.gesture.SETTLE; // ADR-516

/** Στρογγυλοποίηση offset (m) για floating-point-safe σύγκριση συνόλου αξόνων. */
const SIG_TOL = 1000;

/** Sorted rounded offsets ενός άξονα → string segment (visible-only). */
function axisOffsetsKey(reader: AxisGuideReader, axis: 'X' | 'Y'): string {
  const offs = reader
    .getGuidesByAxis(axis)
    .filter((g) => g.visible)
    .map((g) => Math.round(g.offset * SIG_TOL) / SIG_TOL)
    .sort((a, b) => a - b);
  return offs.join(',');
}

/**
 * SSoT signature του συνόλου των ορατών X/Y offsets. Αλλάζει σε move/add/remove/
 * visibility — οτιδήποτε αλλάζει την εσχάρα. Pure (testable χωρίς React).
 */
export function gridOffsetSignature(reader: AxisGuideReader): string {
  return `X:${axisOffsetsKey(reader, 'X')}|Y:${axisOffsetsKey(reader, 'Y')}`;
}

export function useGridGuideSettleEmitter({ levelManager }: UseGridGuideSettleEmitterParams): void {
  const levelManagerRef = useRef(levelManager);
  levelManagerRef.current = levelManager;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // null = μη αρχικοποιημένο → το πρώτο settle ορίζει baseline ΧΩΡΙΣ emit (αποφυγή
  // ψευδούς auto-reconcile στο αρχικό load/draw του κανάβου).
  const lastSigRef = useRef<string | null>(null);
  // Re-baseline σε αλλαγή ορόφου → ο νέος όροφος φορτώνει διαφορετικούς guides ΧΩΡΙΣ
  // να είναι «μετακίνηση» (αλλιώς spurious auto-reconcile σε κάθε level switch).
  const lastLevelIdRef = useRef<string | null>(null);

  useEffect(() => {
    const settle = (): void => {
      timerRef.current = null;
      // Όσο σύρεται οδηγός → δεν έχει «καθίσει»· νέα notify θα ξανα-προγραμματίσει.
      if (getDraggingGuideId() !== null) return;
      const levelId = levelManagerRef.current.currentLevelId;
      const sig = gridOffsetSignature(getGlobalGuideStore());
      const prev = lastSigRef.current;
      const levelChanged = levelId !== lastLevelIdRef.current;
      lastSigRef.current = sig;
      lastLevelIdRef.current = levelId;
      if (prev === null || levelChanged || prev === sig) return; // baseline / level-switch / no-change
      if (levelId) EventBus.emit('bim:grid-guides-settled', { levelId });
    };

    const schedule = (): void => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(settle, SETTLE_MS);
    };

    const unsubscribe = getGlobalGuideStore().subscribe(schedule);
    return () => {
      unsubscribe();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);
}
