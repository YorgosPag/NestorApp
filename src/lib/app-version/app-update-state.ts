/**
 * @fileoverview **«Κυκλοφόρησε νέα έκδοση, αλλά δεν ανανεώσαμε επειδή θα χανόταν δουλειά»** —
 * η κατάσταση που διαβάζει το banner.
 * @related ADR-860 §Ε3β
 * @module lib/app-version/app-update-state
 *
 * 🔑 **Πάνω στο `createExternalStore`** (`@/lib/state`) για τον ίδιο λόγο με το
 * `unsaved-work-registry.ts`: γράφεται από τον `recovery-coordinator` (κάτω από το React) και
 * διαβάζεται από το `AppUpdateBanner` με `useSyncExternalStore`.
 *
 * 🔑 **Μονόδρομο**: μόλις ανακοινωθεί νέα έκδοση, η καρτέλα **δεν** ξαναγίνεται «ενημερωμένη»
 * χωρίς ανανέωση. Γι' αυτό δεν υπάρχει `clear` — μόνο η ανανέωση καθαρίζει (νέα σελίδα).
 */

import { createExternalStore } from '@/lib/state/createExternalStore';

import type { DeploymentId } from './deployment-identity';

export interface AppUpdateSnapshot {
  readonly available: boolean;
  readonly serverDeploymentId: DeploymentId | null;
}

const NOT_AVAILABLE: AppUpdateSnapshot = { available: false, serverDeploymentId: null };

/** Ίδια έκδοση ⇒ κανένα `set` ⇒ σταθερό snapshot ⇒ κανένα re-render. */
const store = createExternalStore<AppUpdateSnapshot>(NOT_AVAILABLE, {
  equals: (a, b) => a.serverDeploymentId === b.serverDeploymentId,
});

/** Νέα έκδοση διαθέσιμη. Idempotent για την ίδια έκδοση. */
export function announceAppUpdate(serverDeploymentId: DeploymentId): void {
  store.set({ available: true, serverDeploymentId });
}

export const getAppUpdateSnapshot = store.get;

/** Για τον server render: ποτέ διαθέσιμη (η ανίχνευση γίνεται μόνο στον browser). */
export function getServerAppUpdateSnapshot(): AppUpdateSnapshot {
  return NOT_AVAILABLE;
}

export const subscribeAppUpdate = store.subscribe;
