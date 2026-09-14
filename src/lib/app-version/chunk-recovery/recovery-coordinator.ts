/**
 * @fileoverview **Η μηχανή ανάκαμψης** μιας αποτυχημένης φόρτωσης chunk.
 * @related ADR-860 §Ε3 · ADR-858 §5.5
 * @module lib/app-version/chunk-recovery/recovery-coordinator
 *
 * ```
 * αποτυχία φόρτωσης
 *   └─ επανάληψη ×N με backoff ─── πέτυχε ─────────────────────────▶ recovered-by-retry
 *        └─ ακόμα αποτυγχάνει ⇒ probe έκδοσης
 *             ├─ skewed ─┬─ μη αποθηκευμένη δουλειά ─────────────────▶ deferred-unsaved (banner)
 *             │          ├─ δικαίωμα ανανέωσης ───────────────────────▶ reloaded-for-skew
 *             │          └─ ήδη ανανεώθηκε για αυτή την έκδοση ──────▶ failed-already-reloaded
 *             ├─ same ───────────────────────────────────────────────▶ failed-same-version
 *             └─ unknown ────────────────────────────────────────────▶ failed-network
 * ```
 *
 * 🔑 **ΤΟ ΑΡΧΙΚΟ ΣΦΑΛΜΑ ΦΤΑΝΕΙ ΑΚΕΡΑΙΟ**: σε κάθε αποτυχία πετιέται το **τελευταίο**
 * `ChunkLoadError` όπως το έγραψε ο webpack — το error boundary βλέπει την αλήθεια, όχι
 * περιτύλιγμα. Ό,τι **δεν** είναι φόρτωση (π.χ. `ReferenceError` του ADR-858) περνά αμέσως.
 *
 * 🔑 **ΟΛΕΣ ΟΙ ΕΞΑΡΤΗΣΕΙΣ ΕΓΧΕΟΝΤΑΙ** — ο πυρήνας είναι καθαρή λογική, ελέγξιμη χωρίς DOM,
 * δίκτυο ή ρολόι. Η σύνδεση με τα πραγματικά modules γίνεται **μόνο** στο
 * `install-chunk-recovery.ts`.
 */

import { isChunkLoadError, type ChunkLoadError } from './chunk-load-error';
import type { SkewVerdict } from './skew-probe';

export type RecoveryOutcome =
  | 'recovered-by-retry'
  | 'reloaded-for-skew'
  | 'deferred-unsaved'
  | 'failed-already-reloaded'
  | 'failed-same-version'
  | 'failed-network';

export interface RecoveryDeps<T> {
  /** Ξαναζητά το **ίδιο** chunk (νέο `<script>`). */
  readonly load: () => Promise<T>;
  readonly maxRetries: number;
  readonly delayFor: (attempt: number) => number;
  readonly sleep: (ms: number) => Promise<void>;
  readonly probe: () => Promise<SkewVerdict>;
  readonly hasUnsavedWork: () => boolean;
  readonly claimReloadFor: (serverDeploymentId: string) => boolean;
  readonly isReloadPending: () => boolean;
  readonly reload: () => void;
  readonly announceUpdate: (serverDeploymentId: string) => void;
  readonly report: (outcome: RecoveryOutcome, error: ChunkLoadError, verdict: SkewVerdict | null) => void;
}

/** Υπόσχεση που δεν τελειώνει ποτέ: η σελίδα φεύγει — καμία οθόνη σφάλματος στο ενδιάμεσο. */
function awaitPageUnload<T>(): Promise<T> {
  return new Promise<T>(() => undefined);
}

type RetryResult<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: ChunkLoadError };

async function retryLoad<T>(initial: ChunkLoadError, deps: RecoveryDeps<T>): Promise<RetryResult<T>> {
  let last = initial;
  for (let attempt = 0; attempt < deps.maxRetries; attempt++) {
    if (deps.isReloadPending()) return { ok: false, error: last };
    await deps.sleep(deps.delayFor(attempt));
    try {
      return { ok: true, value: await deps.load() };
    } catch (error) {
      if (!isChunkLoadError(error)) throw error;
      last = error;
    }
  }
  return { ok: false, error: last };
}

async function resolveExhausted<T>(error: ChunkLoadError, deps: RecoveryDeps<T>): Promise<T> {
  if (deps.isReloadPending()) return awaitPageUnload<T>();
  const verdict = await deps.probe();

  if (verdict.kind === 'same') {
    deps.report('failed-same-version', error, verdict);
    throw error;
  }
  if (verdict.kind === 'unknown') {
    deps.report('failed-network', error, verdict);
    throw error;
  }
  if (deps.hasUnsavedWork()) {
    deps.announceUpdate(verdict.serverDeploymentId);
    deps.report('deferred-unsaved', error, verdict);
    throw error;
  }
  if (deps.claimReloadFor(verdict.serverDeploymentId)) {
    deps.report('reloaded-for-skew', error, verdict);
    deps.reload();
    return awaitPageUnload<T>();
  }
  if (deps.isReloadPending()) return awaitPageUnload<T>();
  deps.report('failed-already-reloaded', error, verdict);
  throw error;
}

/**
 * Ανάκαμψη μετά την **πρώτη** αποτυχία. Επιστρέφει ό,τι θα επέστρεφε η φόρτωση, ή πετά το
 * τελευταίο `ChunkLoadError` αυτούσιο.
 */
export async function recoverChunkLoad<T>(firstError: ChunkLoadError, deps: RecoveryDeps<T>): Promise<T> {
  const retried = await retryLoad(firstError, deps);
  if (retried.ok) {
    deps.report('recovered-by-retry', firstError, null);
    return retried.value;
  }
  return resolveExhausted(retried.error, deps);
}
