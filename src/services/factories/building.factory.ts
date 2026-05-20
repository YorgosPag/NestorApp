/**
 * Building Factory (ADR-369 §9 Q2) — Phase A2
 *
 * Pure factory function για δημιουργία `Building` documents με ADR-369 elevation
 * defaults filled-in. Δεν γράφει σε Firestore — ο caller κάνει `setDoc()`.
 *
 * Defaults που εφαρμόζονται όταν δεν δίνονται από τον caller:
 *   - id              : νέο enterprise ID από `generateBuildingId()` (ADR-294)
 *   - baseElevation   : 0 (METRES, single-building no-op)
 *   - rotation        : 0 (DEGREES)
 *   - phase           : 'planned'
 *
 * Optional ADR-369 fields (siteOrigin, baseElevationReference) δεν λαμβάνουν
 * default — μένουν undefined αν δεν δοθούν.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-369-bim-elevation-convention-revit-alignment.md §9 Q2
 */

import { generateBuildingId } from '@/services/enterprise-id-convenience';
import type { Building } from '@/types/building/contracts';
import {
  DEFAULT_BUILDING_BASE_ELEVATION_M,
  DEFAULT_BUILDING_ROTATION_DEG,
  DEFAULT_BUILDING_PHASE,
} from '@/types/building/elevation.schemas';

/**
 * Input για `createBuilding`. Όλα τα Building required fields πρέπει να δίνονται
 * εκτός από `id` (auto) και τα 3 ADR-369 elevation defaults (auto-filled).
 */
export type CreateBuildingInput = Omit<
  Building,
  'id' | 'baseElevation' | 'rotation' | 'phase'
> & {
  baseElevation?: number;
  rotation?: number;
  phase?: Building['phase'];
};

/**
 * Παράγει νέο `Building` με ADR-369 elevation defaults.
 *
 * @example
 * const b = createBuilding({
 *   projectId: 'proj_...',
 *   name: 'Κτίριο Α',
 *   totalArea: 1200,
 *   floors: 5,
 *   status: 'planning',
 *   progress: 0,
 * });
 * // → b.baseElevation === 0, b.rotation === 0, b.phase === 'planned'
 */
export function createBuilding(input: CreateBuildingInput): Building {
  return {
    ...input,
    id: generateBuildingId(),
    baseElevation: input.baseElevation ?? DEFAULT_BUILDING_BASE_ELEVATION_M,
    rotation: input.rotation ?? DEFAULT_BUILDING_ROTATION_DEG,
    phase: input.phase ?? DEFAULT_BUILDING_PHASE,
  };
}
