/**
 * ADR-651 Φάση Β — `POST /api/dxf/text-templates/placeholder-scope`
 *
 * Hydrates the Firestore-derived slice of a `PlaceholderScope` (company / project /
 * acting user) for the CLIENT-side title-block insert command.
 *
 * Why a route at all: `scope-builder.ts` is `server-only` (admin SDK + tenant guard),
 * while the insert command runs in the browser. Rather than duplicating the data path
 * through a widened client projection (which would give us two sources of truth for
 * the same fields), the client asks the server for the scope it already knows how to
 * build — ADR-344's builder stays the single source. Same shape big players use:
 * title-block labels resolve against ONE resident "Project Information" record.
 *
 * Tenant isolation: `companyId` comes from the verified auth claims (never the body),
 * and `buildPlaceholderScope` re-verifies it on every fetched doc.
 *
 * Drawing / revision / formatting facts are NOT served here — they live in the active
 * DXF document, so the client merges them on top (see `PlaceholderScopeSources`).
 */
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { createModuleLogger } from '@/lib/telemetry';
import { buildPlaceholderScope } from '@/subapps/dxf-viewer/text-engine/templates/resolver/scope-builder';
import type { PlaceholderScopeSources } from '@/subapps/dxf-viewer/text-engine/templates/resolver/scope.types';
import { errorResponse } from '../_helpers';

export const dynamic = 'force-dynamic';

const logger = createModuleLogger('PlaceholderScopeRoute');

interface ScopeRequestBody {
  readonly projectId?: unknown;
  readonly checkerUserId?: unknown;
}

/** Body strings are untrusted input — accept only non-empty strings, drop the rest. */
function optionalId(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

export async function POST(request: NextRequest) {
  const handler = withStandardRateLimit(
    withAuth<unknown>(
      async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
        try {
          const body = (await req.json().catch(() => ({}))) as ScopeRequestBody;
          const scope = await buildPlaceholderScope({
            companyId: ctx.companyId,
            userId: ctx.uid,
            projectId: optionalId(body.projectId),
            checkerUserId: optionalId(body.checkerUserId),
          });
          const sources: PlaceholderScopeSources = {
            company: scope.company,
            project: scope.project,
            user: scope.user,
          };
          return NextResponse.json({ success: true, scope: sources });
        } catch (err) {
          logger.error('Failed to build placeholder scope', { companyId: ctx.companyId, err });
          return errorResponse(err);
        }
      },
      { permissions: 'dxf:files:view' },
    ),
  );
  return handler(request);
}
