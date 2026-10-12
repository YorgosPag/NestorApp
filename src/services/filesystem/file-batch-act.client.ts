/**
 * @fileoverview **Ο ΠΕΛΑΤΗΣ ΤΩΝ ΜΑΖΙΚΩΝ ΠΡΑΞΕΩΝ ΚΑΤΑΣΤΑΣΗΣ** — διαβάθμιση και αρχειοθέτηση: ζητά, και **το λέει**.
 * @related app/api/files/classification · app/api/files/archive · ./file-trash.client (το ίδιο σχήμα) ·
 *   hooks/files/useSettledFileChange (ποιος ακούει) · ADR-845 §7.17 · ADR-907 §11.13
 * @module services/filesystem/file-batch-act.client
 *
 * 🔴 **Γιατί υπάρχει η ανακοίνωση** (μετρημένο ζωντανά 2026-10-12, ADR-907 §11.13): η εικόνα κάτοψης ορόφου
 * σημάνθηκε «Δημόσιο», η λίστα αρχείων έδειξε το σήμα — και το πάνελ της δήλωσης, **στην ίδια οθόνη**, συνέχισε να
 * γράφει «όχι δημόσια». Η λίστα φρεσκαριζόταν επειδή ο καλών της έκανε δικό του `refetch()`· η πράξη η ίδια δεν
 * έλεγε σε κανέναν ότι έγινε. Όποιος **κρίνει** αρχεία (δήλωση κάτοψης, συμφωνία δημοσιευμένων μέσων) έμενε με ό,τι
 * είχε διαβάσει πριν.
 *
 * 🔑 **Η πράξη ανακοινώνει, όχι ο καλών**: δύο καλούντες σήμερα (λίστα οντότητας, κεντρικός διαχειριστής), και ο
 * τρίτος δεν θα το θυμόταν. Ίδιο ιδίωμα με το `propagateEntityLabelRenameWithPolicy` της πύλης.
 *
 * ⚠️ Χωριστό module από την πύλη (`file-mutation-gateway`) για τον λόγο του `file-trash.client`: η πύλη τα
 * **επανεξάγει** με τα ίδια ονόματα — κανένας καλών δεν αλλάζει.
 */

import { API_ROUTES, FILE_LIFECYCLE_STATES, type FileClassification } from '@/config/domain-constants';
import { apiClient } from '@/lib/api/enterprise-api-client';
import type { FileBatchActResponse } from '@/services/file-record/file-batch-act.types';
import type { FileUpdatedPayload } from '@/services/realtime';

type FileArchiveDirection = 'archive' | 'unarchive';

/** Τα αρχεία που ο διακομιστής **αρνήθηκε** — το `errors` τα ονομάζει ως `"{fileId}: {λόγος}"`. */
function refusedFileIds(errors: readonly string[]): ReadonlySet<string> {
  return new Set(errors.map((line) => line.split(': ', 1)[0]));
}

/**
 * **Πες στην οθόνη ότι αυτά τα αρχεία άλλαξαν** — ένα `FILE_UPDATED` ανά αρχείο που **δεν** αρνήθηκε ο διακομιστής.
 *
 * - Τίποτα δεν άλλαξε (`processedCount === 0`) ⇒ **κανένα** σήμα: ούτε για ολική άρνηση, ούτε για πράξη χωρίς έργο.
 * - Αρχείο που ήταν ήδη στη ζητούμενη κατάσταση παίρνει σήμα με την **αληθινή** του τιμή — αβλαβές.
 */
async function announceFileBatchAct(
  fileIds: readonly string[],
  response: FileBatchActResponse,
  updates: FileUpdatedPayload['updates'],
): Promise<void> {
  if (response.processedCount <= 0) return;
  const refused = refusedFileIds(response.errors);
  const changed = fileIds.filter((fileId) => !refused.has(fileId));
  if (changed.length === 0) return;

  const { RealtimeService } = await import('@/services/realtime');
  const timestamp = Date.now();
  for (const fileId of changed) RealtimeService.dispatch('FILE_UPDATED', { fileId, updates, timestamp });
}

/**
 * Η **αρχειοθέτηση είναι ΜΙΑ διαδρομή με δύο κατευθύνσεις** — ποτέ δύο σώματα.
 *
 * ⚠️ **ΠΡΟΫΠΑΡΧΟΝ ΧΡΕΟΣ, θεραπευμένο επιτόπου (N.0.2)**: οι δύο συναρτήσεις ήταν
 * δίδυμα **7 γραμμών** που διέφεραν σε **ένα literal** — το σχήμα που ο N.18
 * ονομάζει, και που το **CHECK 3.28** μέτρησε (50 tokens) μόλις το αρχείο μπήκε σε
 * diff. Δεν γεννήθηκε εδώ· φάνηκε εδώ.
 *
 * 🔑 Τα **δύο δημόσια ονόματα μένουν**: η κατεύθυνση είναι μέρος του λεξιλογίου του
 * καλούντος (*«αρχειοθέτησε»* / *«επανάφερε»*), και μια σκέτη `boolean` παράμετρος
 * στο σημείο κλήσης θα ήταν χειρότερη από τον κλώνο.
 */
async function setFilesArchived(fileIds: string[], action: FileArchiveDirection): Promise<FileBatchActResponse> {
  const response = await apiClient.post<FileBatchActResponse>(API_ROUTES.FILES.ARCHIVE, { fileIds, action });
  const lifecycleState = action === 'archive' ? FILE_LIFECYCLE_STATES.ARCHIVED : FILE_LIFECYCLE_STATES.ACTIVE;
  await announceFileBatchAct(fileIds, response, { lifecycleState });
  return response;
}

export async function archiveFilesWithPolicy(fileIds: string[]): Promise<FileBatchActResponse> {
  return setFilesArchived(fileIds, 'archive');
}

export async function unarchiveFilesWithPolicy(fileIds: string[]): Promise<FileBatchActResponse> {
  return setFilesArchived(fileIds, 'unarchive');
}

/**
 * **Ζήτα διαβάθμιση για μια δέσμη αρχείων** — ο διακομιστής κρίνει, γράφει, καταγράφει και ξαναπροβάλλει την αγγελία
 * στο ίδιο αίτημα (ADR-845 §7.17).
 *
 * 🔴 Ως τις 2026-10-08 αυτό ήταν `updateDoc({ classification })` από τον browser: η δημόσια αγγελία δεν το μάθαινε
 * ποτέ, και αρχείο που έγινε `internal` έμενε στο κοινό. ⛔ **ΜΗΝ το ξαναγράψεις με client SDK** — οι κανόνες
 * παγώνουν το πεδίο (ADR-862 Φ0, ίδιο ιδίωμα με το `cdeState`).
 *
 * 🧹 ADR-866 §2.6.8 Β11 — η δημοσιοποίηση είναι πράξη ΓΡΑΦΕΙΟΥ: μόνο εταιρικό διαμέρισμα, και το UI την κρύβει για
 * προσωπικό κάτοχο.
 */
export async function setFilesClassificationWithPolicy(
  fileIds: readonly string[],
  classification: FileClassification,
): Promise<FileBatchActResponse> {
  const response = await apiClient.post<FileBatchActResponse>(API_ROUTES.FILES.CLASSIFICATION, { fileIds, classification });
  await announceFileBatchAct(fileIds, response, { classification });
  return response;
}
