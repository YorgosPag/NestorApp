// src/services/email.service.ts
// Enterprise Email Service with Resend integration
import { Resend } from 'resend';
import { EmailTemplatesService } from './email-templates.service';
import type { EmailTemplateType, EmailTemplateData } from '@/types/email-templates';

// Environment variables
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || 'info@nestorconstruct.gr';
const FROM_NAME = process.env.FROM_NAME || 'Nestor Construct';
const NODE_ENV = process.env.NODE_ENV || 'development';

// Initialize Resend (only if API key exists)
const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

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
  propertyUrl: string;
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

// Legacy mock send for existing functionality
const mockSend = async (payload: any) => {
    console.log('📧 LEGACY EMAIL:', payload.subject);
    await new Promise(resolve => setTimeout(resolve, 100)); // Simulate network delay
    return { success: true };
};

/**
 * Enterprise Email Service
 * Handles email sending with Resend integration
 */
export class EmailService {

  /**
   * Send property share emails (NEW ENTERPRISE METHOD)
   */
  static async sendPropertyShareEmail(emailRequest: EmailRequest): Promise<EmailResponse> {
    const {
      recipients,
      propertyTitle,
      propertyDescription,
      propertyPrice,
      propertyArea,
      propertyLocation,
      propertyUrl,
      senderName = FROM_NAME,
      personalMessage,
      templateType = 'residential'
    } = emailRequest;

    // Validate inputs
    if (!recipients || recipients.length === 0) {
      throw new Error('At least one recipient is required');
    }

    if (!propertyTitle || !propertyUrl) {
      throw new Error('Property title and URL are required');
    }

    // Check if Resend is properly configured
    if (!resend) {
      console.log('🧪 ENTERPRISE EMAIL SERVICE: Development mode - No API key');
      console.log('📧 Recipients:', recipients);
      console.log('📝 Property:', { title: propertyTitle, url: propertyUrl, template: templateType });

      return {
        success: true,
        message: '🧪 DEVELOPMENT: Email simulated successfully',
        recipients: recipients.length,
        templateUsed: templateType,
        note: 'This is a development simulation. No actual emails were sent.'
      };
    }

    // Production email sending
    try {
      const template = EmailTemplatesService.getTemplate(templateType);
      if (!template) {
        throw new Error(`Email template '${templateType}' not found`);
      }

      // Prepare email data
      const emailData: EmailTemplateData = {
        propertyTitle,
        propertyDescription,
        propertyPrice,
        propertyArea,
        propertyLocation,
        propertyUrl,
        recipientEmail: recipients[0], // Primary recipient
        personalMessage,
        senderName: senderName || FROM_NAME
      };

      // Generate HTML content using existing template service
      const htmlContent = EmailTemplatesService.generateEmailHtml(templateType, emailData);

      // Generate subject line
      const subject = this.generateSubject(templateType, propertyTitle);

      // Send email via Resend
      const result = await resend.emails.send({
        from: `${senderName || FROM_NAME} <${FROM_EMAIL}>`,
        to: recipients,
        subject: subject,
        html: htmlContent,
        tags: [
          { name: 'campaign', value: 'property_share' },
          { name: 'template', value: templateType },
          { name: 'environment', value: NODE_ENV }
        ]
      });

      console.log('✅ ENTERPRISE EMAIL SENT:', {
        id: result.data?.id,
        recipients: recipients.length,
        template: templateType
      });

      return {
        success: true,
        message: `Email sent successfully to ${recipients.length} recipient${recipients.length > 1 ? 's' : ''}`,
        recipients: recipients.length,
        templateUsed: template.name,
        emailId: result.data?.id
      };

    } catch (error) {
      console.error('❌ ENTERPRISE EMAIL ERROR:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to send email');
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
    return {
      configured: !!resend && !!RESEND_API_KEY,
      provider: 'Resend',
      environment: NODE_ENV,
      fromEmail: FROM_EMAIL,
      fromName: FROM_NAME
    };
  }
}

// Legacy email service for backward compatibility
export const emailService = {
    sendEmail: async (payload: EmailPayload) => {
        return mockSend(payload);
    },

    sendWelcomeEmail: async (lead: { fullName: string, email: string }) => {
        return mockSend({
            to: lead.email,
            toName: lead.fullName,
            subject: `Καλώς ήρθατε ${lead.fullName}!`,
            message: "This is a mock welcome email.",
            templateType: 'welcome'
        });
    },

    sendFollowUpEmail: async (lead: { fullName: string, email: string }, message: string) => {
        return mockSend({
            to: lead.email,
            toName: lead.fullName,
            subject: "Follow-up",
            message: message,
            templateType: 'followup'
        });
    },

    sendAppointmentEmail: async (lead: { fullName: string, email: string }, customData: Record<string, any>) => {
        return mockSend({
            to: lead.email,
            toName: lead.fullName,
            subject: "Appointment Confirmation",
            message: `Mock appointment details: ${JSON.stringify(customData)}`,
            templateType: 'appointment'
        });
    },

    sendPropertyProposal: async (lead: { fullName: string, email: string }, customData: Record<string, any>) => {
        return mockSend({
            to: lead.email,
            toName: lead.fullName,
            subject: "Property Proposal",
            message: `Mock property proposal: ${JSON.stringify(customData)}`,
            templateType: 'proposal'
        });
    },
};
