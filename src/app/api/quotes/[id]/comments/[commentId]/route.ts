/**
 * PATCH  /api/quotes/[id]/comments/[commentId]  — edit comment text (author only)
 * DELETE /api/quotes/[id]/comments/[commentId]  — soft-delete (author) or hard-delete (super_admin)
 *
 * Auth: withAuth (companyId + author isolation)
 * Rate: standard
 * ADR: ADR-329 §comments-api
 */

import 'server-only';

import { z } from 'zod';
import { FieldValue } from 'firebase-admin/firestore';
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS, SUBCOLLECTIONS } from '@/config/firestore-collections';
import { safeParseBody } from '@/lib/validation/shared-schemas';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('QuoteCommentRoute');

type Segment = { params: Promise<{ id: string; commentId: string }> };

// ============================================================================
// SCHEMA
// ============================================================================

const EditCommentSchema = z.object({
  text: z.string().min(1).max(2000),
});

// ============================================================================
// HELPERS
// ============================================================================

interface StoredComment {
  companyId: string;
  authorId: string;
  deletedAt: null | { seconds: number };
}

async function resolveComment(
  quoteId: string,
  commentId: string,
  companyId: string,
): Promise<
  | { ok: true; ref: FirebaseFirestore.DocumentReference; data: StoredComment }
  | { ok: false; status: number; error: string }
> {
  const db = getAdminFirestore();
  const ref = db
    .collection(COLLECTIONS.QUOTES)
    .doc(quoteId)
    .collection(SUBCOLLECTIONS.QUOTE_COMMENTS)
    .doc(commentId);
  const snap = await ref.get();
  if (!snap.exists) return { ok: false, status: 404, error: 'Not found' };
  const data = snap.data() as StoredComment;
  if (data.companyId !== companyId) return { ok: false, status: 404, error: 'Not found' };
  return { ok: true, ref, data };
}

// ============================================================================
// PATCH — edit comment text
// ============================================================================

async function handlePatch(
  request: NextRequest,
  segmentData?: Segment,
): Promise<NextResponse> {
  const { id: quoteId, commentId } = await segmentData!.params;

  const handler = withAuth(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      const parsed = await safeParseBody(req, EditCommentSchema);
      if (!parsed.success) {
        return NextResponse.json({ error: parsed.error }, { status: 400 });
      }

      const result = await resolveComment(quoteId, commentId, ctx.companyId);
      if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
      const { ref, data } = result;

      if (data.authorId !== ctx.uid) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      if (data.deletedAt !== null) {
        return NextResponse.json({ error: 'Comment is deleted' }, { status: 410 });
      }

      await ref.update({ text: parsed.data.text, editedAt: FieldValue.serverTimestamp() });
      logger.info('Comment edited', { quoteId, commentId });
      return NextResponse.json({ ok: true });
    },
  );
  return handler(request, segmentData);
}

// ============================================================================
// DELETE — soft-delete (author) or hard-delete (super_admin)
// ============================================================================

async function handleDelete(
  request: NextRequest,
  segmentData?: Segment,
): Promise<NextResponse> {
  const { id: quoteId, commentId } = await segmentData!.params;

  const handler = withAuth(
    async (_req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      const result = await resolveComment(quoteId, commentId, ctx.companyId);
      if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
      const { ref, data } = result;

      const isSuperAdmin = (ctx as { globalRole?: string }).globalRole === 'super_admin';
      if (data.authorId !== ctx.uid && !isSuperAdmin) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      if (isSuperAdmin && data.authorId !== ctx.uid) {
        await ref.delete();
      } else {
        await ref.update({ deletedAt: FieldValue.serverTimestamp() });
      }

      logger.info('Comment deleted', { quoteId, commentId, soft: !isSuperAdmin });
      return NextResponse.json({ ok: true });
    },
  );
  return handler(request, segmentData);
}

// ============================================================================
// EXPORTS
// ============================================================================

export const PATCH = withStandardRateLimit(handlePatch);
export const DELETE = withStandardRateLimit(handleDelete);
