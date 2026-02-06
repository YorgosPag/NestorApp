// /home/user/studio/src/server/comms/email-adapter.ts

import { isFirebaseAvailable } from '../../app/api/communications/webhooks/telegram/firebase/availability';
import { getFirestoreHelpers } from '../../app/api/communications/webhooks/telegram/firebase/helpers-lazy';
import { safeDbOperation } from '../../app/api/communications/webhooks/telegram/firebase/safe-op';
import { COLLECTIONS } from '@/config/firestore-collections';

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
  private domain: string;
  private fromEmail: string;

  constructor() {
    this.apiKey = process.env.MAILGUN_API_KEY || '';
    this.domain = process.env.MAILGUN_DOMAIN || '';

    // 🏢 ENTERPRISE: Configurable email domain for multi-tenant deployment
    this.fromEmail = this.getFromEmail();

    if (!this.apiKey) {
      console.warn('⚠️ MAILGUN_API_KEY not found in environment');
    }
    if (!this.domain) {
      console.warn('⚠️ MAILGUN_DOMAIN not found in environment');
    }
  }

  /**
   * 🏢 ENTERPRISE: Dynamic from email generation with configurable domain
   */
  private getFromEmail(): string {
    // Primary: Use explicit MAILGUN_FROM_EMAIL if set
    if (process.env.MAILGUN_FROM_EMAIL) {
      return process.env.MAILGUN_FROM_EMAIL;
    }

    // Secondary: Generate from company domain and name
    const domain = process.env.COMPANY_EMAIL_DOMAIN || process.env.NEXT_PUBLIC_COMPANY_EMAIL_DOMAIN;
    const emailPrefix = process.env.EMAIL_PREFIX || 'noreply';

    if (domain) {
      return `${emailPrefix}@${domain}`;
    }

    // Fallback: Use Mailgun domain
    if (this.domain) {
      return `${emailPrefix}@${this.domain}`;
    }

    const fallbackDomain = process.env.FALLBACK_EMAIL_DOMAIN || 'company.com';
    return `${emailPrefix}@${fallbackDomain}`;
  }

  /**
   * 🏢 ENTERPRISE: Send email via Mailgun API
   * @see https://documentation.mailgun.com/docs/mailgun/api-reference/openapi-final/tag/Messages/
   */
  async sendEmail(job: EmailJob): Promise<SendResult> {
    if (!this.apiKey || !this.domain) {
      return {
        success: false,
        error: 'Mailgun API key or domain not configured'
      };
    }

    try {
      const formData = new FormData();
      formData.append('from', job.from || this.fromEmail);
      formData.append('to', job.to);
      formData.append('subject', job.subject);
      formData.append('text', job.content);

      const region = process.env.MAILGUN_REGION === 'eu' ? 'api.eu.mailgun.net' : 'api.mailgun.net';
      const url = `https://${region}/v3/${this.domain}/messages`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${Buffer.from(`api:${this.apiKey}`).toString('base64')}`,
        },
        body: formData
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Mailgun API error:', response.status, errorText);
        return {
          success: false,
          error: `Mailgun API error: ${response.status}`
        };
      }

      const result = await response.json() as { id?: string; message?: string };
      const messageId = result.id || undefined;

      console.log(`✅ Email sent successfully via Mailgun. MessageId: ${messageId}`);
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
      const communicationsRef = database.collection(COLLECTIONS.COMMUNICATIONS);
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
