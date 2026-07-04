/**
 * structural-relevant-trigger — SSoT: «αξίζει αυτό το event να πυροδοτήσει
 * δομοστατικό recompute;» (structural-relevance gate των proactive hooks).
 *
 * **Η ρίζα του bug (2026-07-04):** οι proactive structural hooks
 * (`useProactiveStructuralLoads` / `useProactiveOrganismReinforce` /
 * `useProactiveMemberSizing` / `useAutoFoundationDesign`) ακούν τα **generic**
 * events `bim:entities-moved` + `drawing:entity-created` (εκπέμπονται για **ΚΑΘΕ**
 * τύπο entity) και ξανα-τρέχαν full load-takedown/οπλισμό/θεμελίωση **ανεξαίρετα**.
 * Αποτέλεσμα: η μετακίνηση μιας απλής γραμμής DXF (ή διάστασης/hatch/επίπλου) έβγαζε
 * toast «N μέλη έλαβαν αυτόματο φορτίο» και έτρεχε βαρύ υπολογισμό σε όλο το κτίριο.
 *
 * Αυτός ο gate εξετάζει το **payload** των δύο generic events και επιτρέπει το
 * recompute ΜΟΝΟ όταν τουλάχιστον ένα εμπλεκόμενο entity είναι **δομικό μέλος**
 * (SSoT `isStructuralMemberType`). Κάθε άλλο subscribed event είναι ήδη
 * type-scoped (`bim:*-params-updated` / `*-delete-requested`), batch
 * (`*-from-grid` / `*-from-perimeter`) ή παράγωγο chain event
 * (`bim:structural-loads-computed`) → πάντα δομικά σχετικό.
 *
 * @see types/structural-entity-types.ts — isStructuralMemberType (SSoT)
 * @see hooks/useGroupedStructuralReaction.ts — μοναδικό call site (καλύπτει και τα 4 hooks)
 */

import type { DrawingEventType } from '../systems/events/EventBus';
import { isStructuralMemberType } from '../types/structural-entity-types';

/** Minimal shape: οτιδήποτε φέρει `type: string`. */
interface TypedEntity {
  readonly type: string;
}

function isTypedEntity(value: unknown): value is TypedEntity {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { type?: unknown }).type === 'string'
  );
}

/**
 * `true` αν το event (με το payload του) αγγίζει δομικό μέλος → αξίζει recompute.
 *
 * Τα generic events (`bim:entities-moved` / `drawing:entity-created`) φιλτράρονται
 * με βάση τον τύπο των entities τους· όλα τα υπόλοιπα events περνούν ως έχουν
 * (είναι ήδη δομικά scoped). Αν το payload έχει άγνωστο shape → **δεν** κόβουμε
 * (safe default: καλύτερα ένα περιττό recompute παρά χαμένη ενημέρωση).
 */
export function eventTouchesStructuralMember(ev: DrawingEventType, payload: unknown): boolean {
  if (ev === 'bim:entities-moved') {
    const moved = (payload as { movedEntities?: readonly unknown[] } | undefined)?.movedEntities;
    if (!Array.isArray(moved)) return true;
    return moved.some((e) => isTypedEntity(e) && isStructuralMemberType(e.type));
  }
  if (ev === 'drawing:entity-created') {
    const entity = (payload as { entity?: unknown } | undefined)?.entity;
    return isTypedEntity(entity) && isStructuralMemberType(entity.type);
  }
  return true;
}
