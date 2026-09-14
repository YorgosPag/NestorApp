/**
 * @fileoverview **«Άλλαξε η έκδοση από τότε που φόρτωσε αυτή η καρτέλα;»**
 * @related ADR-860 §Ε3
 * @module lib/app-version/chunk-recovery/skew-probe
 *
 * Ρωτά το `/api/build-info` και συγκρίνει με την έκδοση **αυτού** του bundle. Τρεις απαντήσεις,
 * και η τρίτη είναι εξίσου σημαντική με τις δύο πρώτες:
 *
 *   `skewed`  — ο server σερβίρει **άλλη** έκδοση ⇒ ο κώδικας που ζητάμε ίσως δεν υπάρχει πια.
 *   `same`    — **ίδια** έκδοση ⇒ η αποτυχία δεν οφείλεται σε deploy· ανανέωση δεν θα βοηθούσε.
 *   `unknown` — δεν μάθαμε (δίκτυο κάτω, τοπικό build χωρίς ταυτότητα) ⇒ **ποτέ** δεν
 *               ερμηνεύεται ως `skewed`: μια ανανέωση χωρίς δίκτυο αφήνει τον άνθρωπο με
 *               **λευκή** σελίδα του browser αντί για τη δική μας οθόνη σφάλματος.
 *
 * 🔑 **ΕΝΑ ΑΙΤΗΜΑ ΓΙΑ ΠΟΛΛΕΣ ΤΑΥΤΟΧΡΟΝΕΣ ΑΠΟΤΥΧΙΕΣ**: όσο ένα probe είναι σε πτήση, κάθε νέος
 * καλών παίρνει την **ίδια** υπόσχεση. Μετά την απάντηση καθαρίζει — η επόμενη αποτυχία ρωτά
 * ξανά, γιατί στο μεταξύ μπορεί να έγινε **άλλο** deploy.
 */

import { fetchJson } from '@/lib/api/fetch-json';
import { withTimeout } from '@/lib/async-utils';
import { BUILD_INFO_PATH, type BuildInfoResponse } from '@/lib/app-version/build-info-contract';
import { getDeploymentId, type DeploymentId } from '@/lib/app-version/deployment-identity';

export type SkewVerdict =
  | { readonly kind: 'skewed'; readonly serverDeploymentId: DeploymentId }
  | { readonly kind: 'same' }
  | { readonly kind: 'unknown' };

/** Οροφή αναμονής: ο άνθρωπος περιμένει ήδη τις επαναλήψεις. */
export const SKEW_PROBE_TIMEOUT_MS = 4_000;

/** Καθαρή κρίση — χωρίς δίκτυο, για tests. */
export function judgeSkew(clientId: DeploymentId | null, serverId: DeploymentId | null): SkewVerdict {
  if (clientId === null || serverId === null) return { kind: 'unknown' };
  return clientId === serverId ? { kind: 'same' } : { kind: 'skewed', serverDeploymentId: serverId };
}

async function askServer(): Promise<SkewVerdict> {
  try {
    const info = await withTimeout(
      fetchJson<BuildInfoResponse>(BUILD_INFO_PATH, { cache: 'no-store' }),
      SKEW_PROBE_TIMEOUT_MS,
    );
    return judgeSkew(getDeploymentId(), info.deploymentId ?? null);
  } catch {
    return { kind: 'unknown' };
  }
}

let inFlight: Promise<SkewVerdict> | null = null;

/** Η κρίση για **τώρα**. Ποτέ δεν απορρίπτει. */
export function probeDeploymentSkew(): Promise<SkewVerdict> {
  if (inFlight === null) {
    inFlight = askServer().finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}
