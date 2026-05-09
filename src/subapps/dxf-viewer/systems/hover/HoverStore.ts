/**
 * HOVER STORE — micro-leaf singleton for hovered entity/overlay IDs.
 *
 * Follows the same pattern as ImmediateSnapStore: mutable singleton with
 * optional React subscription via useSyncExternalStore.
 *
 * WHY: hoveredEntityId / hoveredOverlayId were useState in CanvasSection.
 * Every hover update caused a full CanvasSection → CanvasLayerStack cascade
 * through 13+ hooks. Moving them here limits re-renders to leaf subscribers.
 *
 * ADR-040: Mouse Position SSoT / Phase E micro-leaf subscriber pattern.
 */

type HoverListener = () => void;

// ─── Internal mutable state ───────────────────────────────────────────────────
let hoveredEntityId: string | null = null;
let hoveredOverlayId: string | null = null;

const entitySubscribers = new Set<HoverListener>();
const overlaySubscribers = new Set<HoverListener>();

// ─── Setters ─────────────────────────────────────────────────────────────────

/** Set hovered DXF entity ID. Skip-if-unchanged optimization prevents redundant notifications. */
export function setHoveredEntity(id: string | null): void {
  if (id === hoveredEntityId) return;
  hoveredEntityId = id;
  entitySubscribers.forEach((cb) => cb());
}

/** Set hovered overlay (ColorLayer) ID. Skip-if-unchanged optimization. */
export function setHoveredOverlay(id: string | null): void {
  if (id === hoveredOverlayId) return;
  hoveredOverlayId = id;
  overlaySubscribers.forEach((cb) => cb());
}

// ─── Getters (snapshot-compatible for useSyncExternalStore) ──────────────────

export function getHoveredEntity(): string | null {
  return hoveredEntityId;
}

export function getHoveredOverlay(): string | null {
  return hoveredOverlayId;
}

// ─── Subscription (for useSyncExternalStore) ─────────────────────────────────

export function subscribeHoveredEntity(cb: HoverListener): () => void {
  entitySubscribers.add(cb);
  return () => { entitySubscribers.delete(cb); };
}

export function subscribeHoveredOverlay(cb: HoverListener): () => void {
  overlaySubscribers.add(cb);
  return () => { overlaySubscribers.delete(cb); };
}
