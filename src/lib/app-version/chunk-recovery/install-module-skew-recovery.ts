/**
 * @fileoverview **Module που λείπει από τον runtime ⇒ ρώτα την έκδοση** (ADR-860 §Ε6).
 * @related ADR-860 §Ε3 · §Ε6 · instrumentation-client.ts · ErrorBoundary/useErrorActions.ts
 * @module lib/app-version/chunk-recovery/install-module-skew-recovery
 *
 * Το σφάλμα φτάνει από **δύο** δρόμους, και οι δύο καλύπτονται:
 *
 *   • **ανεπεξέργαστο** — το prefetch ενός RSC payload εκτελεί modules έξω από το React
 *     (μετρημένο 2026-09-25: `EXCEPTION` στην κονσόλα) ⇒ `error` / `unhandledrejection`·
 *   • **μέσα σε error boundary** — ένα lazy module του δέντρου αποτυγχάνει στην απόδοση. Ο React
 *     19 **δεν** το στέλνει στο `window` ⇒ το καλεί το `useErrorActions`, το κοινό hook και των
 *     δύο fallback (`ErrorBoundaryClass` + `RouteErrorFallback`).
 *
 * 🔑 **Δεν αντικαθιστά ΤΙΠΟΤΑ από την υπάρχουσα ροή σφάλματος**: κανένα `preventDefault`, καμία
 * κατάποση. Αν ο server πει «ίδια έκδοση», ο άνθρωπος βλέπει ό,τι θα έβλεπε πριν.
 *
 * 🔑 **Διπλή αναφορά του ίδιου σφάλματος** (window **και** boundary) είναι ακίνδυνη: το probe σε
 * πτήση μοιράζεται και το `claimReloadFor` δίνει **μία** ανανέωση ανά έκδοση.
 */

import { isMissingModuleError } from './missing-module-error';
import { productionSkewDeps } from './production-skew-deps';
import { resolveBySkew, type SkewDeps } from './recovery-coordinator';

/**
 * Αν το `error` είναι module που λείπει, ξεκινά την κρίση skew και επιστρέφει `true`.
 * Δεν πετά ποτέ· η τελική απόρριψη του `resolveBySkew` (ίδια έκδοση / δίκτυο) έχει ήδη
 * καταγραφεί από το `report`.
 */
export function offerToSkewRecovery(error: unknown, deps: SkewDeps = productionSkewDeps()): boolean {
  if (typeof window === 'undefined' || !isMissingModuleError(error)) return false;
  resolveBySkew<never>(error, deps).catch(() => undefined);
  return true;
}

const INSTALLED_MARK = Symbol.for('nestor.moduleSkewRecovery.installed');

type MarkedWindow = Window & { [INSTALLED_MARK]?: true };

/** Ακροατές για ό,τι **δεν** πιάνει κανένα error boundary. Idempotent. */
export function installModuleSkewRecovery(): boolean {
  if (typeof window === 'undefined') return false;
  const target = window as MarkedWindow;
  if (target[INSTALLED_MARK]) return false;
  target[INSTALLED_MARK] = true;
  target.addEventListener('error', (event) => {
    offerToSkewRecovery(event.error);
  });
  target.addEventListener('unhandledrejection', (event) => {
    offerToSkewRecovery(event.reason);
  });
  return true;
}
