/**
 * =============================================================================
 * GET /api/building-showcase/[token] (ADR-320 + ADR-321 + ADR-698)
 * =============================================================================
 *
 * Public (anonymous) building showcase payload. Declaration only — share
 * lookup, expiry, locale, snapshot, media and PDF-URL synthesis all live in
 * `createUnifiedPublicShowcasePayloadRoute`.
 *
 * Token lookup: unified `shares` collection only — building showcases are
 * always created via UnifiedSharingService (ADR-315).
 *
 *
 * ⚠️ `'none'` rate limit — inherited, not chosen here: the four payload routes
 * have always been unlimited while the PDF proxies wrap in
 * `withStandardRateLimit`. Stated explicitly so the gap is reviewable
 * (ADR-698 §8.2), not closed as a side effect of de-duplication.
 * @module app/api/building-showcase/[token]/route
 */

import {
  createPublicTokenRouteExport,
  createUnifiedPublicShowcasePayloadRoute,
} from '@/services/showcase-core';
import { ENTITY_TYPES } from '@/config/domain-constants';
import { buildBuildingShowcaseSnapshot } from '@/services/building-showcase/snapshot-builder';
import type { BuildingShowcaseSnapshot } from '@/types/building-showcase';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const route = createUnifiedPublicShowcasePayloadRoute<BuildingShowcaseSnapshot, 'building'>({
  shareEntityType: 'building_showcase',
  entityKey: 'building',
  mediaEntityType: ENTITY_TYPES.BUILDING,
  loggerName: 'BuildingShowcasePublicApi',
  shareNotFoundMessage: 'Building showcase link not found or deactivated',
  pdfUrlPath: (token) => `/api/building-showcase/${token}/pdf`,
  buildSnapshot: buildBuildingShowcaseSnapshot,
});

export const GET = createPublicTokenRouteExport(route, 'none');
