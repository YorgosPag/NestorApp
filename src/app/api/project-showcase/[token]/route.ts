/**
 * =============================================================================
 * GET /api/project-showcase/[token] (ADR-316 + ADR-321 + ADR-698)
 * =============================================================================
 *
 * Public (anonymous) project showcase payload. Declaration only — share
 * lookup, expiry, locale, snapshot, media and PDF-URL synthesis all live in
 * `createUnifiedPublicShowcasePayloadRoute`.
 *
 * Token lookup: unified `shares` collection only — project showcases are
 * always created via UnifiedSharingService (ADR-315).
 *
 *
 * ⚠️ `'none'` rate limit — inherited, not chosen here: the four payload routes
 * have always been unlimited while the PDF proxies wrap in
 * `withStandardRateLimit`. Stated explicitly so the gap is reviewable
 * (ADR-698 §8.2), not closed as a side effect of de-duplication.
 * @module app/api/project-showcase/[token]/route
 */

import {
  createPublicTokenRouteExport,
  createUnifiedPublicShowcasePayloadRoute,
} from '@/services/showcase-core';
import { ENTITY_TYPES } from '@/config/domain-constants';
import { buildProjectShowcaseSnapshot } from '@/services/project-showcase/snapshot-builder';
import type { ProjectShowcaseSnapshot } from '@/types/project-showcase';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const route = createUnifiedPublicShowcasePayloadRoute<ProjectShowcaseSnapshot, 'project'>({
  shareEntityType: 'project_showcase',
  entityKey: 'project',
  mediaEntityType: ENTITY_TYPES.PROJECT,
  loggerName: 'ProjectShowcasePublicApi',
  shareNotFoundMessage: 'Project showcase link not found or deactivated',
  pdfUrlPath: (token) => `/api/project-showcase/${token}/pdf`,
  buildSnapshot: buildProjectShowcaseSnapshot,
});

export const GET = createPublicTokenRouteExport(route, 'none');
