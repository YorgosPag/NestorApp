/**
 * =============================================================================
 * GET /api/parking-showcase/[token] (ADR-315 + ADR-321 + ADR-698)
 * =============================================================================
 *
 * Public (anonymous) parking showcase payload. Declaration only — share
 * lookup, expiry, locale, snapshot and media all live in
 * `createUnifiedPublicShowcasePayloadRoute`.
 *
 * `pdfUrlPath: () => null` — parking showcases publish no PDF surface.
 *
 *
 * ⚠️ `'none'` rate limit — inherited, not chosen here: the four payload routes
 * have always been unlimited while the PDF proxies wrap in
 * `withStandardRateLimit`. Stated explicitly so the gap is reviewable
 * (ADR-698 §8.2), not closed as a side effect of de-duplication.
 * @module app/api/parking-showcase/[token]/route
 */

import {
  createPublicTokenRouteExport,
  createUnifiedPublicShowcasePayloadRoute,
} from '@/services/showcase-core';
import { ENTITY_TYPES } from '@/config/domain-constants';
import {
  buildParkingShowcaseSnapshot,
  type ParkingShowcaseSnapshot,
} from '@/services/parking-showcase/snapshot-builder';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const route = createUnifiedPublicShowcasePayloadRoute<ParkingShowcaseSnapshot, 'parking'>({
  shareEntityType: 'parking_showcase',
  entityKey: 'parking',
  mediaEntityType: ENTITY_TYPES.PARKING_SPOT,
  loggerName: 'ParkingShowcasePublicApi',
  shareNotFoundMessage: 'Parking showcase link not found or deactivated',
  pdfUrlPath: () => null,
  buildSnapshot: buildParkingShowcaseSnapshot,
});

export const GET = createPublicTokenRouteExport(route, 'none');
