/**
 * @fileoverview **Η σύνδεση της ανάκαμψης με τον φορτωτή chunks του webpack.**
 * @related ADR-860 §Ε3 · instrumentation-client.ts
 * @module lib/app-version/chunk-recovery/install-chunk-recovery
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΓΙΑΤΙ ΕΔΩ ΚΑΙ ΟΧΙ ΣΤΟ ERROR BOUNDARY
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το `next/dynamic` είναι `React.lazy(() => loader())` (`lazy-dynamic/loadable.js:30`), και το
 * `React.lazy` **κρατά μόνιμα** την απόρριψη. Όταν ένα σφάλμα φτάσει στο error boundary, κανένα
 * `reset()` δεν μπορεί πια να ξαναφορτώσει το chunk. Η επανάληψη πρέπει να γίνει **πριν** η
 * απόρριψη φτάσει στο React — δηλαδή στο `__webpack_require__.e`, από όπου περνά **κάθε**
 * δυναμική φόρτωση (JS και CSS), χωρίς να αγγιχτεί κανένα από τα 111 σημεία `dynamic()`.
 *
 * 🔑 **Το ιδίωμα είναι του ίδιου του Next**: το `next/dist/esm/client/app-webpack.js` τυλίγει
 * με τον ίδιο τρόπο το `__webpack_require__.u`.
 *
 * ✅ **Η επανάληψη είναι εφικτή — μετρημένο**: μετά την αποτυχία ο runtime κάνει
 * `installedChunks[id] = undefined`, άρα νέο `.e(id)` δημιουργεί **νέο** `<script>`.
 *
 * ⚠️ **No-op** όταν δεν υπάρχει webpack runtime (Turbopack dev, SSR, jest) και **idempotent**
 * (σημάδι στη συνάρτηση): δεύτερη εγκατάσταση δεν τυλίγει δύο φορές.
 */

import { sleep } from '@/lib/async-utils';

import { announceAppUpdate } from '@/lib/app-version/app-update-state';
import { hasUnsavedWork } from '@/lib/app-version/unsaved-work-registry';

import { isChunkLoadError, type ChunkLoadError } from './chunk-load-error';
import { reportChunkRecovery } from './chunk-recovery-telemetry';
import { recoverChunkLoad, type RecoveryDeps } from './recovery-coordinator';
import { claimReloadFor, isReloadPending } from './reload-guard';
import { CHUNK_RETRY_POLICY, retryDelayMs } from './retry-policy';
import { probeDeploymentSkew } from './skew-probe';

type ChunkId = string | number;
type EnsureChunk = (chunkId: ChunkId) => Promise<unknown>;

/** Το μέρος του webpack runtime που μας αφορά. */
export interface WebpackChunkRuntime {
  e: EnsureChunk;
}

const INSTALLED_MARK = Symbol.for('nestor.chunkRecovery.installed');

type MarkedEnsureChunk = EnsureChunk & { [INSTALLED_MARK]?: true };

function productionDeps(load: () => Promise<unknown>): RecoveryDeps<unknown> {
  return {
    load,
    maxRetries: CHUNK_RETRY_POLICY.maxRetries,
    delayFor: (attempt) => retryDelayMs(attempt),
    sleep,
    probe: probeDeploymentSkew,
    hasUnsavedWork,
    claimReloadFor,
    isReloadPending,
    reload: () => window.location.reload(),
    announceUpdate: announceAppUpdate,
    report: reportChunkRecovery,
  };
}

/**
 * Τυλίγει το `runtime.e`. Επιστρέφει `true` μόνο αν εγκαταστάθηκε **τώρα**.
 */
export function installChunkRecovery(runtime: WebpackChunkRuntime | undefined): boolean {
  if (typeof window === 'undefined' || !runtime || typeof runtime.e !== 'function') return false;
  const original: MarkedEnsureChunk = runtime.e;
  if (original[INSTALLED_MARK]) return false;

  const load = (chunkId: ChunkId): Promise<unknown> => original.call(runtime, chunkId);

  const wrapped: MarkedEnsureChunk = (chunkId) =>
    load(chunkId).catch((error: unknown) => {
      if (!isChunkLoadError(error)) throw error;
      return recoverChunkLoad(error as ChunkLoadError, productionDeps(() => load(chunkId)));
    });

  wrapped[INSTALLED_MARK] = true;
  runtime.e = wrapped;
  return true;
}
