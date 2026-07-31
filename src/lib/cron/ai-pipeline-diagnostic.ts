/**
 * =============================================================================
 * ΔΙΑΓΝΩΣΤΙΚΟ ΟΥΡΑΣ AI PIPELINE — ADR-739
 * =============================================================================
 *
 * Πρόσφατα αποτυχημένα και ολοκληρωμένα στοιχεία της ουράς, για εντοπισμό σφαλμάτων.
 *
 * ## Γιατί μετακινήθηκε εδώ
 *
 * Το ίδιο ερώτημα ήταν γραμμένο **δύο φορές** μέσα στο `route.ts` — μία στο σκέλος της
 * παρτίδας και μία στο σκέλος του health check — με τον ίδιο χάρτη πεδίων. Δύο
 * αντίγραφα σημαίνουν ότι μια αλλαγή στα πεδία διάγνωσης εφαρμόζεται στο ένα και
 * ξεχνιέται στο άλλο (CHECK 3.28 / ADR-584).
 *
 * ## ⚠️ Γιατί απαιτεί εξουσιοδότηση
 *
 * Τα στοιχεία περιέχουν **θέμα και διεύθυνση αποστολέα** πραγματικών εισερχομένων
 * μηνυμάτων. Μέχρι 2026-07-31 επιστρέφονταν στο **μη ταυτοποιημένο** σκέλος του
 * `/api/cron/ai-pipeline` — δηλαδή οποιοσδήποτε καλούσε το endpoint χωρίς
 * διαπιστευτήρια έπαιρνε θέματα και emails πελατών. Το μόνο που το κάλυπτε ήταν το
 * bot-block του `middleware.ts`, που φιλτράρει **user-agent** και αλλάζει σε ένα
 * δευτερόλεπτο· δεν είναι εξουσιοδότηση.
 *
 * Το liveness probe χρειάζεται να ξέρει **αν** η ουρά είναι υγιής, όχι **τι** περιέχει.
 *
 * @module lib/cron/ai-pipeline-diagnostic
 * @see ADR-739
 */

import { COLLECTIONS } from '@/config/firestore-collections';
import { FIELDS } from '@/config/firestore-field-constants';
import { QUEUE_STATUS } from '@/constants/entity-status-values';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { getErrorMessage } from '@/lib/error-utils';

/** Πόσα αποτυχημένα στοιχεία επιστρέφονται. */
const FAILED_SAMPLE_SIZE = 10;
/** Πόσα ολοκληρωμένα, για σύγκριση. */
const COMPLETED_SAMPLE_SIZE = 5;

export interface AiPipelineDiagnostic {
  readonly failedItems?: readonly Record<string, unknown>[];
  readonly recentCompleted?: readonly Record<string, unknown>[];
  readonly error?: string;
}

async function sampleQueue(
  status: string,
  limit: number
): Promise<FirebaseFirestore.QueryDocumentSnapshot[]> {
  const snapshot = await getAdminFirestore()
    .collection(COLLECTIONS.AI_PIPELINE_QUEUE)
    .where(FIELDS.STATUS, '==', status)
    .orderBy(FIELDS.CREATED_AT, 'desc')
    .limit(limit)
    .get();

  return snapshot.docs;
}

/**
 * Συλλέγει διαγνωστικά της ουράς.
 *
 * ⚠️ **Κάλεσέ την ΜΟΝΟ μετά από επιτυχή `verifyCronAuthorization`.** Επιστρέφει
 * περιεχόμενο μηνυμάτων.
 *
 * Η αποτυχία της διάγνωσης **δεν** διαδίδεται: μια διάγνωση που ρίχνει το endpoint
 * μετατρέπει ένα εργαλείο εντοπισμού σφαλμάτων σε πηγή σφαλμάτων.
 */
export async function collectAiPipelineDiagnostic(): Promise<AiPipelineDiagnostic> {
  try {
    const [failed, completed] = await Promise.all([
      sampleQueue(QUEUE_STATUS.FAILED, FAILED_SAMPLE_SIZE),
      sampleQueue(QUEUE_STATUS.COMPLETED, COMPLETED_SAMPLE_SIZE),
    ]);

    return {
      failedItems: failed.map((doc) => {
        const d = doc.data();
        return {
          id: doc.id,
          pipelineState: d.pipelineState,
          retryCount: d.retryCount,
          channel: d.channel,
          lastError: d.lastError,
          retryHistory: d.retryHistory,
          intakeSubject: d.context?.intake?.normalized?.subject,
          intakeSender: d.context?.intake?.normalized?.sender?.email,
          errors: d.context?.errors,
          createdAt: d.createdAt,
        };
      }),
      recentCompleted: completed.map((doc) => {
        const d = doc.data();
        return {
          id: doc.id,
          pipelineState: d.pipelineState,
          intakeSubject: d.context?.intake?.normalized?.subject,
          completedAt: d.completedAt,
        };
      }),
    };
  } catch (error) {
    return { error: getErrorMessage(error, 'Diagnostic error') };
  }
}
