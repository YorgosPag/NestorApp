/**
 * Entity join-state SSoT (ADR-532 B4) — derives the context-menu join flags
 * (`canJoin` + `joinResultLabel`) from a selection id list and the selection-agnostic
 * {@link useEntityJoin} hook. Reused by both `useCanvasEditActions` (orchestrator)
 * and `EntityContextMenuHost` (selection-subscribed leaf) so the two never drift.
 */
import type { useEntityJoin } from '../useEntityJoin';

/**
 * Perf guard — `getJoinPreview` runs an O(n²) segment-chain (force-connect) just
 * to derive a context-menu label. On large selections (e.g. marquee-selecting a
 * whole floorplan before a mass-delete) that chaining saturates the main thread
 * and drops FPS to ~1, which in turn starves the auto-save fetch into a 60s
 * timeout. The label is only meaningful for the small "join these few segments"
 * case, so above this size we keep the menu enabled (cheap `canJoin`) but skip
 * the preview. See HANDOFF 2026-06-16 perf FPS-1 + ADR-186.
 */
const JOIN_PREVIEW_MAX_SELECTION = 64;

export interface EntityJoinState {
  canJoin: boolean;
  joinResultLabel?: string;
}

export function computeEntityJoinState(
  entityJoinHook: ReturnType<typeof useEntityJoin>,
  selectedEntityIds: string[],
): EntityJoinState {
  const canJoin = entityJoinHook.canJoin(selectedEntityIds);
  const preview = canJoin && selectedEntityIds.length <= JOIN_PREVIEW_MAX_SELECTION
    ? entityJoinHook.getJoinPreview(selectedEntityIds)
    : null;
  return {
    canJoin,
    joinResultLabel: preview?.resultType !== 'not-joinable' ? preview?.resultType : undefined,
  };
}
