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
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { isRoleBypass } from '@/lib/auth/roles';
import {
  editComment,
  loadOwnedComment,
  purgeComment,
  softDeleteComment,
} from '../../../_shared/quote-comments';
import { safeJsonBody } from '@/lib/validation/shared-schemas';
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

/**
 * 🔄 ADR-742 §7undecies — ο τοπικός `resolveComment` **μετακόμισε** στο
 * `_shared/quote-comments` ως {@link loadOwnedComment}, με δύο διορθώσεις που
 * δεν μπορούσαν να μείνουν εδώ:
 *
 * - **Ο έλεγχος του ΓΟΝΕΑ έλειπε**: ρωτούσε μόνο «ανήκει το σχόλιο;», ενώ οι
 *   αδελφικές `comments/` ρωτούσαν «ανήκει η προσφορά;» — δύο δόγματα για τον
 *   ίδιο πόρο (§7septies).
 * - **Παγίδα του κενού**: σκέτο `!==` πάνω σε `as StoredComment` (§4).
 */

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
      const parsed = await safeJsonBody(EditCommentSchema, req);
      if (parsed.error) return parsed.error;

      const outcome = await loadOwnedComment({ quoteId, commentId, caller: ctx, action: 'comment-edit' });
      if (outcome.refusal) return outcome.refusal;
      const { ref, data } = outcome.comment;

      if (data.authorId !== ctx.uid) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      if (data.deletedAt !== null) {
        return NextResponse.json({ error: 'Comment is deleted' }, { status: 410 });
      }

      await editComment(ref, parsed.data.text);
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
      const outcome = await loadOwnedComment({ quoteId, commentId, caller: ctx, action: 'comment-delete' });
      if (outcome.refusal) return outcome.refusal;
      const { ref, data } = outcome.comment;

      // ADR-742 §7.4 — ήταν `(ctx as { globalRole?: string }).globalRole ===
      // 'super_admin'`: **σύγκριση συμβολοσειράς πάνω σε `as`**. Ένας δεύτερος
      // bypass ρόλος δεν θα μπορούσε να σβήσει σχόλιο, από κώδικα που διαβάζεται
      // σωστός. Το `AuthContext` **έχει** `globalRole` — το cast ήταν περιττό.
      const isSuperAdmin = isRoleBypass(ctx.globalRole);
      if (data.authorId !== ctx.uid && !isSuperAdmin) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      if (isSuperAdmin && data.authorId !== ctx.uid) {
        await purgeComment(ref);
      } else {
        await softDeleteComment(ref);
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
