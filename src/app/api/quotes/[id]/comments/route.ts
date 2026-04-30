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
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS, SUBCOLLECTIONS } from '@/config/firestore-collections';
import { safeParseBody } from '@/lib/validation/shared-schemas';
import { createModuleLogger } from '@/lib/telemetry';
import { enterpriseIdService } from '@/services/enterprise-id.service';
import { nowISO } from '@/lib/date-local';

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

async function verifyQuoteOwnership(quoteId: string, companyId: string): Promise<boolean> {
  const db = getAdminFirestore();
  const snap = await db.collection(COLLECTIONS.QUOTES).doc(quoteId).get();
  if (!snap.exists) return false;
  return (snap.data() as { companyId?: string })?.companyId === companyId;
}

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
      const owned = await verifyQuoteOwnership(quoteId, ctx.companyId);
      if (!owned) return NextResponse.json({ error: 'Not found' }, { status: 404 });

      const db = getAdminFirestore();
      const snap = await db
        .collection(COLLECTIONS.QUOTES)
        .doc(quoteId)
        .collection(SUBCOLLECTIONS.QUOTE_COMMENTS)
        .orderBy('createdAt', 'asc')
        .get();

      const comments = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((c) => (c as { deletedAt: unknown }).deletedAt === null);

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
      const parsed = await safeParseBody(req, CreateCommentSchema);
      if (!parsed.success) {
        return NextResponse.json({ error: parsed.error }, { status: 400 });
      }

      const owned = await verifyQuoteOwnership(quoteId, ctx.companyId);
      if (!owned) return NextResponse.json({ error: 'Not found' }, { status: 404 });

      const { text, authorName, mentionedUserIds } = parsed.data;
      const commentId = enterpriseIdService.generateCommentId();
      const db = getAdminFirestore();

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

      await db
        .collection(COLLECTIONS.QUOTES)
        .doc(quoteId)
        .collection(SUBCOLLECTIONS.QUOTE_COMMENTS)
        .doc(commentId)
        .set(doc);

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
