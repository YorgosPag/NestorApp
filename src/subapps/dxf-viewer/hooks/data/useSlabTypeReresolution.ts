'use client';

/**
 * ADR-412 «type always wins» — slab re-resolution on family-type catalog change.
 *
 * Thin binding of the shared `createTypeReresolutionHook` factory (ADR-604 Φ1)
 * to the pure `reresolveSceneSlabs` SSoT. On every `BimFamilyType` store
 * `version` bump, re-runs resolution over the active scene's typed slabs so their
 * cached type-governed params (`thickness`/`dna`) re-flow from the live type —
 * which activates the per-layer 3D slab rendering. Locally dirty slabs are
 * skipped (local edits win); untyped slabs are untouched (ZERO regression).
 *
 * @see ./create-type-reresolution-hook.ts — shared factory (ADR-604)
 * @see ./slab-persistence-helpers.ts — reresolveSceneSlabs (pure SSoT)
 * @see docs/centralized-systems/reference/adrs/ADR-412-bim-family-types.md §3.4
 */

import { createTypeReresolutionHook } from './create-type-reresolution-hook';
import { reresolveSceneSlabs } from './slab-persistence-helpers';

/**
 * Wire family-type re-resolution into the slab scene-sync path.
 *
 * @param levelManager Active level scene accessor.
 * @param dirtyIdsRef  Slab ids with un-persisted local edits (skipped so local
 *   edits always win).
 */
export const useSlabTypeReresolution = createTypeReresolutionHook(reresolveSceneSlabs);
