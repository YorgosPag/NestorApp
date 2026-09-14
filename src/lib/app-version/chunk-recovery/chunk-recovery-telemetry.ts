/**
 * @fileoverview **Κάθε περιστατικό φόρτωσης κώδικα μετριέται — με την ΕΚΒΑΣΗ του.**
 * @related ADR-860 §Ε4
 * @module lib/app-version/chunk-recovery/chunk-recovery-telemetry
 *
 * 🔴 **ΓΙΑΤΙ**: ως τις 2026-09-14 το `config/error-reporting.ts` **αγνοούσε** το `'Loading chunk'`.
 * Δύο περιστατικά deploy skew (ADR-858 §5.5 · ADR-860) δεν εμφανίστηκαν ποτέ σε μέτρηση — τα
 * είδε μόνο άνθρωπος στην οθόνη. Το «0 = κανείς δεν κοίταξε».
 *
 * 🔑 **ΕΝΑ ΓΕΓΟΝΟΣ ΑΝΑ ΠΕΡΙΣΤΑΤΙΚΟ, ΜΕ ΕΚΒΑΣΗ** — όχι ένα ανά αποτυχία. Το ερώτημα που μας
 * ενδιαφέρει δεν είναι «πόσα chunks απέτυχαν» αλλά **«πόσοι άνθρωποι είδαν οθόνη σφάλματος και
 * γιατί»**: `recovered-*`/`reloaded-*`/`deferred-*` = δεν την είδαν, `failed-*` = την είδαν.
 *
 * 🔑 **`warning`, ΟΧΙ `error`**: το `ErrorTracker` στέλνει email στον admin για `error`/`critical`.
 * Μια ανάκαμψη που **πέτυχε** δεν είναι λόγος να ξυπνήσει κάποιος.
 *
 * ⚠️ Το `ErrorTracker` κρατά τα γεγονότα και στο `localStorage` (`persistErrors`) — άρα το
 * γεγονός `reloaded-for-skew` **επιβιώνει** της ανανέωσης που το ακολουθεί.
 */

import { errorTracker } from '@/services/ErrorTracker';

import { getDeploymentId } from '@/lib/app-version/deployment-identity';

import { chunkRequestOf, type ChunkLoadError } from './chunk-load-error';
import type { RecoveryOutcome } from './recovery-coordinator';
import type { SkewVerdict } from './skew-probe';

function serverIdOf(verdict: SkewVerdict | null): string | null {
  return verdict?.kind === 'skewed' ? verdict.serverDeploymentId : null;
}

export function reportChunkRecovery(
  outcome: RecoveryOutcome,
  error: ChunkLoadError,
  verdict: SkewVerdict | null,
): void {
  errorTracker.captureError(error, 'warning', 'network', {
    component: 'ChunkRecovery',
    action: outcome,
    metadata: {
      chunkOutcome: outcome,
      chunkUrl: chunkRequestOf(error),
      skewVerdict: verdict?.kind ?? null,
      clientDeploymentId: getDeploymentId(),
      serverDeploymentId: serverIdOf(verdict),
    },
  });
}
