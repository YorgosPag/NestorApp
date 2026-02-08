// /home/user/studio/src/server/comms/workers/email-worker.ts

import { emailAdapter } from '../email-adapter';
import { isFirebaseAvailable } from '../../../app/api/communications/webhooks/telegram/firebase/availability';
import { getFirestoreHelpers } from '../../../app/api/communications/webhooks/telegram/firebase/helpers-lazy';
import { safeDbOperation } from '../../../app/api/communications/webhooks/telegram/firebase/safe-op';
import { COLLECTIONS } from '@/config/firestore-collections';

export class EmailWorker {
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;
  private readonly pollInterval: number;

  constructor(pollIntervalMs = 30000) { // Default: check every 30 seconds
    this.pollInterval = pollIntervalMs;
  }

  /**
   * Start the email worker (polling mode)
   */
  start(): void {
    if (this.isRunning) {
      console.log('📧 Email worker is already running');
      return;
    }

    console.log('🚀 Starting email worker...');
    this.isRunning = true;

    // Process immediately on start
    this.processPendingEmails();

    // Set up polling interval
    this.intervalId = setInterval(() => {
      this.processPendingEmails();
    }, this.pollInterval);

    console.log(`✅ Email worker started (polling every ${this.pollInterval}ms)`);
  }

  /**
   * Stop the email worker
   */
  stop(): void {
    if (!this.isRunning) {
      console.log('📧 Email worker is not running');
      return;
    }

    console.log('🛑 Stopping email worker...');
    this.isRunning = false;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    console.log('✅ Email worker stopped');
  }

  /**
   * Process all pending email jobs
   */
  async processPendingEmails(): Promise<void> {
    if (!isFirebaseAvailable()) {
      console.warn('⚠️ Firebase not available, skipping email processing');
      return;
    }

    const firestoreHelpers = await getFirestoreHelpers();
    if (!firestoreHelpers) {
      console.warn('⚠️ Firestore helpers not available for email processing');
      return;
    }

    try {
      const pendingJobs = await this.getPendingEmailJobs();
      
      if (pendingJobs.length === 0) {
        console.log('📧 No pending email jobs found');
        return;
      }

      console.log(`📧 Processing ${pendingJobs.length} pending email job(s)...`);

      // Process jobs sequentially to avoid overwhelming Mailgun API
      for (const job of pendingJobs) {
        try {
          const success = await emailAdapter.processEmailJob(job.id);
          if (success) {
            console.log(`✅ Email job ${job.id} processed successfully`);
          } else {
            console.log(`❌ Email job ${job.id} failed to process`);
          }
          
          // Small delay between jobs to be respectful to Mailgun API
          await this.delay(1000);
        } catch (error) {
          console.error(`❌ Error processing email job ${job.id}:`, error);
        }
      }

      console.log('📧 Finished processing email jobs');

    } catch (error) {
      console.error('❌ Error in email worker:', error);
    }
  }

  /**
   * Get pending email jobs from Firestore
   */
  private async getPendingEmailJobs(): Promise<Array<{ id: string }>> {
    if (!isFirebaseAvailable()) {
      return [];
    }

    const firestoreHelpers = await getFirestoreHelpers();
    if (!firestoreHelpers) {
      return [];
    }

    return await safeDbOperation(async (database) => {
      const { collection, query, where, getDocs, orderBy, limit } = firestoreHelpers;

      // Query for pending email jobs, ordered by creation time
      // 🔄 2026-01-17: Changed from COMMUNICATIONS to MESSAGES
      const q = query(
        collection(COLLECTIONS.MESSAGES),
        where('channel', '==', 'email'),
        where('status', '==', 'pending'),
        where('type', '==', 'email'),
        orderBy('createdAt', 'asc'),
        limit(50) // Process max 50 at a time
      );

      const snapshot = await getDocs(q);
      const jobs: Array<{ id: string }> = [];

      snapshot.forEach((doc) => {
        const data = doc.data();
        
        // Additional validation
        if (data.attempts < data.maxAttempts) {
          jobs.push({ id: doc.id });
        }
      });

      return jobs;
    }, []);
  }

  /**
   * Process a single email job by ID
   */
  async processEmailJob(jobId: string): Promise<boolean> {
    try {
      console.log(`📧 Processing single email job: ${jobId}`);
      const success = await emailAdapter.processEmailJob(jobId);
      
      if (success) {
        console.log(`✅ Email job ${jobId} processed successfully`);
      } else {
        console.log(`❌ Email job ${jobId} failed to process`);
      }
      
      return success;
    } catch (error) {
      console.error(`❌ Error processing email job ${jobId}:`, error);
      return false;
    }
  }

  /**
   * Get worker status
   */
  getStatus(): { isRunning: boolean; pollInterval: number } {
    return {
      isRunning: this.isRunning,
      pollInterval: this.pollInterval
    };
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const emailWorker = new EmailWorker();
