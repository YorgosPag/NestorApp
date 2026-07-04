'use client';
// 🏢 ADR-363 Phase 1E — Wall re-trim effect helper
// Extracted from useSpecialTools.ts to keep that file ≤500 LOC (Google SRP).

import { useEffect } from 'react';
import { EventBus } from '../../systems/events/EventBus';
import { recomputeWallTrims } from '../../bim/walls/add-wall-to-scene';
// ADR-459 — structural-relevance gate SSoT (ίδιο με τους proactive structural hooks).
import { eventTouchesStructuralMember } from '../structural-relevant-trigger';
import type { LevelsHookReturn } from '../../systems/levels';

/**
 * ADR-363 Phase 1E / 1L-J — Re-trim all walls after a grip commit or an explicit
 * join-override change settles (200 ms debounce). Delegates to the SSoT
 * `recomputeWallTrims` (strip → recompute → apply → persist-changed) so a wall
 * that flips to `butt`/`disallow` correctly CLEARS its stale miter, and patched
 * neighbours persist. `LevelsHookReturn` structurally satisfies `WallSceneAccessor`.
 *
 * ADR-363 §wall-column-end-miter (Giorgio 2026-07-01) — το column-miter (τραπεζοειδές
 * κόψιμο άκρου τοίχου στην παρειά κολόνας) εξαρτάται από τα **column footprints**· γι'
 * αυτό ο retrim πυροδοτείται ΚΑΙ όταν αλλάζει κολόνα (`bim:column-params-updated`
 * rotate/resize) ή μετακινείται οποιοδήποτε δομικό (`bim:entities-moved`) — αλλιώς ο
 * τοίχος κρατούσε stale bevel/miter όταν η κολόνα μετακινιόταν/περιστρεφόταν μετά.
 */
export function useWallRetrimEffect(levelManager: LevelsHookReturn): void {
  useEffect(() => {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const schedule = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => recomputeWallTrims(levelManager), 200);
    };
    // ADR-459 relevance gate — ο wall-retrim εξαρτάται ΜΟΝΟ από τοίχους/κολόνες. Το generic
    // `bim:entities-moved` εκπέμπεται για ΚΑΘΕ entity· χωρίς gate, η μετακίνηση μιας απλής γραμμής
    // πυροδοτούσε full `recomputeWallTrims` → (cold, 1η φορά) οι τοίχοι «άλλαζαν» → re-emit structural
    // event → proactive load-takedown σε όλο το κτίριο (spurious toast «N μέλη έλαβαν φορτίο»). Τα άλλα
    // δύο events είναι ήδη structural-scoped (wall/column params) → περνούν ως έχουν.
    const scheduleOnStructuralMove = (payload: unknown): void => {
      if (!eventTouchesStructuralMember('bim:entities-moved', payload)) return;
      schedule();
    };
    const unsubs = [
      EventBus.on('bim:wall-params-updated', schedule),
      EventBus.on('bim:column-params-updated', schedule),
      EventBus.on('bim:entities-moved', scheduleOnStructuralMove),
    ];
    return () => {
      for (const off of unsubs) off();
      if (debounceTimer) clearTimeout(debounceTimer);
    };
  }, [levelManager]);
}
