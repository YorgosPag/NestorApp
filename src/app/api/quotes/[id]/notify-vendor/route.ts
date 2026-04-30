/**
 * POST /api/quotes/[id]/notify-vendor
 *
 * Sends a winner/rejection notification email to one vendor.
 * Writes lastNotifiedAt + lastNotifiedTemplate to the quote document.
 * Creates an EntityAuditService entry (action: vendor_notified).
 *
 * Body: {
 *   vendorEmail: string;
 *   template: 'winner' | 'rejection';
 *   subject: string;
 *   body: string;
 *   rfqId: string;
 *   customized: boolean;
 * }
 *
 * Auth: withAuth | Rate: sensitive
 * @see ADR-328 §5.V.4 §5.V.5 Phase 12
 */

import 'server-only';

import { z } from 'zod';
import { FieldValue } from 'firebase-admin/firestore';
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { sendReplyViaMailgun } from '@/services/ai-pipeline/shared/mailgun-sender';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { EntityAuditService } from '@/services/entity-audit.service';
import { ENTITY_TYPES } from '@/config/domain-constants';
import { safeFireAndForget } from '@/lib/safe-fire-and-forget';
import { getErrorMessage } from '@/lib/error-utils';
import { safeParseBody } from '@/lib/validation/shared-schemas';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('NotifyVendorRoute');

// ============================================================================
// SCHEMA
// ============================================================================

const NotifyVendorSchema = z.object({
  vendorEmail: z.string().email(),
  template: z.enum(['winner', 'rejection']),
  subject: z.string().min(1).max(500),
  body: z.string().min(1).max(10_000),
  rfqId: z.string().min(1),
  customized: z.boolean(),
});

// ============================================================================
// HANDLER
// ============================================================================

async function handlePost(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id: quoteId } = await context.params;

  const handler = withAuth(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      const parsed = await safeParseBody(req, NotifyVendorSchema);
      if (!parsed.success) {
        return NextResponse.json({ error: parsed.error }, { status: 400 });
      }

      const { vendorEmail, template, subject, body, rfqId, customized } = parsed.data;

      const result = await sendReplyViaMailgun({ to: vendorEmail, subject, textBody: body });

      if (!result.success) {
        logger.error('Vendor notification failed', { quoteId, vendorEmail, error: result.error });
        return NextResponse.json({ error: result.error ?? 'Send failed' }, { status: 502 });
      }

      // Write denormalized notification timestamp to quote document
      const db = getAdminFirestore();
      const quoteRef = db.collection(COLLECTIONS.QUOTES).doc(quoteId);
      const quoteSnap = await quoteRef.get();
      if (!quoteSnap.exists || (quoteSnap.data() as { companyId?: string })?.companyId !== ctx.companyId) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }

      await quoteRef.update({
        lastNotifiedAt: FieldValue.serverTimestamp(),
        lastNotifiedTemplate: template,
        updatedAt: FieldValue.serverTimestamp(),
      });

      // Audit trail — fire and forget (non-blocking)
      safeFireAndForget(
        EntityAuditService.recordChange({
          entityType: ENTITY_TYPES.QUOTE,
          entityId: quoteId,
          entityName: quoteId,
          action: 'vendor_notified',
          changes: [
            {
              field: 'notification',
              oldValue: null,
              newValue: `${template} → ${vendorEmail}`,
              label: 'Ειδοποίηση προμηθευτή',
            },
          ],
          performedBy: ctx.uid,
          performedByName: null,
          companyId: ctx.companyId,
        }),
      );

      logger.info('Vendor notified', { quoteId, vendorEmail, template, messageId: result.messageId });
      return NextResponse.json({ success: true, messageId: result.messageId ?? null });
    },
  );

  return handler(request, context);
}

export const POST = withSensitiveRateLimit(handlePost);
