/**
 * =============================================================================
 * GET /api/storage-showcase/[token] (ADR-315 + ADR-321 + ADR-698)
 * =============================================================================
 *
 * Public (anonymous) storage showcase payload. Declaration only — share
 * lookup, expiry, locale, snapshot and media all live in
 * `createUnifiedPublicShowcasePayloadRoute`.
 *
 * `pdfUrlPath: () => null` — storage showcases publish no PDF surface.
 *
 *
 * ⚠️ `'none'` rate limit — inherited, not chosen here: the four payload routes
 * have always been unlimited while the PDF proxies wrap in
 * `withStandardRateLimit`. Stated explicitly so the gap is reviewable
 * (ADR-698 §8.2), not closed as a side effect of de-duplication.
 * @module app/api/storage-showcase/[token]/route
 */

import {
  createPublicTokenRouteExport,
  createUnifiedPublicShowcasePayloadRoute,
} from '@/services/showcase-core';
import { ENTITY_TYPES } from '@/config/domain-constants';
import {
  buildStorageShowcaseSnapshot,
  type StorageShowcaseSnapshot,
} from '@/services/storage-showcase/snapshot-builder';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const route = createUnifiedPublicShowcasePayloadRoute<StorageShowcaseSnapshot, 'storage'>({
  shareEntityType: 'storage_showcase',
  entityKey: 'storage',
  mediaEntityType: ENTITY_TYPES.STORAGE,
  loggerName: 'StorageShowcasePublicApi',
  shareNotFoundMessage: 'Storage showcase link not found or deactivated',
  pdfUrlPath: () => null,
  buildSnapshot: buildStorageShowcaseSnapshot,
});

export const GET = createPublicTokenRouteExport(route, 'none');
