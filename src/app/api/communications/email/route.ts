// /home/user/studio/src/app/api/communications/email/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, logAuditEvent, extractRequestMetadata } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { getRequiredEmailFunctionUrl } from '@/config/admin-env';
// Ensure Firebase Admin is initialized
import '@/server/admin/admin-guards';

interface EmailPayload {
  to: string;
  templateId: string;
  subject: string;
  message: string;
  leadId?: string;
  priority?: 'low' | 'normal' | 'high';
  category?: string;
}

interface EmailResponse {
  id?: string;
  status: string;
  message: string;
  production?: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Send email endpoint - requires authentication and comm:messages:send permission.
 * RFC v6 Authorization: Communications vertical slice.
 */
export const POST = withAuth<EmailResponse>(
  async (request: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
    try {
      const payload: EmailPayload = await request.json();

      // Validation
      if (!payload.to || !payload.subject || !payload.message) {
        return NextResponse.json(
          { status: 'error', message: 'Missing required fields', error: 'Missing required fields: to, subject, message' },
          { status: 400 }
        );
      }

      // Call Firebase Function (from centralized config)
      const functionUrl = getRequiredEmailFunctionUrl();

      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: payload.to,
          subject: payload.subject,
          message: payload.message,
          templateId: payload.templateId,
          leadId: payload.leadId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('❌ Firebase Function error:', errorData);
        return NextResponse.json(
          { status: 'error', message: 'Failed to send email', error: errorData.error || 'Failed to send email' },
          { status: response.status }
        );
      }

      const result = await response.json();

      // Log successful send with tenant context
      console.log('✅ PRODUCTION Email sent via SendGrid:', {
        to: payload.to,
        messageId: result.messageId,
        status: result.status,
        companyId: ctx.companyId,
        userId: ctx.uid,
      });

      // Audit log for email send action
      await logAuditEvent(
        ctx,
        'email_sent',
        'communications.email.send',
        'api',
        {
          newValue: { type: 'status', value: { recipient: payload.to, messageId: result.messageId } },
          metadata: extractRequestMetadata(request),
        }
      );

      return NextResponse.json({
        id: result.messageId,
        status: 'sent',
        message: 'Email sent successfully via SendGrid',
        production: true,
        messageId: result.messageId,
      });
    } catch (error) {
      console.error('❌ Error in email API:', error);
      return NextResponse.json(
        { status: 'error', message: 'Internal server error', error: 'Internal server error' },
        { status: 500 }
      );
    }
  },
  {
    permissions: 'comm:messages:send',
  }
);
