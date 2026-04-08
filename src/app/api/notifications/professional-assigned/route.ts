/**
 * POST /api/notifications/professional-assigned
 *
 * Στέλνει branded email σε νομικό επαγγελματία μετά από ανάθεση ρόλου σε ακίνητο.
 * Fire-and-forget: καλείται από ProfessionalsCard μετά το success.
 *
 * @module api/notifications/professional-assigned
 * @rateLimit STANDARD (60 req/min)
 *
 * 🔒 SECURITY:
 * - Authenticated users only (withAuth)
 * - Admin SDK for Firestore reads
 * - Mailgun for email delivery
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { ENTITY_TYPES } from '@/config/domain-constants';
import { buildProfessionalAssignmentEmail, buildProfessionalRemovalEmail } from '@/services/email-templates/professional-assignment';
import { sendReplyViaMailgun } from '@/services/ai-pipeline/shared/mailgun-sender';
import { createModuleLogger } from '@/lib/telemetry';
import { EntityAuditService } from '@/services/entity-audit.service';
import { getErrorMessage } from '@/lib/error-utils';
import { safeFireAndForget } from '@/lib/safe-fire-and-forget';
import {
  resolvePropertyHierarchy,
  extractPrimaryEmail,
  ROLE_LABELS,
} from './hierarchy-resolver';

const logger = createModuleLogger('api/notifications/professional-assigned');

// ============================================================================
// TYPES
// ============================================================================

interface AssignmentNotificationRequest {
  contactId: string;
  role: string;
  propertyId: string;
  /** @deprecated Use propertyId — kept for backward compat */
  unitId?: string;
  /** 'assignment' (default) or 'removal' */
  type?: 'assignment' | 'removal';
}

interface AssignmentNotificationResponse {
  success: boolean;
  emailSent: boolean;
  error?: string;
}

// ============================================================================
// VALIDATION
// ============================================================================

function validateRequest(body: unknown): body is AssignmentNotificationRequest {
  if (!body || typeof body !== 'object') return false;
  const req = body as Partial<AssignmentNotificationRequest>;
  return !!(req.contactId && req.role && (req.propertyId || req.unitId));
}

// ============================================================================
// HANDLER
// ============================================================================

async function handleAssignmentNotification(
  request: NextRequest,
  ctx: AuthContext
): Promise<NextResponse<AssignmentNotificationResponse>> {
  try {
    const body: unknown = await request.json();

    if (!validateRequest(body)) {
      return NextResponse.json(
        { success: false, emailSent: false, error: 'Invalid request: contactId, role, propertyId required' },
        { status: 400 }
      );
    }

    const { contactId, role, type = 'assignment' } = body;
    const propertyId = body.propertyId || body.unitId!;
    const isRemoval = type === 'removal';

    logger.info('Professional notification', { contactId, role, propertyId, type, userId: ctx.uid });

    // 1. Fetch contact — get primary email
    const db = getAdminFirestore();
    const contactSnap = await db.collection(COLLECTIONS.CONTACTS).doc(contactId).get();
    if (!contactSnap.exists) {
      logger.warn('Contact not found', { contactId });
      return NextResponse.json({ success: true, emailSent: false });
    }

    const contactData = contactSnap.data() as Record<string, unknown>;
    const email = extractPrimaryEmail(contactData);

    if (!email) {
      logger.info('Contact has no email — skipping notification', { contactId });
      return NextResponse.json({ success: true, emailSent: false });
    }

    // 2. Resolve display name
    const displayName = (contactData.displayName as string)
      ?? ([contactData.firstName, contactData.lastName].filter(Boolean).join(' ')
      || 'Κύριε/Κυρία');

    // 3. Resolve property hierarchy
    const hierarchy = await resolvePropertyHierarchy(propertyId);
    if (!hierarchy) {
      logger.warn('Property not found — skipping notification', { propertyId });
      return NextResponse.json({ success: true, emailSent: false });
    }

    // 4. Build email (assignment or removal)
    const roleName = ROLE_LABELS[role] ?? role;
    const templateData = {
      professionalName: displayName,
      roleName,
      propertyName: hierarchy.propertyName,
      propertyCode: hierarchy.propertyCode,
      propertyFloor: hierarchy.propertyFloor,
      buildingName: hierarchy.buildingName,
      projectName: hierarchy.projectName,
      projectAddress: hierarchy.projectAddress,
      companyName: hierarchy.companyName,
      companyPhone: hierarchy.companyPhone ?? undefined,
      companyEmail: hierarchy.companyEmail ?? undefined,
      companyAddress: hierarchy.companyAddress ?? undefined,
      companyWebsite: hierarchy.companyWebsite ?? undefined,
      buyerName: hierarchy.buyerName ?? undefined,
      buyerPhone: hierarchy.buyerPhone ?? undefined,
      buyerEmail: hierarchy.buyerEmail ?? undefined,
    };

    const { subject, html, text } = isRemoval
      ? buildProfessionalRemovalEmail(templateData)
      : buildProfessionalAssignmentEmail(templateData);

    // 5. Send via Mailgun
    const result = await sendReplyViaMailgun({
      to: email,
      subject,
      textBody: text,
      htmlBody: html,
    });

    if (!result.success) {
      logger.error('Failed to send professional assignment email', {
        contactId, email, error: result.error,
      });
      return NextResponse.json({ success: true, emailSent: false });
    }

    logger.info('Professional assignment email sent', {
      contactId, email, role, propertyId, messageId: result.messageId,
    });

    // Audit trail: email sent
    safeFireAndForget(EntityAuditService.recordChange({
      entityType: ENTITY_TYPES.PROPERTY,
      entityId: propertyId,
      entityName: hierarchy.propertyName,
      action: 'email_sent',
      changes: [{
        field: 'notification',
        oldValue: null,
        newValue: `${isRemoval ? 'Ακύρωση' : 'Ανάθεση'}: ${displayName} (${roleName})`,
        label: isRemoval ? 'Email ακύρωσης' : 'Email ανάθεσης',
      }],
      performedBy: ctx.uid,
      performedByName: ctx.email ?? null,
      companyId: ctx.companyId,
    }), 'ProfessionalAssigned.auditTrail');

    return NextResponse.json({ success: true, emailSent: true });
  } catch (error) {
    const msg = getErrorMessage(error);
    logger.error('Professional assignment notification failed', { error: msg });
    return NextResponse.json(
      { success: false, emailSent: false, error: msg },
      { status: 500 }
    );
  }
}

// ============================================================================
// EXPORT
// ============================================================================

const basePOST = async (request: NextRequest) => {
  const handler = withAuth<AssignmentNotificationResponse>(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
      return handleAssignmentNotification(req, ctx);
    }
  );
  return handler(request);
};

export const POST = withStandardRateLimit(basePOST);
