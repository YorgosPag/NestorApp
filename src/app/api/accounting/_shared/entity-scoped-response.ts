/**
 * =============================================================================
 * resolveEntityScopedData — entity-type dispatch SSoT (ADR-603 Boy-Scout)
 * =============================================================================
 *
 * Several accounting summary routes (efka/summary, tax/estimate, …) branch on
 * the company entity type (ΟΕ / ΕΠΕ / ΑΕ / ατομική) and emit an identical
 * `{ success, entityType, data }` envelope with a per-entity service call. That
 * branching block was copy-pasted verbatim (structural sibling clone, N.18).
 *
 * This helper centralises the dispatch: pass the company profile plus one thunk
 * per entity type and receive `{ entityType, data }` with the discriminated
 * `entityType` tag byte-identical to the previous inline branches. Each thunk
 * keeps its own return type (four generics) — zero `any`, zero contract change.
 *
 * @module api/accounting/_shared/entity-scoped-response
 * @enterprise ADR-603 API Route-Handler Factory SSoT
 * @see ADR-ACC-012 OE Partnership Support (entity-guards)
 */

import 'server-only';

import type { CompanyProfile } from '@/subapps/accounting/types/company';
import { isPartnership, isLlc, isCorporation } from '@/subapps/accounting/utils/entity-guards';

/** Discriminated entity tag emitted at the top level of the response envelope. */
export type EntityScopeTag = 'oe' | 'epe' | 'ae' | 'sole_proprietor';

export interface EntityScopedResolvers<TPartnership, TLlc, TCorporation, TSole> {
  /** ΟΕ — Ομόρρυθμη Εταιρεία → `entityType: 'oe'`. */
  partnership: () => Promise<TPartnership>;
  /** ΕΠΕ — Εταιρεία Περιορισμένης Ευθύνης → `entityType: 'epe'`. */
  llc: () => Promise<TLlc>;
  /** ΑΕ — Ανώνυμη Εταιρεία → `entityType: 'ae'`. */
  corporation: () => Promise<TCorporation>;
  /** Ατομική επιχείρηση (default) → `entityType: 'sole_proprietor'`. */
  soleProprietor: () => Promise<TSole>;
}

/**
 * Resolve the entity-scoped payload for a company profile. Runs exactly one
 * resolver (the first matching guard, sole-proprietor as fallback) and returns
 * its result tagged with the matching `entityType`.
 */
export async function resolveEntityScopedData<TPartnership, TLlc, TCorporation, TSole>(
  profile: CompanyProfile | null,
  resolvers: EntityScopedResolvers<TPartnership, TLlc, TCorporation, TSole>,
): Promise<
  | { entityType: 'oe'; data: TPartnership }
  | { entityType: 'epe'; data: TLlc }
  | { entityType: 'ae'; data: TCorporation }
  | { entityType: 'sole_proprietor'; data: TSole }
> {
  if (profile && isPartnership(profile)) {
    return { entityType: 'oe', data: await resolvers.partnership() };
  }
  if (profile && isLlc(profile)) {
    return { entityType: 'epe', data: await resolvers.llc() };
  }
  if (profile && isCorporation(profile)) {
    return { entityType: 'ae', data: await resolvers.corporation() };
  }
  return { entityType: 'sole_proprietor', data: await resolvers.soleProprietor() };
}
