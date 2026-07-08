/**
 * Shared reader for the common query filters on procurement catalog list
 * endpoints (materials + framework-agreements): the `search` free-text filter
 * and the `includeDeleted` soft-delete toggle. Each route adds its own
 * domain-specific params on top.
 *
 * @module app/api/procurement/_shared/catalog-list-filters
 * @see ADR-603 API Route-Handler Factory SSoT
 */

import type { NextRequest } from 'next/server';

export interface CatalogListFilters {
  search?: string;
  includeDeleted: boolean;
}

export function readCatalogListFilters(req: NextRequest): CatalogListFilters {
  const params = new URL(req.url).searchParams;
  return {
    search: params.get('search') ?? undefined,
    includeDeleted: params.get('includeDeleted') === 'true',
  };
}
