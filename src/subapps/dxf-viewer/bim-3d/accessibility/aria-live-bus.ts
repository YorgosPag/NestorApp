// ============================================================================
// ♿ ARIA LIVE BUS — Singleton announcement bus (ADR-366 Phase 8.0 / A.7.Q2)
// ============================================================================
//
// Module-level singleton. Zero React. Consumers subscribe to receive
// announcements; AriaLiveRegion writes them to the DOM aria-live regions.
//
// Idempotency: same message within IDEMPOTENCY_MS = no-op (prevents duplicate
// SR reads on rapid double-fire from overlapping store updates).
//
// API:
//   ariaLiveBus.announce(message, severity)   // fire
//   ariaLiveBus.subscribe(listener)           // returns unsubscribe fn
//   ariaLiveBus._resetForTests()              // test utility only
// ============================================================================

export type AriaSeverity = 'polite' | 'assertive';
export type AriaAnnounceListener = (message: string, severity: AriaSeverity) => void;

const IDEMPOTENCY_MS = 200;

const listeners = new Set<AriaAnnounceListener>();
let lastMsg = '';
let lastMsgTime = 0;

export const ariaLiveBus = {
  announce(message: string, severity: AriaSeverity = 'polite'): void {
    if (!message) return;
    const now = Date.now();
    if (message === lastMsg && now - lastMsgTime < IDEMPOTENCY_MS) return;
    lastMsg = message;
    lastMsgTime = now;
    for (const listener of listeners) listener(message, severity);
  },

  subscribe(listener: AriaAnnounceListener): () => void {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  },

  _resetForTests(): void {
    lastMsg = '';
    lastMsgTime = 0;
    listeners.clear();
  },
} as const;
