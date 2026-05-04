/**
 * Spend Analytics invalidation bus — Tier-2 SSoT helper.
 *
 * Module-singleton `EventTarget` that lets PO mutation services tell the
 * `useSpendAnalytics` hook (same tab) to drop its stale cache and refetch.
 * Sync, fire-and-forget — no Firestore `onSnapshot`, no cross-tab sync.
 *
 * @module lib/cache/spend-analytics-bus
 * @see ADR-331 §4 D14 — Event-bus invalidation strategy
 */

const EVENT_NAME = 'spend-analytics:invalidate';

const bus: EventTarget = typeof EventTarget !== 'undefined' ? new EventTarget() : ({
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
  dispatchEvent: () => true,
} as unknown as EventTarget);

/** Fire-and-forget invalidation signal. Safe to call from anywhere. */
export function emitSpendAnalyticsInvalidate(): void {
  bus.dispatchEvent(new Event(EVENT_NAME));
}

/**
 * Subscribes to invalidation events. Returns an unsubscribe function suitable
 * for direct return from `useEffect`.
 */
export function onSpendAnalyticsInvalidate(handler: () => void): () => void {
  const listener = (): void => handler();
  bus.addEventListener(EVENT_NAME, listener);
  return () => bus.removeEventListener(EVENT_NAME, listener);
}
