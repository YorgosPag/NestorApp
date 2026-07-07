/**
 * ACTIVE-GROUP STORE — «enter group» drill-in state (SSoT, zero React state).
 *
 * Figma / Revit «Edit Group» / Cinema 4D null-object model: double-click a GROUP to
 * step INTO it and edit its members individually; Esc (or click outside) steps back
 * out. Nesting is a STACK — entering a group-inside-a-group pushes another level, so
 * the breadcrumb + exit semantics stay correct for groups-of-groups.
 *
 * Follows the {@link HoverStore} pattern: a mutable singleton with an optional React
 * subscription via useSyncExternalStore (see {@link useActiveGroup}). Event-time
 * consumers (hit-test / click / Esc handlers) read the getters directly — never a
 * stale React snapshot (ADR-040 dual-access invariant).
 *
 * WHY a store (not React state): the drill-in level gates hover resolution, click
 * selection, member hit-testing AND render fading — all of which live in micro-leaf
 * subscribers + event-time handlers, none of which should re-render the orchestrator.
 *
 * ADR-575 §selection/hover semantics.
 */

type ActiveGroupListener = () => void;

// ─── Internal mutable state ───────────────────────────────────────────────────
// Stack of entered GROUP container ids, outermost first; the LAST entry is the
// currently-active group (the one whose members are individually editable).
let stack: readonly string[] = Object.freeze([]);

const subscribers = new Set<ActiveGroupListener>();

function emit(): void {
  subscribers.forEach((cb) => cb());
}

// ─── Mutations ────────────────────────────────────────────────────────────────

/**
 * Enter GROUP `groupId` — push it as the new active level. No-op when it is already
 * the active (top) level, so a repeat double-click doesn't churn subscribers.
 */
export function enterGroup(groupId: string): void {
  if (!groupId) return;
  if (stack.length > 0 && stack[stack.length - 1] === groupId) return;
  stack = Object.freeze([...stack, groupId]);
  emit();
}

/** Exit the current (innermost) group — step back ONE level. No-op when not inside any group. */
export function exitActiveGroup(): void {
  if (stack.length === 0) return;
  stack = Object.freeze(stack.slice(0, -1));
  emit();
}

/** Exit ALL groups — back to the top scene level. No-op when already at the top. */
export function exitAllGroups(): void {
  if (stack.length === 0) return;
  stack = Object.freeze([]);
  emit();
}

// ─── Getters (snapshot-compatible for useSyncExternalStore) ──────────────────

/** The currently-active (innermost) GROUP container id, or `null` at the top level. */
export function getActiveGroupId(): string | null {
  return stack.length > 0 ? stack[stack.length - 1] : null;
}

/** The full drill-in stack (outermost first). Stable reference until it mutates. */
export function getActiveGroupStack(): readonly string[] {
  return stack;
}

/** True when currently inside `groupId` at ANY depth of the drill-in stack. */
export function isInsideGroup(groupId: string): boolean {
  return stack.includes(groupId);
}

// ─── Subscription (for useSyncExternalStore) ─────────────────────────────────

export function subscribeActiveGroup(cb: ActiveGroupListener): () => void {
  subscribers.add(cb);
  return () => { subscribers.delete(cb); };
}
