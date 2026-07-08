'use client';

/**
 * ADR-417 §10 #3 «type always wins» — roof re-resolution on family-type catalog
 * change.
 *
 * Thin binding of the shared `createTypeReresolutionHook` factory (ADR-604 Φ1)
 * to the pure `reresolveSceneRoofs` SSoT. On every `BimFamilyType` store
 * `version` bump, re-runs resolution over the active scene's typed roofs so their
 * cached type-governed params (`thickness`/`dna`/`material`) re-flow from the
 * live type — which activates the per-layer 3D roof rendering and keeps every
 * placed roof of a type in sync when the type is edited. Locally dirty roofs are
 * skipped (local edits win); untyped roofs are untouched (ZERO regression).
 *
 * @see ./create-type-reresolution-hook.ts — shared factory (ADR-604)
 * @see ./roof-persistence-helpers.ts — reresolveSceneRoofs (pure SSoT)
 * @see docs/centralized-systems/reference/adrs/ADR-417-bim-roof-element.md §10 #3
 */

import { createTypeReresolutionHook } from './create-type-reresolution-hook';
import { reresolveSceneRoofs } from './roof-persistence-helpers';

/**
 * Wire family-type re-resolution into the roof scene-sync path.
 *
 * @param levelManager Active level scene accessor.
 * @param dirtyIdsRef  Roof ids with un-persisted local edits (skipped so local
 *   edits always win).
 */
export const useRoofTypeReresolution = createTypeReresolutionHook(reresolveSceneRoofs);
