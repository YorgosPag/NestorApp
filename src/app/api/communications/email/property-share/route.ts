import { NextRequest, NextResponse } from 'next/server';
import { EmailService } from '@/services/email.service';
import type { EmailRequest } from '@/services/email.service';
import type { EmailTemplateType } from '@/types/email-templates';
import { withAuth, logAuditEvent, extractRequestMetadata } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { createModuleLogger } from '@/lib/telemetry';
import '@/server/admin/admin-guards';
import { getErrorMessage } from '@/lib/error-utils';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FieldValue } from 'firebase-admin/firestore';
import { generateShareId } from '@/services/enterprise-id.service';
import {
  type PropertyShareEmailRequest,
  RATE_LIMIT_MAX_REQUESTS,
  getClientIP,
  checkRateLimit,
  validateEmailRequest,
} from './property-share-validation';
import { nowISO } from '@/lib/date-local';

const logger = createModuleLogger('PropertyShareRoute');

const NODE_ENV = process.env.NODE_ENV || 'development';

/**
 * Response type for property share endpoint — RFC v6 type safety
 */
interface PropertyShareResponse {
  error?: string;
  message?: string;
  details?: string[];
  success?: boolean;
  recipients?: number;
  templateUsed?: string;
  emailId?: string;
}

/** Logging helper for email attempts */
function logEmailAttempt(
  ip: string,
  success: boolean,
  data: Partial<PropertyShareEmailRequest>,
  error?: string,
  duration?: number,
) {
  const logEntry = {
    timestamp: nowISO(),
    ip,
    success,
    recipientCount: data.recipients?.length || 1,
    templateType: (data.templateType || 'residential') as EmailTemplateType,
    propertyTitle: data.propertyTitle?.substring(0, 50) || 'unknown',
    error: error?.substring(0, 100),
    duration,
    environment: NODE_ENV,
  };

  if (success) {
    logger.info('Email API success', { logEntry });
  } else {
    logger.error('Email API error', { logEntry });
  }
}

/**
 * Property share email endpoint — requires authentication and comm:messages:send.
 * RFC v6 Authorization: Communications vertical slice.
 */
export const POST = withAuth<PropertyShareResponse>(
  async (request: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
    const startTime = Date.now();
    const clientIP = getClientIP(request);

    try {
      // Rate limiting
      if (!checkRateLimit(clientIP)) {
        logEmailAttempt(clientIP, false, {}, 'Rate limit exceeded');
        return NextResponse.json(
          { error: 'Rate limit exceeded', message: `Maximum ${RATE_LIMIT_MAX_REQUESTS} emails per minute allowed` },
          { status: 429, headers: { 'Retry-After': '60', 'X-RateLimit-Limit': RATE_LIMIT_MAX_REQUESTS.toString(), 'X-RateLimit-Remaining': '0' } },
        );
      }

      // Parse request body
      let requestData: Record<string, unknown>;
      try {
        requestData = await request.json();
      } catch {
        logEmailAttempt(clientIP, false, {}, 'Invalid JSON in request body');
        return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
      }

      // Validate + sanitize
      const { isValid, errors, sanitizedData } = validateEmailRequest(requestData);
      if (!isValid) {
        logEmailAttempt(clientIP, false, requestData as Partial<PropertyShareEmailRequest>, `Validation failed: ${errors.join(', ')}`);
        return NextResponse.json({ error: 'Validation failed', details: errors }, { status: 400 });
      }

      const data = sanitizedData!;
      logger.info('Property Share Email API called', {
        ip: clientIP,
        recipientCount: data.recipients!.length,
        templateType: data.templateType,
        propertyTitle: data.propertyTitle,
        companyId: ctx.companyId,
        userId: ctx.uid,
      });

      // Build EmailService request
      const emailRequest: EmailRequest = {
        recipients: data.recipients!,
        recipientName: data.recipientName,
        propertyTitle: data.propertyTitle,
        propertyDescription: data.propertyDescription,
        propertyPrice: data.propertyPrice,
        propertyArea: data.propertyArea,
        propertyLocation: data.propertyLocation,
        propertyUrl: data.propertyUrl,
        photoUrl: data.photoUrl,
        photoUrls: Array.isArray(requestData.photoUrls)
          ? (requestData.photoUrls as unknown[]).filter((u): u is string => typeof u === 'string')
          : undefined,
        isPhoto: !!requestData.isPhoto,
        senderName: data.senderName,
        personalMessage: data.personalMessage,
        templateType: data.templateType,
      };

      // Send via Enterprise EmailService
      try {
        const result = await EmailService.sendPropertyShareEmail(emailRequest);
        const duration = Date.now() - startTime;
        logEmailAttempt(clientIP, true, data, undefined, duration);

        // Persist photo share record for history (non-blocking)
        if (requestData.isPhoto && requestData.sourceContactId) {
          try {
            const db = getAdminFirestore();
            if (db) {
              const shareId = generateShareId();
              const photoUrls = Array.isArray(requestData.photoUrls)
                ? (requestData.photoUrls as unknown[]).filter((u): u is string => typeof u === 'string')
                : data.photoUrl ? [data.photoUrl] : [];

              await db.collection(COLLECTIONS.PHOTO_SHARES).doc(shareId).set({
                contactId: requestData.sourceContactId as string,
                contactName: (requestData.sourceContactName as string) ?? '',
                channel: 'email',
                externalUserId: data.recipients![0],
                photoUrls,
                photoCount: photoUrls.length,
                caption: data.personalMessage ?? null,
                status: 'sent',
                sentCount: photoUrls.length,
                companyId: ctx.companyId,
                createdBy: ctx.uid,
                createdAt: FieldValue.serverTimestamp(),
              });
            }
          } catch (shareWriteError) {
            logger.warn('Photo share record write failed (non-blocking)', {
              error: getErrorMessage(shareWriteError),
            });
          }
        }

        // Audit trail
        await logAuditEvent(ctx, 'email_sent', 'communications.property-share.send', 'api', {
          newValue: {
            type: 'status',
            value: {
              recipients: data.recipients!.length,
              propertyTitle: data.propertyTitle,
              templateType: data.templateType,
              ...(requestData.sourceContactId ? {
                sourceContactId: requestData.sourceContactId,
                sourceContactName: requestData.sourceContactName,
              } : {}),
            },
          },
          metadata: extractRequestMetadata(request),
        });

        return NextResponse.json(result);
      } catch (error) {
        const duration = Date.now() - startTime;
        logEmailAttempt(clientIP, false, data, getErrorMessage(error), duration);
        return NextResponse.json(
          { error: 'Failed to send emails', message: 'Our email service is temporarily unavailable. Please try again later.' },
          { status: 500 },
        );
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      logEmailAttempt(clientIP, false, {}, getErrorMessage(error), duration);
      return NextResponse.json(
        { error: 'Internal server error', message: 'An unexpected error occurred. Please try again later.' },
        { status: 500 },
      );
    }
  },
  { permissions: 'comm:messages:send' },
);

// Health check endpoint
export async function GET() {
  return NextResponse.json({
    status: 'healthy',
    service: 'email-api',
    timestamp: nowISO(),
    environment: NODE_ENV,
    features: {
      rate_limiting: true,
      input_validation: true,
      template_support: true,
      comprehensive_logging: true,
    },
  });
}
