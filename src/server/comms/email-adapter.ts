// /home/user/studio/src/server/comms/email-adapter.ts

import { isFirebaseAvailable } from '../../app/api/communications/webhooks/telegram/firebase/availability';
import { getFirestoreHelpers } from '../../app/api/communications/webhooks/telegram/firebase/helpers-lazy';
import { safeDbOperation } from '../../app/api/communications/webhooks/telegram/firebase/safe-op';

interface EmailJob {
  id: string;
  to: string;
  subject: string;
  content: string;
  from?: string;
  metadata?: {
    templateId?: string;
    category?: string;
    platform?: string;
  };
  attempts: number;
  maxAttempts: number;
}

interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export class EmailAdapter {
  private apiKey: string;
  private fromEmail: string;

  constructor() {
    // In production, this will be loaded from Firebase Functions Secrets
    this.apiKey = process.env.SENDGRID_API_KEY || '';

    // 🏢 ENTERPRISE: Configurable email domain for multi-tenant deployment
    this.fromEmail = this.getFromEmail();

    if (!this.apiKey) {
      console.warn('⚠️ SENDGRID_API_KEY not found in environment');
    }
  }

  /**
   * 🏢 ENTERPRISE: Dynamic from email generation with configurable domain
   */
  private getFromEmail(): string {
    // Primary: Use explicit SENDGRID_FROM_EMAIL if set
    if (process.env.SENDGRID_FROM_EMAIL) {
      return process.env.SENDGRID_FROM_EMAIL;
    }

    // Secondary: Generate from company domain and name
    const domain = process.env.COMPANY_EMAIL_DOMAIN || process.env.NEXT_PUBLIC_COMPANY_EMAIL_DOMAIN;
    const emailPrefix = process.env.EMAIL_PREFIX || 'noreply';

    if (domain) {
      return `${emailPrefix}@${domain}`;
    }

    // Fallback: Generic configuration-driven default
    const fallbackDomain = process.env.FALLBACK_EMAIL_DOMAIN || 'company.com';
    return `${emailPrefix}@${fallbackDomain}`;
  }

  /**
   * Send email via SendGrid API
   */
  async sendEmail(job: EmailJob): Promise<SendResult> {
    if (!this.apiKey) {
      return {
        success: false,
        error: 'SendGrid API key not configured'
      };
    }

    try {
      const payload = {
        personalizations: [{
          to: [{ email: job.to }],
          subject: job.subject
        }],
        from: { email: job.from || this.fromEmail },
        content: [{
          type: 'text/plain',
          value: job.content
        }]
      };

      const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ SendGrid API error:', response.status, errorText);
        return {
          success: false,
          error: `SendGrid API error: ${response.status}`
        };
      }

      // SendGrid returns X-Message-Id header on success
      const messageId = response.headers.get('X-Message-Id') || undefined;
      
      console.log(`✅ Email sent successfully via SendGrid. MessageId: ${messageId}`);
      return {
        success: true,
        messageId
      };

    } catch (error) {
      console.error('❌ Error sending email:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Process email job from Firestore
   */
  async processEmailJob(jobId: string): Promise<boolean> {
    if (!isFirebaseAvailable()) {
      console.warn('⚠️ Firebase not available, cannot process email job');
      return false;
    }

    const firestoreHelpers = await getFirestoreHelpers();
    if (!firestoreHelpers) {
      console.warn('⚠️ Firestore helpers not available');
      return false;
    }

    return await safeDbOperation(async (database) => {
      const { doc, getDoc, updateDoc, Timestamp } = firestoreHelpers;

      // Get job from Firestore
      // 🏢 ENTERPRISE: Use collection helper to get collection ref first
      const communicationsRef = database.collection('communications');
      const jobDoc = await getDoc(doc(communicationsRef, jobId));
      if (!jobDoc.exists) {
        console.error(`❌ Email job ${jobId} not found`);
        return false;
      }

      const jobData = jobDoc.data();

      // 🏢 ENTERPRISE: Null check for jobData
      if (!jobData) {
        console.error(`❌ Email job ${jobId} has no data`);
        return false;
      }

      // Validate job data
      if (jobData.status !== 'pending') {
        console.log(`ℹ️ Email job ${jobId} already processed (status: ${jobData.status})`);
        return true;
      }

      if (jobData.attempts >= jobData.maxAttempts) {
        console.warn(`⚠️ Email job ${jobId} exceeded max attempts`);
        await updateDoc(jobDoc.ref, {
          status: 'failed',
          error: 'Max attempts exceeded',
          updatedAt: Timestamp.now()
        });
        return false;
      }

      // Prepare email job
      const emailJob: EmailJob = {
        id: jobId,
        to: jobData.to,
        subject: jobData.subject,
        content: jobData.content,
        from: jobData.from,
        metadata: jobData.metadata,
        attempts: jobData.attempts,
        maxAttempts: jobData.maxAttempts
      };

      // Update attempts count
      await updateDoc(jobDoc.ref, {
        attempts: jobData.attempts + 1,
        lastAttemptAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });

      // Send email
      const result = await this.sendEmail(emailJob);

      // Update job status
      if (result.success) {
        await updateDoc(jobDoc.ref, {
          status: 'sent',
          externalId: result.messageId,
          sentAt: Timestamp.now(),
          updatedAt: Timestamp.now()
        });
        return true;
      } else {
        const newStatus = jobData.attempts + 1 >= jobData.maxAttempts ? 'failed' : 'pending';
        await updateDoc(jobDoc.ref, {
          status: newStatus,
          error: result.error,
          updatedAt: Timestamp.now()
        });
        return false;
      }

    }, false);
  }
}

// Export singleton instance
export const emailAdapter = new EmailAdapter();
