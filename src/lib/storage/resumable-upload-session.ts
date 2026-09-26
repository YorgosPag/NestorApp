/**
 * =============================================================================
 * ΣΥΝΕΔΡΙΑ ΣΥΝΕΧΙΖΟΜΕΝΟΥ ΑΝΕΒΑΣΜΑΤΟΣ — ο ΕΝΑΣ γεννήτορας (ADR-884 Φ0.8 · §4.5)
 * =============================================================================
 *
 * **Το ερώτημα**: *«Άφησε τον φυλλομετρητή να στείλει **μεγάλο** αρχείο **απευθείας** στο bucket — και να
 * **συνεχίσει** αν κοπεί το δίκτυο — χωρίς να περάσουν τα bytes από τον διακομιστή.»*
 *
 * Αδελφό του `signed-download-url.ts` (ίδια σειρά: **πρώτα κρίση, μετά υπογραφή**), για την αντίθετη κατεύθυνση.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🌐 Η ΠΡΑΚΤΙΚΗ ΤΗΣ ΑΓΟΡΑΣ
 * ─────────────────────────────────────────────────────────────────────────────
 * Google Cloud: για αρχεία δεκάδων MB προτείνει **resumable upload** — ο διακομιστής ανοίγει τη συνεδρία, ο
 * πελάτης στέλνει τμήματα με `PUT` στο URI της και, μετά από διακοπή, ρωτά `Content-Range: bytes *\/N` για να
 * μάθει **πού έμεινε** (`308` + `Range`). Ένα απλό υπογεγραμμένο `PUT` θα ξανάστελνε **ολόκληρο** το πανόραμα
 * σε κάθε διακοπή — σε εργοτάξιο με κινητό δίκτυο, δηλαδή ποτέ.
 *
 * 🔑 **Τρεις φράχτες, κανένας στον πελάτη:**
 * 1. **Μέγεθος**: το δηλωμένο μήκος ταξιδεύει ως `X-Upload-Content-Length` ⇒ το GCS **αρνείται** κάθε byte πέρα
 *    από τη δήλωση. Ο καλών κρίνει τη δήλωση **πριν** ανοίξει συνεδρία.
 * 2. **Κανένα σκέπασμα**: `ifGenerationMatch: 0` ⇒ η συνεδρία γράφει **μόνο** αν το αντικείμενο **δεν** υπάρχει.
 * 3. **Origin**: η συνεδρία δένεται στο origin της εφαρμογής (CORS του bucket, ADR-351).
 *
 * ⛔ Το URI της συνεδρίας **είναι μυστικό** (όποιος το έχει, γράφει): **ποτέ** σε log, όπως το υπογεγραμμένο URL.
 * ⚠️ Η συνεδρία **δεν** κρίνει περιεχόμενο — γράφει σε **καραντίνα**, και το περιεχόμενο το κρίνει η ολοκλήρωση.
 *
 * @module lib/storage/resumable-upload-session
 * @see lib/storage/signed-download-url — ο αδελφός της ανάγνωσης
 */

import 'server-only';

import { getAdminBucket } from '@/lib/firebaseAdmin';

export interface ResumableUploadRequest {
  /** Το object name **στην καραντίνα** — το φτιάχνει ο διακομιστής, ποτέ ο πελάτης. */
  readonly storagePath: string;
  /** Ο δηλωμένος τύπος — δεσμεύεται στο αντικείμενο· η ολοκλήρωση τον ξανακρίνει από τα **bytes**. */
  readonly contentType: string;
  /** Το δηλωμένο μέγεθος σε bytes — το GCS δεν δέχεται ούτε ένα παραπάνω. Το ταβάνι το κρίνει ο καλών. */
  readonly contentLength: number;
  /** Το origin του φυλλομετρητή που θα στείλει — πρέπει να είναι στη λίστα CORS του bucket. */
  readonly origin: string;
}

export type ResumableUploadOutcome =
  | { readonly outcome: 'opened'; readonly sessionUri: string }
  | { readonly outcome: 'rejected'; readonly why: 'path-missing' | 'length-not-positive' | 'origin-missing' };

/** **Άνοιξε συνεδρία συνεχιζόμενου ανεβάσματος** — ΜΟΝΟ αφού ο φρουρός έχει πει «ναι». */
export async function openResumableUploadSession(request: ResumableUploadRequest): Promise<ResumableUploadOutcome> {
  const storagePath = request.storagePath.trim();
  if (storagePath.length === 0) return { outcome: 'rejected', why: 'path-missing' };
  if (!Number.isSafeInteger(request.contentLength) || request.contentLength <= 0) {
    return { outcome: 'rejected', why: 'length-not-positive' };
  }
  if (request.origin.trim().length === 0) return { outcome: 'rejected', why: 'origin-missing' };

  const [sessionUri] = await getAdminBucket()
    .file(storagePath)
    .createResumableUpload({
      origin: request.origin,
      metadata: { contentType: request.contentType, contentLength: request.contentLength },
      preconditionOpts: { ifGenerationMatch: 0 },
    });
  // ⛔ Το `sessionUri` **δεν** καταγράφεται — είναι κλειδί εγγραφής.
  return { outcome: 'opened', sessionUri };
}
