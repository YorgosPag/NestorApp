/**
 * ADR-651 Φάση Η — `/api/dxf/revisions`
 *
 * GET  — η ιστορία αναθεωρήσεων του έργου (λιτή: χωρίς τα αποτυπώματα — βλ. παρακάτω)
 * POST — καταχώρηση νέας αναθεώρησης (idempotent)
 *
 * Ίδιο κέλυφος ασφαλείας με όλα τα routes του ADR-651 (Φάση Β/Δ): `withStandardRateLimit` +
 * `withAuth` — το `companyId` έρχεται **από τα claims**, ποτέ από το body. Καμία απευθείας
 * πρόσβαση στο Firestore: όλα περνούν από το `drawing-revision.service.ts` (admin SDK +
 * enterprise id + `setDoc`, N.6).
 *
 * ⚠️ **Γιατί το GET δεν επιστρέφει τα snapshots**: το αποτύπωμα ενός σετ φύλλων φτάνει τις ~260KB
 * (υπογραφή ανά οντότητα). Ο client δεν το χρειάζεται ποτέ — τη σύγκριση με την προηγούμενη
 * έκδοση την κάνει ο **server** (route `ai/revision-changelog`), που ήδη έχει και τις δύο πλευρές.
 * Μία πηγή αλήθειας για τον diff, μηδέν άχρηστο payload.
 *
 * Ο **συντάκτης** (`{{revision.author}}`) λύνεται από τον **ίδιο** `buildPlaceholderScope` που
 * γεμίζει την πινακίδα ⇒ το όνομα στον πίνακα αναθεωρήσεων είναι ΤΟ ΙΔΙΟ με το όνομα του
 * μελετητή στην πινακίδα (μηδέν δεύτερη πηγή για το ίδιο δεδομένο).
 */
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { createModuleLogger } from '@/lib/telemetry';
import { buildPlaceholderScope } from '@/subapps/dxf-viewer/text-engine/templates/resolver/scope-builder';
import {
  createRevision,
  listRevisions,
} from '@/subapps/dxf-viewer/text-engine/title-block/revisions/drawing-revision.service';
import type {
  DrawingRevision,
  DrawingRevisionSummary,
} from '@/subapps/dxf-viewer/text-engine/title-block/revisions/revision.types';
import { errorResponse } from '../text-templates/_helpers';
import {
  invalidRevisionRequest,
  readRevisionRequest,
  type RevisionRequestBody,
} from './_revision-route-helpers';

export const dynamic = 'force-dynamic';

const logger = createModuleLogger('DrawingRevisionsRoute');

/** Το λιτό σχήμα καλωδίου — ό,τι χρειάζεται ο πίνακας & η πινακίδα, χωρίς τα αποτυπώματα. */
function toSummary(revision: DrawingRevision): DrawingRevisionSummary {
  return {
    id: revision.id,
    number: revision.number,
    issuedAt: revision.issuedAt,
    authorId: revision.authorId,
    authorName: revision.authorName,
    description: revision.description,
  };
}

// ─── GET ─────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const handler = withStandardRateLimit(
    withAuth<unknown>(
      async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
        try {
          const projectId = req.nextUrl.searchParams.get('projectId');
          if (!projectId) {
            return NextResponse.json({ success: true, revisions: [] });
          }
          const revisions = await listRevisions(ctx.companyId, projectId);
          return NextResponse.json({ success: true, revisions: revisions.map(toSummary) });
        } catch (err) {
          logger.error('Failed to list drawing revisions', { companyId: ctx.companyId, err });
          return errorResponse(err);
        }
      },
      { permissions: 'dxf:files:view' },
    ),
  );
  return handler(request);
}

// ─── POST ────────────────────────────────────────────────────────────────────

/** Το όνομα του μελετητή όπως τυπώνεται στην πινακίδα (ίδιος builder ⇒ ίδιο όνομα). */
async function resolveAuthorName(ctx: AuthContext): Promise<string> {
  const scope = await buildPlaceholderScope({ companyId: ctx.companyId, userId: ctx.uid });
  return scope.user?.fullName?.trim() || ctx.email;
}

export async function POST(request: NextRequest) {
  const handler = withStandardRateLimit(
    withAuth<unknown>(
      async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
        try {
          const body = (await req.json().catch(() => ({}))) as RevisionRequestBody;
          const request = readRevisionRequest(body);
          if (!request) return invalidRevisionRequest();

          const result = await createRevision(
            {
              projectId: request.projectId,
              description: typeof body.description === 'string' ? body.description : '',
              snapshot: request.snapshot,
            },
            {
              companyId: ctx.companyId,
              userId: ctx.uid,
              userName: await resolveAuthorName(ctx),
            },
          );

          return NextResponse.json({
            success: true,
            created: result.created,
            revision: toSummary(result.revision),
          });
        } catch (err) {
          logger.error('Failed to create drawing revision', { companyId: ctx.companyId, err });
          return errorResponse(err);
        }
      },
      { permissions: 'dxf:text:create' },
    ),
  );
  return handler(request);
}
