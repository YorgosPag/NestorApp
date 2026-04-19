// src/services/email.service.ts
// Enterprise Email Service with Resend + Mailgun fallback
import { Resend } from 'resend';
import { getErrorMessage } from '@/lib/error-utils';
import { EmailTemplatesService } from './email-templates.service';
import { buildPhotoShareEmail } from './email-templates/photo-share';
import { EmailAdapter } from '@/server/comms/email-adapter';
import type { EmailTemplateType, EmailTemplateData } from '@/types/email-templates';

// Environment variables
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const MAILGUN_API_KEY = process.env.MAILGUN_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || 'info@nestorconstruct.gr';
const FROM_NAME = process.env.FROM_NAME || 'Nestor Construct';
const NODE_ENV = process.env.NODE_ENV || 'development';

// Initialize Resend (only if API key exists)
const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;
// Mailgun fallback adapter
const mailgunAdapter = MAILGUN_API_KEY ? new EmailAdapter() : null;

// Legacy interface for backward compatibility
interface EmailPayload {
    to: string;
    toName: string;
    subject: string;
    message: string;
    leadId?: string;
    templateType?: string;
}

// New enterprise interface
export interface EmailRequest {
  recipients: string[];
  recipientName?: string;
  propertyTitle: string;
  propertyDescription?: string;
  propertyPrice?: number;
  propertyArea?: number;
  propertyLocation?: string;
  propertyUrl?: string;
  photoUrl?: string;
  photoUrls?: string[];
  isPhoto?: boolean;
  senderName?: string;
  personalMessage?: string;
  templateType?: EmailTemplateType;
}

export interface EmailResponse {
  success: boolean;
  message: string;
  recipients: number;
  templateUsed: string;
  emailId?: string;
  note?: string;
}

// Legacy sample send for existing functionality
const sampleSend = async (payload: EmailPayload) => {
    await new Promise(resolve => setTimeout(resolve, 100)); // Simulate network delay
    return { success: true };
};

/**
 * Race a provider call against a 20s timeout so a hanging SMTP/API server
 * fails fast instead of pinning the Next.js serverless function on the 60s
 * client budget (incident 2026-04-19: Resend hung silently → 408 in UI).
 * Centralised here so both the Resend and Mailgun paths wear the same guard.
 */
function withProviderTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  const timeoutMs = 20_000;
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(`${label} provider timeout after ${timeoutMs}ms`)),
        timeoutMs,
      ),
    ),
  ]);
}

/**
 * Enterprise Email Service
 * Handles email sending with Resend integration
 */
export class EmailService {

  /**
   * Send property share emails (NEW ENTERPRISE METHOD)
   */
  static async sendPropertyShareEmail(emailRequest: EmailRequest): Promise<EmailResponse> {
    console.debug('🔍 DEBUG: EmailService.sendPropertyShareEmail called');
    console.debug('🔍 DEBUG: RESEND_API_KEY exists:', !!RESEND_API_KEY);
    console.debug('🔍 DEBUG: resend object:', !!resend);
    console.debug('🔍 DEBUG: NODE_ENV:', NODE_ENV);

    const {
      recipients,
      propertyTitle,
      propertyDescription,
      propertyPrice,
      propertyArea,
      propertyLocation,
      propertyUrl,
      photoUrl,
      senderName = FROM_NAME,
      personalMessage,
      templateType = 'residential',
      isPhoto,
    } = emailRequest;

    // Validate inputs
    if (!recipients || recipients.length === 0) {
      throw new Error('At least one recipient is required');
    }

    if (!propertyTitle) {
      throw new Error('Property title is required');
    }

    // Determine provider: Resend → Mailgun → Simulation
    const provider = resend ? 'resend' : mailgunAdapter ? 'mailgun' : null;

    if (!provider) {
      console.debug('🧪 EMAIL SERVICE: No provider configured (need RESEND_API_KEY or MAILGUN_API_KEY)');
      return {
        success: true,
        message: '🧪 DEVELOPMENT: Email simulated successfully',
        recipients: recipients.length,
        templateUsed: templateType,
        note: 'No email provider configured. Set RESEND_API_KEY or MAILGUN_API_KEY.'
      };
    }

    try {
      let htmlContent: string;
      let subject: string;

      const allPhotoUrls = emailRequest.photoUrls;
      if (isPhoto && (photoUrl || allPhotoUrls?.length)) {
        // Photo share → branded Pagonis Energo template with inline photo(s)
        htmlContent = buildPhotoShareEmail({
          photoUrl: photoUrl || allPhotoUrls![0],
          photoUrls: allPhotoUrls,
          title: propertyTitle,
          personalMessage,
          senderName: senderName || FROM_NAME,
          recipientEmail: recipients[0],
        });
        subject = `${propertyTitle} — Nestor Construct`;
      } else {
        // Property share → existing templates (residential/commercial/premium)
        const template = EmailTemplatesService.getTemplate(templateType);
        if (!template) {
          throw new Error(`Email template '${templateType}' not found`);
        }
        // Normalize undefined → '' so template interpolation doesn't emit
        // the literal string "undefined" in href attributes.
        const emailData: EmailTemplateData = {
          propertyTitle, propertyDescription, propertyPrice, propertyArea,
          propertyLocation, propertyUrl: propertyUrl ?? '', photoUrl,
          recipientEmail: recipients[0],
          personalMessage, senderName: senderName || FROM_NAME
        };
        htmlContent = EmailTemplatesService.generateEmailHtml(templateType, emailData);
        // Generic shares (contacts, projects) pass no propertyUrl. The legacy
        // property templates always emit a CTA <a>. Strip those CTA wrappers
        // post-render so recipients don't see a broken "href=""" button.
        if (!propertyUrl) {
          htmlContent = htmlContent.replace(
            /<div style="text-align: center[^"]*">\s*<a href=""[^>]*class="cta-[^"]+"[\s\S]*?<\/a>\s*<\/div>/g,
            '',
          );
        }
        subject = this.generateSubject(templateType, propertyTitle);
      }

      // Send via available provider
      if (provider === 'resend' && resend) {
        const result = await withProviderTimeout(
          resend.emails.send({
            from: `${senderName || FROM_NAME} <${FROM_EMAIL}>`,
            to: recipients,
            subject,
            html: htmlContent,
            tags: [
              { name: 'campaign', value: 'property_share' },
              { name: 'template', value: templateType },
              { name: 'environment', value: NODE_ENV }
            ]
          }),
          'Resend',
        );

        console.debug('✅ EMAIL SENT via Resend:', { id: result.data?.id, recipients: recipients.length });
        return {
          success: true,
          message: `Email sent successfully to ${recipients.length} recipient${recipients.length > 1 ? 's' : ''}`,
          recipients: recipients.length,
          templateUsed: isPhoto ? 'photo-share' : templateType,
          emailId: result.data?.id
        };
      }

      // Mailgun path — send to each recipient
      if (provider === 'mailgun' && mailgunAdapter) {
        const fromHeader = `${senderName || FROM_NAME} <${FROM_EMAIL}>`;
        const results = await withProviderTimeout(
          Promise.all(
            recipients.map(to =>
              mailgunAdapter.sendEmail({
                id: `share_${Date.now()}`,
                to,
                subject,
                content: propertyUrl ? `${propertyTitle} — ${propertyUrl}` : propertyTitle,
                html: htmlContent,
                from: fromHeader,
                metadata: { templateId: templateType, category: 'property_share' },
                attempts: 0,
                maxAttempts: 1,
              })
            )
          ),
          'Mailgun',
        );

        const successCount = results.filter(r => r.success).length;
        const firstId = results.find(r => r.messageId)?.messageId;
        console.debug('✅ EMAIL SENT via Mailgun:', { successCount, recipients: recipients.length });

        if (successCount === 0) throw new Error('All Mailgun sends failed');
        return {
          success: true,
          message: `Email sent to ${successCount}/${recipients.length} recipients via Mailgun`,
          recipients: successCount,
          templateUsed: isPhoto ? 'photo-share' : templateType,
          emailId: firstId,
        };
      }

      throw new Error('No email provider available');

    } catch (error) {
      console.error('❌ ENTERPRISE EMAIL ERROR:', error);
      throw new Error(getErrorMessage(error, 'Failed to send email'));
    }
  }

  /**
   * Generate email subject based on template type
   */
  private static generateSubject(templateType: EmailTemplateType, propertyTitle: string): string {
    switch (templateType) {
      case 'residential':
        return `🏠 Το Σπίτι των Ονείρων σας: ${propertyTitle} - Nestor Construct`;
      case 'commercial':
        return `🏢 Επαγγελματική Ευκαιρία: ${propertyTitle} - Nestor Construct`;
      case 'premium':
        return `⭐ Premium Collection: ${propertyTitle} - Nestor Construct`;
      default:
        return `🏠 Κοινοποίηση Ακινήτου: ${propertyTitle} - Nestor Construct`;
    }
  }

  /**
   * Get service status
   */
  static getStatus() {
    const activeProvider = resend ? 'Resend' : mailgunAdapter ? 'Mailgun' : 'None';
    return {
      configured: !!(resend || mailgunAdapter),
      provider: activeProvider,
      environment: NODE_ENV,
      fromEmail: FROM_EMAIL,
      fromName: FROM_NAME
    };
  }
}

// Legacy email service for backward compatibility
export const emailService = {
    sendEmail: async (payload: EmailPayload) => {
        return sampleSend(payload);
    },

    sendWelcomeEmail: async (lead: { fullName: string, email: string }) => {
        return sampleSend({
            to: lead.email,
            toName: lead.fullName,
            subject: `Καλώς ήρθατε ${lead.fullName}!`,
            message: "This is a sample welcome email.",
            templateType: 'welcome'
        });
    },

    sendFollowUpEmail: async (lead: { fullName: string, email: string }, message: string) => {
        return sampleSend({
            to: lead.email,
            toName: lead.fullName,
            subject: "Follow-up",
            message: message,
            templateType: 'followup'
        });
    },

    sendAppointmentEmail: async (lead: { fullName: string, email: string }, customData: Record<string, unknown>) => {
        return sampleSend({
            to: lead.email,
            toName: lead.fullName,
            subject: "Appointment Confirmation",
            message: `Sample appointment details: ${JSON.stringify(customData)}`,
            templateType: 'appointment'
        });
    },

    sendPropertyProposal: async (lead: { fullName: string, email: string }, customData: Record<string, unknown>) => {
        return sampleSend({
            to: lead.email,
            toName: lead.fullName,
            subject: "Property Proposal",
            message: `Sample property proposal: ${JSON.stringify(customData)}`,
            templateType: 'proposal'
        });
    },
};
