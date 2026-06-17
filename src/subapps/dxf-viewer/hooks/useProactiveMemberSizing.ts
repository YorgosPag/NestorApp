'use client';

/**
 * useProactiveMemberSizing — ADR-475 (PROACTIVE αυτόματη διαστασιολόγηση μελών).
 *
 * Καθρεφτίζει το `useProactiveOrganismReinforce` (ADR-459 Φ8): μόλις ο στατικός
 * οργανισμός δημιουργείται/μεγαλώνει ή αλλάζουν τα tributary φορτία, ξανα-τρέχει
 * αυτόματα — χωρίς κουμπί — τη διαστασιολόγηση διατομής των AUTO δοκαριών μέσω του
 * SSoT πυρήνα `runMemberAutoSize`. Σενάριο-στόχος: σχεδιάζεις δοκάρι 10 m → το ύψος
 * αυτο-προσαρμόζεται (~800 mm) ώστε να ικανοποιεί EC2 §7.4.2 (βέλος) + ULS.
 *
 * **Σειρά στην αλυσίδα:** το `bim:structural-loads-computed` (από
 * `useProactiveStructuralLoads`/Φ9) είναι το κύριο trigger — ΚΑΘΕ geometry edit
 * περνά πρώτα από το load takedown, οπότε αρκεί αυτό + τα create/move/from-grid για
 * την αρχική διαστασιολόγηση. **Mount ΠΡΙΝ** το `useProactiveOrganismReinforce` ώστε
 * ο οπλισμός να υπολογίζεται στη νέα διατομή σε ένα pass.
 *
 * **Loop guard (κρίσιμο):** ΔΕΝ ακούει `bim:beam-params-updated` — είναι το event
 * που ΕΚΠΕΜΠΕΙ το ίδιο (αλλιώς άμεσος κύκλος). Η αλυσίδα `sizing → beam-params-updated
 * → loads → loads-computed → sizing` τερματίζει στον convergence guard (50mm-quantized
 * → ίδια διατομή → μηδέν patch). **Idempotent:** locked (`autoSized:false`) / converged
 * μέλη → no-op.
 *
 * **Atomic undo:** geometry-edit triggers (έχουν δικό τους command στο stack) → η
 * διαστασιολόγηση ομαδοποιείται στο ΙΔΙΟ undo step (`executeGrouped`)· τα batch
 * (from-grid) + το loads-computed → standalone.
 *
 * **Σιωπηλό (Revit-grade):** καμία ειδοποίηση — background συμπεριφορά.
 * ADR-040 safe: low-freq, coalesced ανά microtask.
 *
 * @see hooks/member-auto-size-core.ts — runMemberAutoSize (SSoT)
 * @see hooks/useProactiveOrganismReinforce.ts — το proactive πρότυπο (Φ8)
 * @see docs/centralized-systems/reference/adrs/ADR-475-auto-member-sizing.md
 */

import { useEffect } from 'react';
import { EventBus, type DrawingEventType } from '../systems/events/EventBus';
import { useCommandHistory } from '../core/commands/useCommandHistory';
import { resolveStructuralCode } from '../bim/structural/codes';
import { useStructuralSettingsStore } from '../state/structural-settings-store';
import { runMemberAutoSize, type MemberSizeLevelManager } from './member-auto-size-core';

/**
 * Μεταβολές που απαιτούν re-sizing. ΟΧΙ `bim:beam-params-updated` (self-emit → loop)·
 * οι span/load αλλαγές καλύπτονται μέσω `bim:structural-loads-computed` (κάθε geometry
 * edit τριγκάρει πρώτα load takedown).
 */
const PROACTIVE_SIZE_EVENTS: readonly DrawingEventType[] = [
  'drawing:entity-created',
  'bim:entities-moved',
  'bim:beams-from-grid',
  'bim:structural-loads-computed',
];

/**
 * Άμεσες geometry edits του χρήστη (δικό τους command στο undo stack) → η
 * διαστασιολόγηση ομαδοποιείται στο ΙΔΙΟ atomic undo step (Revit transaction group).
 */
const GEOMETRY_EDIT_TRIGGERS: ReadonlySet<DrawingEventType> = new Set([
  'drawing:entity-created',
  'bim:entities-moved',
]);

export function useProactiveMemberSizing(props: { levelManager: MemberSizeLevelManager }): void {
  const { levelManager } = props;
  const { execute, executeGrouped } = useCommandHistory();

  useEffect(() => {
    let scheduled = false;
    let groupable = false;

    const recompute = (): void => {
      scheduled = false;
      const shouldGroup = groupable;
      groupable = false;
      const provider = resolveStructuralCode(useStructuralSettingsStore.getState().codeId);
      runMemberAutoSize(levelManager, provider, shouldGroup ? executeGrouped : execute);
    };

    const schedule = (ev: DrawingEventType): void => {
      if (GEOMETRY_EDIT_TRIGGERS.has(ev)) groupable = true;
      if (scheduled) return;
      scheduled = true;
      queueMicrotask(recompute);
    };

    const unsubs = PROACTIVE_SIZE_EVENTS.map((ev) => EventBus.on(ev, () => schedule(ev)));
    return () => unsubs.forEach((u) => u());
  }, [levelManager, execute, executeGrouped]);
}
