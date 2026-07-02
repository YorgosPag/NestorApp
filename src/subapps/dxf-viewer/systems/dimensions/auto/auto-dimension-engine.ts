/**
 * ADR-563 (Auto-Dimension) — Engine orchestrator (pure).
 *
 * Single entry point: BIM elements + options → `LinearDimensionEntity[]`.
 * Composes the three pure stages (extract → plan → factory) and computes the
 * overall model bounds via the existing SSoT (`calculateBimEntity2DBounds` +
 * `unionBounds`). No React, no stores, no Firestore — trivially unit-testable.
 *
 * @see auto-dimension-reference-extraction.ts
 * @see auto-dimension-chain-planner.ts
 * @see auto-dimension-entity-factory.ts
 */

import type { Entity } from '../../../types/entities';
import type { LinearDimensionEntity } from '../../../types/dimension';
import { calculateBimEntity2DBounds } from '../../../bim/utils/bim-bounds';
import { unionBounds, type Bounds } from '../../zoom/utils/bounds';
import { extractReferencePoints } from './auto-dimension-reference-extraction';
import { planChains } from './auto-dimension-chain-planner';
import { planInteriorChains } from './auto-dimension-interior-planner';
import {
  buildAutoDimensionEntities,
  type AutoDimensionFactoryContext,
} from './auto-dimension-entity-factory';
import type { AutoDimensionOptions, Bounds2D } from './auto-dimension-types';

/** Context passed through to the entity factory (style + layer). */
export type AutoDimensionContext = AutoDimensionFactoryContext;

/**
 * Overall 2D bounds of all BIM elements, via the SSoT bbox projection +
 * canonical `unionBounds`. Returns null when no element has usable geometry.
 */
export function computeOverallBounds(elements: readonly Entity[]): Bounds2D | null {
  let acc: Bounds | null = null;
  for (const e of elements) {
    const b = calculateBimEntity2DBounds(e);
    if (!b) continue;
    acc = acc ? unionBounds(acc, b) : { min: { ...b.min }, max: { ...b.max } };
  }
  return acc;
}

/**
 * Produce automatic perimeter dimensions for `elements`. Returns `[]` when the
 * element set has no dimensionable geometry (caller shows a "nothing to
 * dimension" notice).
 */
export function runAutoDimension(
  elements: readonly Entity[],
  options: AutoDimensionOptions,
  ctx: AutoDimensionContext,
): LinearDimensionEntity[] {
  const overall = computeOverallBounds(elements);
  if (!overall) return [];
  const refs = extractReferencePoints(elements, options, overall);
  const perimeter = planChains(refs, overall, options);
  const interior = options.interior
    ? planInteriorChains(elements, options, overall)
    : [];
  return buildAutoDimensionEntities([...perimeter, ...interior], ctx);
}
