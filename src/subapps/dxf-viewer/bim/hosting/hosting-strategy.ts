/**
 * Associative Grid Hosting — Strategy registry (ADR-441, Slice GEN).
 *
 * Explicit, tree-shake-safe map `entity.type → HostingStrategy` (όχι side-effect
 * self-registration). Ο generic reconciler dispatch-άρει εδώ ώστε foundation/wall/column
 * να ακολουθούν τον κάναβο με μία-και-μόνη μηχανή. Νέο grid-hosted kind → πρόσθεσε strategy
 * + μία γραμμή στο `STRATEGIES`.
 *
 * @see bim/hosting/hosting-strategy-types.ts — contract
 * @see bim/hosting/guide-hosting-reconciler.ts — consumer
 */

import type { AnySceneEntity } from '../../types/scene';
import type { HostingStrategy } from './hosting-strategy-types';
import { foundationHostingStrategy } from './foundation-hosting-strategy';
import { columnHostingStrategy } from './column-hosting-strategy';
import { wallHostingStrategy } from './wall-hosting-strategy';
import { beamHostingStrategy } from './beam-hosting-strategy';

type HostedEntityType = AnySceneEntity['type'];

// Grid-hosted kinds (ADR-441). Νέο kind → strategy + μία γραμμή εδώ.
const STRATEGIES: Partial<Record<HostedEntityType, HostingStrategy>> = {
  foundation: foundationHostingStrategy,
  column: columnHostingStrategy,
  wall: wallHostingStrategy,
  beam: beamHostingStrategy,
};

/** Η strategy ενός entity type, ή `undefined` αν δεν είναι grid-hosted kind. */
export function getHostingStrategy(type: HostedEntityType): HostingStrategy | undefined {
  return STRATEGIES[type];
}

export type { HostingStrategy, HostingUpdate } from './hosting-strategy-types';
