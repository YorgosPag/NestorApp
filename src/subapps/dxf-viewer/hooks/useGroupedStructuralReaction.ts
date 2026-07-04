'use client';

/**
 * useGroupedStructuralReaction — SSoT για το pattern «proactive structural reaction με
 * atomic-undo grouping» (Revit transaction group).
 *
 * Οι proactive structural hooks (`useProactiveStructuralLoads`, `useProactiveMemberSizing`,
 * `useProactiveOrganismReinforce`, `useAutoFoundationDesign`) επαναλάμβαναν ΟΛΟΙ το ΙΔΙΟ
 * wiring boilerplate: `let scheduled` + `let groupable` + `queueMicrotask(recompute)` +
 * επιλογή `groupable ? executeGrouped : execute` + subscribe/unsubscribe σε λίστα events.
 * Αυτό το hook είναι η **μοναδική πηγή αλήθειας** αυτού του wiring:
 *
 * 1. **Coalescing ανά microtask** — μέσω του υπάρχοντος SSoT `createMicrotaskCoalescer`
 *    (ADR-488): πολλά events στο ίδιο tick → ΕΝΑ recompute (low-freq → ADR-040 safe).
 * 2. **Atomic-undo grouping** — αν το batch περιέχει **άμεση geometry edit** του χρήστη
 *    (`isGeometryEditTrigger`, incl. `*-delete-requested`), η αντίδραση εκτελείται με
 *    `executeGrouped` → ομαδοποιείται στο ΙΔΙΟ undo step με το user command (reuse
 *    `CommandHistory.appendToLast` + `CompositeCommand`, ADR-459 v8.3). Αλλιώς `execute`
 *    (standalone — batch from-grid / παράγωγα chain events).
 * 3. **Structural-relevance gate** — μέσω `eventTouchesStructuralMember`: τα generic
 *    events (`bim:entities-moved` / `drawing:entity-created`, που εκπέμπονται για **κάθε**
 *    τύπο entity) πυροδοτούν recompute ΜΟΝΟ αν το payload τους αγγίζει δομικό μέλος. Χωρίς
 *    αυτό, η μετακίνηση/δημιουργία μιας απλής γραμμής DXF έτρεχε full load-takedown/οπλισμό
 *    σε όλο το κτίριο (bug 2026-07-04).
 *
 * Ο καλών δίνει ΜΟΝΟ (α) τη λίστα events και (β) το `run(exec)` με τη δική του (μοναδική)
 * λογική recompute — η αντιγραμμένη υδραυλική ζει εδώ, μία φορά. Το `run` διαβάζεται μέσω
 * ref ώστε το microtask να βλέπει πάντα τις φρέσκες τιμές (levelManager/settings) χωρίς
 * re-subscribe σε κάθε render.
 *
 * @see proactive-coalescer.ts — createMicrotaskCoalescer (coalescing SSoT)
 * @see structural-geometry-edit-triggers.ts — isGeometryEditTrigger (classification SSoT)
 * @see structural-relevant-trigger.ts — eventTouchesStructuralMember (relevance gate SSoT)
 * @see core/commands/CommandHistory.ts — appendToLast / executeGrouped (grouping SSoT)
 * @see docs/centralized-systems/reference/adrs/ADR-459-structural-organism-connectivity.md §Phase 7
 */

import { useEffect, useRef } from 'react';
import { EventBus, type DrawingEventType } from '../systems/events/EventBus';
import { useCommandHistory } from '../core/commands/useCommandHistory';
import { createMicrotaskCoalescer } from './proactive-coalescer';
import { isGeometryEditTrigger } from './structural-geometry-edit-triggers';
import { eventTouchesStructuralMember } from './structural-relevant-trigger';
import type { ICommand } from '../core/commands/interfaces';

/** Η εκτέλεση command που επιλέγεται ανά pass: grouped (atomic undo) ή standalone. */
export type StructuralReactionExec = (command: ICommand) => void;

/**
 * Συνδρομή στα `events` με coalesced, atomic-undo-aware proactive αντίδραση.
 *
 * @param events Σταθερή (module-const) λίστα DrawingEventType για subscribe.
 * @param run    Η λογική recompute· καλείται με το επιλεγμένο `exec` (grouped/standalone).
 */
export function useGroupedStructuralReaction(
  events: readonly DrawingEventType[],
  run: (exec: StructuralReactionExec) => void,
): void {
  const { execute, executeGrouped } = useCommandHistory();
  const runRef = useRef(run);
  runRef.current = run;

  useEffect(() => {
    // Αν το τρέχον (coalesced) batch περιέχει άμεση geometry edit του χρήστη → η αντίδραση
    // ομαδοποιείται στο ίδιο atomic undo step με το user command· αλλιώς standalone.
    let groupable = false;
    const coalescer = createMicrotaskCoalescer(() => {
      const exec = groupable ? executeGrouped : execute;
      groupable = false;
      runRef.current(exec);
    });
    const schedule = (ev: DrawingEventType, payload: unknown): void => {
      // Structural-relevance gate: τα generic events (move/create οποιουδήποτε
      // entity) πυροδοτούν recompute ΜΟΝΟ αν αγγίζουν δομικό μέλος — αλλιώς η
      // μετακίνηση μιας απλής γραμμής θα έτρεχε full load-takedown σε όλο το κτίριο.
      if (!eventTouchesStructuralMember(ev, payload)) return;
      if (isGeometryEditTrigger(ev)) groupable = true;
      coalescer.schedule();
    };
    const unsubs = events.map((ev) => EventBus.on(ev, (payload) => schedule(ev, payload)));
    return () => unsubs.forEach((u) => u());
  }, [events, execute, executeGrouped]);
}
