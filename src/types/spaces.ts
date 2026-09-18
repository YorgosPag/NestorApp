import type { PricedPropertyLike } from '@/lib/properties/price-resolver';

/**
 * A single space returned by batch-resolve.
 *
 * Carries **every field the price resolver reads** (`commercial` · `commercialStatus` ·
 * `offerKinds`), because the sale dialog asks it «what does this space SELL for?»
 * (ADR-777 §8.60.14.14). With only `commercial.askingPrice` and the physical `status`,
 * the resolver could not tell a space offered for rent from one offered for sale.
 */
export interface BatchResolvedSpace
  extends Pick<PricedPropertyLike, 'commercial' | 'commercialStatus' | 'offerKinds'> {
  id: string;
  spaceType: 'parking' | 'storage';
  area: number;
  name?: string;
  buildingId?: string;
  floorId?: string;
  status?: string;
}

/** Response payload for POST /api/spaces/batch-resolve */
export interface BatchResolveResponse {
  spaces: BatchResolvedSpace[];
  notFound: string[];
}
