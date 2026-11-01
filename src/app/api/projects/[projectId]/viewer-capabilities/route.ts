/**
 * GET /api/projects/[projectId]/viewer-capabilities — τι επιτρέπεται στον θεατή σε αυτό το έργο (ADR-926 Κ7).
 *
 * Όπως το `capabilities` του Google Drive: το υπολογίζει ο διακομιστής ανά αίτημα, με τον ΕΝΑ κριτή, πάνω στον κλειστό
 * κατάλογο πράξεων έργου. Ο πελάτης δεν ξαναγράφει την κρίση, και ξένο έργο δίνει 404, ίδιο με το ανύπαρκτο.
 *
 * @module api/projects/[projectId]/viewer-capabilities
 */

import type { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { hasPermission } from '@/lib/auth/permissions';
import {
  PROJECT_SCOPED_ACTIONS,
  type ProjectScopedAction,
  type ProjectViewerCapabilities,
} from '@/lib/auth/project-scoped-actions';
import { apiSuccess, type ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { loadOwnedProject } from '../../_shared/project-owned-doc';

export const dynamic = 'force-dynamic';

interface ViewerCapabilitiesResponse {
  readonly viewerCapabilities: ProjectViewerCapabilities;
}

/** Σειριακά επίτηδες: η `cache` γεμίζει στην πρώτη πράξη, άρα το έγγραφο μέλους διαβάζεται μία φορά. */
async function capabilitiesOf(ctx: AuthContext, projectId: string, cache: PermissionCache): Promise<ProjectViewerCapabilities> {
  const verdicts: Array<[ProjectScopedAction, boolean]> = [];
  for (const action of PROJECT_SCOPED_ACTIONS) {
    verdicts.push([action, await hasPermission(ctx, action, { projectId }, cache)]);
  }
  return Object.fromEntries(verdicts) as Record<ProjectScopedAction, boolean>;
}

async function handleGet(
  request: NextRequest,
  segmentData?: { params: Promise<{ projectId: string }> },
): Promise<NextResponse> {
  const { projectId } = await segmentData!.params;

  const handler = withAuth<ApiSuccessResponse<ViewerCapabilitiesResponse>>(
    async (_req: NextRequest, ctx: AuthContext, cache: PermissionCache) => {
      await loadOwnedProject({ projectId, caller: ctx, action: 'view' });
      return apiSuccess<ViewerCapabilitiesResponse>(
        { viewerCapabilities: await capabilitiesOf(ctx, projectId, cache) },
        'Viewer capabilities resolved',
      );
    },
    { permissions: 'projects:projects:view' },
  );

  return handler(request);
}

export const GET = withStandardRateLimit(handleGet);
