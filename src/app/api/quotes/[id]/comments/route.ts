/**
 * GET  /api/quotes/[id]/comments  — list active comments for a quote
 * POST /api/quotes/[id]/comments  — create a new comment
 *
 * Auth: withAuth (companyId isolation)
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
import { safeJsonBody } from '@/lib/validation/shared-schemas';
import { createModuleLogger } from '@/lib/telemetry';
import { enterpriseIdService } from '@/services/enterprise-id.service';
import { nowISO } from '@/lib/date-local';
import { quoteCommentsCollection, refuseUnlessOwnedQuote } from '../../_shared/quote-comments';

const logger = createModuleLogger('QuoteCommentsRoute');

type Segment = { params: Promise<{ id: string }> };

// ============================================================================
// SCHEMA
// ============================================================================

const CreateCommentSchema = z.object({
  text: z.string().min(1).max(2000),
  authorName: z.string().min(1).max(100),
  mentionedUserIds: z.array(z.string()).optional().default([]),
});

// ============================================================================
// HELPERS
// ============================================================================

// ============================================================================
// GET
// ============================================================================

async function handleGet(
  request: NextRequest,
  segmentData?: Segment,
): Promise<NextResponse> {
  const { id: quoteId } = await segmentData!.params;

  const handler = withAuth(
    async (_req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      const refusal = await refuseUnlessOwnedQuote(quoteId, ctx, 'comments-list');
      if (refusal) return refusal;

      const snap = await quoteCommentsCollection(quoteId).orderBy('createdAt', 'asc').get();

      const comments = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((c) => (c as unknown as { deletedAt: unknown }).deletedAt === null);

      return NextResponse.json({ data: comments });
    },
  );
  return handler(request, segmentData);
}

// ============================================================================
// POST
// ============================================================================

async function handlePost(
  request: NextRequest,
  segmentData?: Segment,
): Promise<NextResponse> {
  const { id: quoteId } = await segmentData!.params;

  const handler = withAuth(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      const parsed = await safeJsonBody(CreateCommentSchema, req);
      if (parsed.error) return parsed.error;

      const refusal = await refuseUnlessOwnedQuote(quoteId, ctx, 'comment-create');
      if (refusal) return refusal;

      const { text, authorName, mentionedUserIds } = parsed.data;
      const commentId = enterpriseIdService.generateCommentId();

      const doc = {
        id: commentId,
        companyId: ctx.companyId,
        quoteId,
        text,
        authorId: ctx.uid,
        authorName,
        createdAt: FieldValue.serverTimestamp(),
        editedAt: null,
        deletedAt: null,
        mentionedUserIds: mentionedUserIds ?? [],
      };

      await quoteCommentsCollection(quoteId).doc(commentId).set(doc);

      logger.info('Comment created', { quoteId, commentId, authorId: ctx.uid });
      return NextResponse.json(
        { data: { ...doc, createdAt: nowISO() } },
        { status: 201 },
      );
    },
  );
  return handler(request, segmentData);
}

// ============================================================================
// EXPORTS
// ============================================================================

export const GET = withStandardRateLimit(handleGet);
export const POST = withStandardRateLimit(handlePost);
