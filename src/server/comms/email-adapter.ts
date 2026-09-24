// /home/user/studio/src/server/comms/email-adapter.ts

import { isFirebaseAvailable } from '../../app/api/communications/webhooks/telegram/firebase/availability';
import { getFirestoreHelpers } from '../../app/api/communications/webhooks/telegram/firebase/helpers-lazy';
import { safeDbOperation } from '../../app/api/communications/webhooks/telegram/firebase/safe-op';
import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';
import { mailgunSendMessage } from '@/server/comms/egress/mailgun-transport';
import {
  adoptStoredSenderHeader,
  type SenderHeader,
} from '@/services/company/sender-identity';
const logger = createModuleLogger('EmailAdapter');

interface EmailJob {
  id: string;
  to: string;
  subject: string;
  content: string;
  html?: string;
  /** ADR-857 Φ9 — κατασκευάζεται **μόνο** από τη ρίζα ταυτότητας αποστολέα. */
  from?: SenderHeader;
  /** Κεφαλίδες φακέλου, **ήδη ελεγμένες** (`safeHeaderEntries`). Γίνονται `h:<Όνομα>`. */
  headers?: Readonly<Record<string, string>>;
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
  // ⚠️ Κανένα κλειδί εδώ (ADR-876 §5.8 Σ22): «είναι ρυθμισμένος;» = `mailgunAvailable()` της πόρτας εξόδου.

  /*
   * 🔴 ΕΔΩ ΖΟΥΣΕ ΤΟ `getFromEmail()` — ΤΕΣΣΕΡΑ ΣΚΑΛΙΑ ΕΦΕΔΡΕΙΑΣ, ΚΑΙ ΤΟ ΤΕΛΕΥΤΑΙΟ
   * ΗΤΑΝ ΨΕΥΤΙΚΟ DOMAIN (ADR-857 Φ9).
   *
   * `MAILGUN_FROM_EMAIL` → `COMPANY_EMAIL_DOMAIN` → `MAILGUN_DOMAIN` →
   * **`noreply@company.com`**. Το τελευταίο σκαλί δεν είναι εφεδρεία· είναι *εφεύρεση
   * εταιρείας που δεν υπάρχει* — και θα έφευγε σε **αληθινό** παραλήπτη αν έλειπε μία
   * μεταβλητή. Ίδιο σχήμα με το «Nestor Construct» που κατήργησε η Φ7: όνομα που δεν
   * αντιστοιχεί σε κανέναν ένοικο.
   *
   * ⚠️ **ΚΑΙ ΔΕΝ ΥΠΟΛΟΓΙΖΕΤΑΙ ΠΙΑ ΣΤΟΝ CONSTRUCTOR.** Το
   * `subapps/procurement/.../email-channel.ts` κατασκευάζει `EmailAdapter` σε **module
   * scope** ⇒ ο αποστολέας πάγωνε στην πρώτη **εισαγωγή του module**, και μια μεταβλητή
   * που έμπαινε αργότερα δεν είχε καμία επίδραση μέχρι επανεκκίνηση. Ρωτιέται πλέον
   * **τη στιγμή της αποστολής**, όπως το `defaultEmailChain()`.
   */

  /**
   * Αποστολή μέσω της ΜΙΑΣ πόρτας εξόδου Mailgun (ADR-876 §5.8 Σ22).
   *
   * 🔴 Εδώ ζούσε **δεύτερο** αντίγραφο του URL περιοχής + Basic auth, **χωρίς** όριο χρόνου, και
   * χωρίς ιδέα για emulator. Πλέον: περιοχή · auth · `PROVIDER_TIMEOUT_MS` · «σε emulator ⇒ outbox»
   * ζουν ΜΙΑ φορά στο `egress/mailgun-transport`.
   */
  async sendEmail(job: EmailJob): Promise<SendResult> {
    const result = await mailgunSendMessage({
      to: job.to,
      from: job.from,
      subject: job.subject,
      text: job.content,
      html: job.html,
      headers: job.headers,
    });
    return result.ok ? { success: true, messageId: result.messageId } : { success: false, error: result.error };
  }

  /**
   * Process email job from Firestore
   */
  async processEmailJob(jobId: string): Promise<boolean> {
    if (!isFirebaseAvailable()) {
      logger.warn('⚠️ Firebase not available, cannot process email job');
      return false;
    }

    const firestoreHelpers = await getFirestoreHelpers();
    if (!firestoreHelpers) {
      logger.warn('⚠️ Firestore helpers not available');
      return false;
    }

    return await safeDbOperation(async (database) => {
      const { doc, getDoc, updateDoc, Timestamp } = firestoreHelpers;

      // Get job from Firestore
      // 🏢 ENTERPRISE: Use collection helper to get collection ref first
      const communicationsRef = database.collection(COLLECTIONS.COMMUNICATIONS);
      const jobDoc = await getDoc(doc(communicationsRef, jobId));
      if (!jobDoc.exists) {
        logger.error(`❌ Email job ${jobId} not found`);
        return false;
      }

      const jobData = jobDoc.data();

      // 🏢 ENTERPRISE: Null check for jobData
      if (!jobData) {
        logger.error(`❌ Email job ${jobId} has no data`);
        return false;
      }

      // Validate job data
      if (jobData.status !== 'pending') {
        logger.info(`ℹ️ Email job ${jobId} already processed (status: ${jobData.status})`);
        return true;
      }

      if (jobData.attempts >= jobData.maxAttempts) {
        logger.warn(`⚠️ Email job ${jobId} exceeded max attempts`);
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
        // 🔴 ADR-857 Φ9 — **ΕΔΩ Ο ΤΥΠΟΣ ΠΑΡΑΚΑΜΠΤΟΤΑΝ ΑΟΡΑΤΑ.** Το `jobDoc.data()`
        //    επιστρέφει `DocumentData`, δηλαδή `any` — και το `any` εκχωρείται σιωπηλά
        //    σε branded πεδίο **χωρίς καν `as`**, χωρίς κανένα σημάδι σε αναθεώρηση.
        //    Είναι το δηλωμένο όριο #1 κάθε branded type, στη χειρότερη μορφή του.
        //    Ίδια κλάση με την ουρά (`deliverOne`): αποθηκευμένη τιμή → κεφαλίδα ⇒
        //    ίδια θεραπεία, ο υιοθετητής που **ξανακαθαρίζει**.
        from: adoptStoredSenderHeader(jobData.from),
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

