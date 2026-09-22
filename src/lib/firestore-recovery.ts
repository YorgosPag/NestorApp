/**
 * =============================================================================
 * FIRESTORE RECOVERY LISTENER — Safety net for SDK internal assertions
 * =============================================================================
 *
 * Detects "FIRESTORE … INTERNAL ASSERTION FAILED (ID: …)" errors from the
 * firebase-js-sdk and performs a clean teardown + reload.
 * Safety net under the memory-cache strategy in `src/lib/firebase.ts`
 * (ADR-367 §2.5): memory cache removes the IndexedDB lease class of assertions,
 * this catches whatever SDK-internal path remains (e.g. ca9 listener churn, §2.4).
 *
 * Recovery flow:
 *   1. terminate(db)      — drop in-flight streams + connections
 *   2. location.reload()  — clean app restart (memory cache = nothing on disk to wipe)
 *
 * Mounted at the ROOT layout via `GlobalErrorSetup` — every route group, public
 * or not (ADR-367 §2.5: it used to live only in `(app)`, so `/search/results`
 * had no net at all).
 *
 * Guards:
 *   - Module-scope `installed` flag → listener mounted once per page lifetime.
 *   - `sessionStorage` flag → recovery sequence runs once per browser session
 *     (prevents reload-loop if corruption is persistent on the user's machine).
 *
 * @module lib/firestore-recovery
 * @enterprise ADR-367 — Firestore Internal Assertion Recovery
 */

import { terminate } from 'firebase/firestore';
import { db } from './firebase';
import { captureMessage } from './telemetry/sentry';

const SESSION_FLAG = 'firestore-recovery-fired';
const ASSERTION_PATTERN = /FIRESTORE.*INTERNAL ASSERTION FAILED/i;

let installed = false;

function extractMessage(payload: unknown): string {
  if (!payload) return '';
  if (typeof payload === 'string') return payload;
  if (payload instanceof Error) return payload.message;
  if (typeof payload === 'object' && payload !== null) {
    const obj = payload as { message?: unknown };
    if (typeof obj.message === 'string') return obj.message;
  }
  return String(payload);
}

function extractAssertionId(message: string): string {
  const match = message.match(/ID:\s*([a-z0-9]+)/i);
  return match ? match[1] : 'unknown';
}

async function runRecovery(message: string): Promise<void> {
  if (typeof window === 'undefined') return;
  if (sessionStorage.getItem(SESSION_FLAG) === '1') return;
  sessionStorage.setItem(SESSION_FLAG, '1');

  const assertionId = extractAssertionId(message);
  captureMessage('firestore-internal-assertion-recovery', 'error', {
    tags: { 'firestore.recovery': 'true', 'firestore.assertion_id': assertionId },
    extra: { message: message.slice(0, 500) },
  });

  try {
    await terminate(db);
  } catch {
    // Swallow — reload is the ultimate fallback.
  } finally {
    window.location.reload();
  }
}

function handleErrorEvent(event: ErrorEvent): void {
  const message = extractMessage(event.error) || event.message || '';
  if (!ASSERTION_PATTERN.test(message)) return;
  void runRecovery(message);
}

function handleRejection(event: PromiseRejectionEvent): void {
  const message = extractMessage(event.reason);
  if (!ASSERTION_PATTERN.test(message)) return;
  void runRecovery(message);
}

/**
 * Installs the global error listeners for Firestore SDK assertion recovery.
 * Idempotent: calling multiple times is a no-op after the first.
 * Must run on the client only.
 */
export function installFirestoreRecoveryListener(): void {
  if (installed) return;
  if (typeof window === 'undefined') return;
  installed = true;

  window.addEventListener('error', handleErrorEvent);
  window.addEventListener('unhandledrejection', handleRejection);
}
