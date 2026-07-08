/**
 * POST /api/procurement/[poId]/email — Send PO via email with PDF attachment
 *
 * Auth: withAuth | Rate: sensitive (20 req/min)
 * @see ADR-267 Phase B — Email PO to Supplier
 * @see ADR-603 API Route-Handler Factory SSoT
 */

import 'server-only';

import { z } from 'zod';
import { defineRoute, ok, badRequest, notFound, httpError } from '@/lib/api/define-route';
import { getPO } from '@/services/procurement';
import { sendPurchaseOrderEmail } from '@/services/procurement/po-email-service';
import { resolveContactDepartmentEmail } from '@/services/org-structure/org-routing-resolver';
import { EntityAuditService } from '@/services/entity-audit.service';
import { createModuleLogger } from '@/lib/telemetry/Logger';

const logger = createModuleLogger('PO_EMAIL_API');

const SendEmailSchema = z.object({
  recipientEmail: z.string().email(),
  recipientName: z.string().min(1).max(200),
  language: z.enum(['el', 'en']).default('el'),
});

export const POST = defineRoute<z.ZodTypeAny, { poId: string }>({
  rateLimit: 'sensitive',
  fallbackError: 'Unknown error',
  handler: async ({ req, auth, params }) => {
    const { poId } = params;

    let body: z.infer<typeof SendEmailSchema>;
    try {
      const raw = await req.json();
      body = SendEmailSchema.parse(raw);
    } catch {
      badRequest('Invalid request body');
    }

    const { recipientEmail: bodyEmail, recipientName, language } = body!;

    const po = await getPO(poId);
    if (!po || po.companyId !== auth.companyId) notFound('PO not found');

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

    if (!result.success) httpError(500, result.error);

    // Record audit trail
    EntityAuditService.recordChange({
      entityType: 'purchase_order',
      entityId: poId,
      entityName: po.poNumber,
      action: 'email_sent',
      changes: [{ field: 'email', oldValue: null, newValue: recipientEmail, label: 'Email Sent' }],
      performedBy: auth.uid,
      performedByName: null,
      companyId: auth.companyId,
    }).catch(() => {});

    return ok({ messageId: result.messageId });
  },
});
