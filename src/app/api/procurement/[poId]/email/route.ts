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
import { findOwnedPO } from '@/services/procurement';
import { PO_NOT_FOUND_MESSAGE } from '@/subapps/procurement/services/procurement-rule-error';
import { sendPurchaseOrderEmail } from '@/services/procurement/po-email-service';
import { resolvePODocumentParties } from '@/services/procurement/po-document-parties';
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

    // ADR-742 §7undecies · ADR-923 Λ5 — ο φράχτης εταιρείας στην υπηρεσία: ξένο PO = ανύπαρκτο (404).
    const po = await findOwnedPO({ caller: auth, poId, action: 'email', intent: 'write' });
    if (!po) notFound(PO_NOT_FOUND_MESSAGE);

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

    // ADR-923 §5.11 «3γ» Α11 — τα μέρη του εγγράφου από ΕΝΑ SSoT (κοινό με το PDF). Το `recipientName`
    // είναι ο **άνθρωπος** που χαιρετά το μήνυμα, όχι ο συμβαλλόμενος — ο προμηθευτής έρχεται από την επαφή του.
    const parties = await resolvePODocumentParties(auth, po);
    if (!parties.ok) httpError(422, parties.reason);

    const result = await sendPurchaseOrderEmail({
      po,
      recipientEmail,
      recipientName,
      companyInfo: parties.companyInfo,
      supplierInfo: parties.supplierInfo,
      language,
    });

    // A 5xx `ApiError` never reaches the wire with its message: `defineRoute` answers the generic 500 + requestId and
    // logs `result.error` (Mailgun configuration / provider body) under the same id (ADR-603 §Ασπίδα, ΥΨ-1).
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
