// ============================================================================
// ♿ KEYBOARD FOCUS MANAGER — Enterprise SSoT (ADR-366 Phase 4.5 / A.7.Q1)
// ============================================================================
//
// Pure state machine for keyboard-driven 3D entity navigation (Tab / Shift+Tab
// cycle, Enter select, Esc clear). Mirrors the HoverStore / ImmediatePositionStore
// observer-pattern SSoT (zero React state, zero `useSyncExternalStore`) per
// ADR-040 micro-leaf compliance — subscribers attach their own bridges.
//
// Lifecycle:
//   - Caller (ThreeJsSceneManager) owns instance per viewport.
//   - Caller recomputes ordered visible+sorted entity list on demand (frustum
//     cull + camera-distance sort) and pushes via `setOrder()`.
//   - `next()` / `prev()` advance the focus pointer through that order.
//   - Hidden floor / building filtering is the caller's responsibility — this
//     manager treats `order` as the canonical truth.
// ============================================================================

export type FocusListener = (focusedEntityId: string | null) => void;

/** Separate listener type for ARIA description consumers (semantic distinction from FocusListener). */
export type DescriptionListener = (entityId: string | null) => void;

export interface KeyboardFocusManagerApi {
  /** Currently focused entity bimId. null when no focus. */
  getFocused(): string | null;
  /**
   * Replace ordered focus list. If the current focus drops out of `orderedIds`,
   * focus is silently cleared. Mutating after-the-fact is supported — caller
   * resets the cache whenever camera/frustum/visibility changes.
   */
  setOrder(orderedIds: readonly string[]): void;
  /** Advance to next entity. Wraps. Returns the new focused id (null if empty). */
  next(): string | null;
  /** Step back to previous entity. Wraps. */
  prev(): string | null;
  /** Set focus to specific entity id, or null to clear. Idempotent. */
  setFocus(entityId: string | null): void;
  /** Clear focus without touching the cached order. */
  clear(): void;
  /** Subscribe to focus changes. Returns unsubscribe. */
  subscribe(listener: FocusListener): () => void;
  /** Subscribe specifically for ARIA description announcements. Returns unsubscribe. */
  subscribeDescription(listener: DescriptionListener): () => void;
  /** Drop all listeners + state. Use on viewport dispose. */
  dispose(): void;
}

export function createKeyboardFocusManager(): KeyboardFocusManagerApi {
  let focusedId: string | null = null;
  let order: readonly string[] = [];
  let disposed = false;
  const listeners = new Set<FocusListener>();
  const descriptionListeners = new Set<DescriptionListener>();

  function emit(): void {
    for (const listener of listeners) listener(focusedId);
    for (const listener of descriptionListeners) listener(focusedId);
  }

  function setFocus(entityId: string | null): void {
    if (disposed || entityId === focusedId) return;
    focusedId = entityId;
    emit();
  }

  function step(delta: 1 | -1): string | null {
    if (disposed || order.length === 0) {
      if (!disposed) setFocus(null);
      return null;
    }
    const currentIdx = focusedId === null ? -1 : order.indexOf(focusedId);
    // No prior focus → enter natural edge: next() starts at first, prev() at last.
    if (currentIdx === -1) {
      const edgeIdx = delta === 1 ? 0 : order.length - 1;
      setFocus(order[edgeIdx] ?? null);
      return focusedId;
    }
    const nextIdx = (currentIdx + delta + order.length) % order.length;
    setFocus(order[nextIdx] ?? null);
    return focusedId;
  }

  function setOrder(orderedIds: readonly string[]): void {
    if (disposed) return;
    order = orderedIds;
    if (focusedId !== null && !orderedIds.includes(focusedId)) {
      setFocus(null);
    }
  }

  return {
    getFocused: () => focusedId,
    setOrder,
    next: () => step(1),
    prev: () => step(-1),
    setFocus,
    clear: () => setFocus(null),
    subscribe: (listener) => {
      if (disposed) return () => undefined;
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    subscribeDescription: (listener) => {
      if (disposed) return () => undefined;
      descriptionListeners.add(listener);
      return () => {
        descriptionListeners.delete(listener);
      };
    },
    dispose: () => {
      disposed = true;
      listeners.clear();
      descriptionListeners.clear();
      focusedId = null;
      order = [];
    },
  };
}
