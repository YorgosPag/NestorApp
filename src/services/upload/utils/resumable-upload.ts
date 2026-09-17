/**
 * **ΤΟ ΕΝΑ resumable ανέβασμα bytes → URL λήψης** (Firebase Storage `uploadBytesResumable`).
 *
 * 🧹 **Εξήχθη με μέτρηση (CHECK 3.28, ADR-866 §2.6.8)**: το ίδιο σώμα «task → `state_changed` →
 * σφάλμα ⇒ reject → ολοκλήρωση ⇒ `getDownloadURL`» ζούσε **τρεις** φορές — ιδιωτικό στο
 * `upload-orchestrator-gateway`, και δίδυμο στο `photo-upload.service` και στο `PDFProcessor`.
 * Φάνηκε όταν η οριστικοποίηση απέκτησε υποχρεωτικό διαμέρισμα και άγγιξε και τα τρία.
 *
 * 🔑 Ο βοηθός **δεν** ξέρει τίποτα για φάσεις/ποσοστά οθόνης: δίνει την **ακατέργαστη** πρόοδο και
 * κάθε καλών τη μεταφράζει στη δική του κλίμακα (10-80% · 10-90% · 0-95%).
 *
 * @module services/upload/utils/resumable-upload
 */

import { getDownloadURL, uploadBytesResumable, type StorageReference } from 'firebase/storage';

/** Ακατέργαστη πρόοδος ανεβάσματος. */
export interface ResumableUploadProgress {
  readonly bytesTransferred: number;
  readonly totalBytes: number;
  /** 0-100 — `bytesTransferred / totalBytes`. */
  readonly percent: number;
}

/** Ανεβάζει τα bytes και επιστρέφει το URL λήψης· απορρίπτει σε σφάλμα ανεβάσματος ή URL. */
export function uploadResumableToUrl(
  storageRef: StorageReference,
  data: Blob | File,
  onProgress?: (progress: ResumableUploadProgress) => void,
): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const uploadTask = uploadBytesResumable(storageRef, data);

    uploadTask.on(
      'state_changed',
      (snapshot) => {
        onProgress?.({
          bytesTransferred: snapshot.bytesTransferred,
          totalBytes: snapshot.totalBytes,
          percent: (snapshot.bytesTransferred / snapshot.totalBytes) * 100,
        });
      },
      (error) => reject(error),
      async () => {
        try {
          resolve(await getDownloadURL(uploadTask.snapshot.ref));
        } catch (error) {
          reject(error);
        }
      },
    );
  });
}
