/**
 * @fileoverview Το συμβόλαιο σύρματος του `/api/build-info` — ΜΙΑ δήλωση για server και browser.
 * @related ADR-860 §Ε0
 * @module lib/app-version/build-info-contract
 *
 * Ζει στο `lib` και **όχι** μέσα στο route: ο browser (`chunk-recovery/skew-probe.ts`) δεν
 * επιτρέπεται να εισάγει από αρχείο `app/api/**` — ο server το εισάγει από εδώ.
 */

import type { DeploymentId } from './deployment-identity';

export const BUILD_INFO_PATH = '/api/build-info';

export interface BuildInfoResponse {
  /** `null` ⇒ ο server δεν ξέρει την έκδοσή του (τοπικό build) ⇒ ο πελάτης κρίνει «άγνωστο». */
  readonly deploymentId: DeploymentId | null;
}
