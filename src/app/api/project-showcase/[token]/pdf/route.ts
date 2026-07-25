/**
 * =============================================================================
 * GET /api/project-showcase/[token]/pdf (ADR-316 + ADR-321 + ADR-698)
 * =============================================================================
 *
 * Public PDF proxy — streams a project showcase PDF via Admin SDK, bypassing
 * Storage rules and the `.firebasestorage.app` download-token limitation.
 *
 * Declaration only: the whole pipeline (share lookup, expiry, tenant
 * cross-check, filename, access counter, streaming) lives in
 * `createUnifiedPublicShowcasePdfRoute`.
 *
 * Security unchanged: anonymous, token-validated + tenant cross-check +
 * `withStandardRateLimit`.
 *
 * @module app/api/project-showcase/[token]/pdf/route
 */

import {
  createPublicTokenRouteExport,
  createUnifiedPublicShowcasePdfRoute,
} from '@/services/showcase-core';
import { COLLECTIONS } from '@/config/firestore-collections';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const route = createUnifiedPublicShowcasePdfRoute({
  shareEntityType: 'project_showcase',
  entityCollection: COLLECTIONS.PROJECTS,
  loggerName: 'ProjectShowcasePdfProxy',
  shareNotFoundMessage: 'Project showcase link not found or deactivated',
  entityNotFoundMessage: 'Project not found',
  filenameFallback: 'project-showcase',
});

export const GET = createPublicTokenRouteExport(route, 'standard');
