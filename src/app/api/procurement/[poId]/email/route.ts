/**
 * POST /api/procurement/[poId]/email — Send PO via email with PDF attachment
 *
 * Auth: withAuth | Rate: sensitive (20 req/min)
 * @see ADR-267 Phase B — Email PO to Supplier
 */

import 'server-only';

import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { getPO } from '@/services/procurement';
import { sendPurchaseOrderEmail } from '@/services/procurement/po-email-service';
import { resolveContactDepartmentEmail } from '@/services/org-structure/org-routing-resolver';
import { EntityAuditService } from '@/services/entity-audit.service';
import { getErrorMessage } from '@/lib/error-utils';
import { createModuleLogger } from '@/lib/telemetry/Logger';

const logger = createModuleLogger('PO_EMAIL_API');

const SendEmailSchema = z.object({
  recipientEmail: z.string().email(),
  recipientName: z.string().min(1).max(200),
  language: z.enum(['el', 'en']).default('el'),
});

async function handlePost(
  request: NextRequest,
  segmentData?: { params: Promise<{ poId: string }> }
) {
  const { poId } = await segmentData!.params;

  const handler = withAuth(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        let body: { recipientEmail: string; recipientName: string; language: 'el' | 'en' };
        try {
          const raw = await req.json();
          body = SendEmailSchema.parse(raw);
        } catch {
          return NextResponse.json(
            { success: false, error: 'Invalid request body' },
            { status: 400 }
          );
        }

        const { recipientEmail: bodyEmail, recipientName, language } = body;

        const po = await getPO(poId);
        if (!po || po.companyId !== ctx.companyId) {
          return NextResponse.json(
            { success: false, error: 'PO not found' },
            { status: 404 }
          );
        }

        // L2 org-structure resolver: supplier accounting dept takes priority (ADR-326 Phase 6.1)
        let recipientEmail = bodyEmail;
        let emailSource: 'manual' | 'head' | 'backup' | 'dept' = 'manual';
        if (po.supplierId) {
          const resolverResult = await resolveContactDepartmentEmail(po.supplierId, 'accounting');
          if (resolverResult) {
            recipientEmail = resolverResult.email;
            emailSource = resolverResult.source;
          }
        }
        logger.info('PO email resolver', { poId, emailSource, supplierId: po.supplierId ?? null });

        const result = await sendPurchaseOrderEmail({
          po,
          recipientEmail,
          recipientName,
          companyInfo: {
            name: 'Pagonis Construction', // TODO: Load from company profile
            vatNumber: '',
            address: '',
            phone: '',
            email: '',
          },
          supplierInfo: {
            name: recipientName,
          },
          language,
        });

        if (!result.success) {
          return NextResponse.json(
            { success: false, error: result.error },
            { status: 500 }
          );
        }

        // Record audit trail
        EntityAuditService.recordChange({
          entityType: 'purchase_order',
          entityId: poId,
          entityName: po.poNumber,
          action: 'email_sent',
          changes: [{ field: 'email', oldValue: null, newValue: recipientEmail, label: 'Email Sent' }],
          performedBy: ctx.uid,
          performedByName: null,
          companyId: ctx.companyId,
        }).catch(() => {});

        return NextResponse.json({
          success: true,
          data: { messageId: result.messageId },
        });
      } catch (err) {
        logger.error('PO email failed', { poId, error: getErrorMessage(err) });
        return NextResponse.json(
          { success: false, error: getErrorMessage(err) },
          { status: 500 }
        );
      }
    }
  );

  return withSensitiveRateLimit(handler)(request);
}

export { handlePost as POST };
