'use client';

/**
 * ADR-421 SLICE C «type always wins» — opening re-resolution on family-type
 * catalog change.
 *
 * Thin binding of the shared `createTypeReresolutionHook` factory (ADR-603 Φ1)
 * to the pure `reresolveSceneOpenings` SSoT. On every `BimFamilyType` store
 * `version` bump, re-runs resolution over the active scene's typed openings so
 * their cached type-governed params (kind/width/height/frame/glazing) re-flow
 * from the live type and their geometry recomputes against the host wall.
 * Locally dirty openings are skipped (local edits win); untyped openings are
 * untouched (ZERO regression).
 *
 * @see ./create-type-reresolution-hook.ts — shared factory (ADR-603)
 * @see ../../bim/family-types/opening-type-resolution.ts §reresolveSceneOpenings
 * @see docs/centralized-systems/reference/adrs/ADR-421-bim-opening-types-revit-grade.md
 */

import { createTypeReresolutionHook } from './create-type-reresolution-hook';
import { reresolveSceneOpenings } from '../../bim/family-types/opening-type-resolution';

/**
 * Wire family-type re-resolution into the opening scene-sync path.
 *
 * @param levelManager Active level scene accessor.
 * @param dirtyIdsRef  Opening ids with un-persisted local edits (skipped so local
 *   edits always win).
 */
export const useOpeningTypeReresolution = createTypeReresolutionHook(reresolveSceneOpenings);
