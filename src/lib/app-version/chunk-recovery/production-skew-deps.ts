/**
 * @fileoverview **Οι ΠΡΑΓΜΑΤΙΚΕΣ εξαρτήσεις της κρίσης skew** — μία φορά, για κάθε σήμα.
 * @related ADR-860 §Ε3 · §Ε6
 * @module lib/app-version/chunk-recovery/production-skew-deps
 *
 * Δύο σήματα οδηγούν στην ίδια κρίση (`resolveBySkew`): η αποτυχία φόρτωσης chunk
 * (`install-chunk-recovery`) και το module που λείπει από τον runtime
 * (`install-module-skew-recovery`). Αν ο καθένας έφτιαχνε τις δικές του εξαρτήσεις, ένα
 * δεύτερο `reload`/`claimReloadFor` θα μπορούσε να ξεφύγει από το φρένο «μία ανανέωση ανά
 * έκδοση» — εδώ υπάρχει **ένα** σύνολο.
 */

import { announceAppUpdate } from '@/lib/app-version/app-update-state';
import { hasUnsavedWork } from '@/lib/app-version/unsaved-work-registry';

import { reportChunkRecovery } from './chunk-recovery-telemetry';
import type { SkewDeps } from './recovery-coordinator';
import { claimReloadFor, isReloadPending } from './reload-guard';
import { probeDeploymentSkew } from './skew-probe';

export function productionSkewDeps(): SkewDeps {
  return {
    probe: probeDeploymentSkew,
    hasUnsavedWork,
    claimReloadFor,
    isReloadPending,
    reload: () => window.location.reload(),
    announceUpdate: announceAppUpdate,
    report: reportChunkRecovery,
  };
}
