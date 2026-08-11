'use client';

/**
 * @fileoverview **«Ό,ΤΙ ΕΧΕΙ»** — το ανέβασμα των αρχείων του ιδιοκτήτη (Α14).
 * @related ADR-777 §7 (Α14 · Α19 κανόνας 31) · storage.rules · types/owner-property.ts
 * @module hooks/owner-property/useOwnerPropertyMedia
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΟΧΙ ΤΟ `useEnterpriseFileUpload` — **ΜΕΤΡΗΘΗΚΕ, ΔΕΝ ΠΡΟΤΙΜΗΘΗΚΕ**
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο υπάρχων αγωγός είναι ο σωστός για **τον επαγγελματία**, και είναι **δομικά
 * αδύνατος** για τον ιδιώτη. Δεν είναι γνώμη — ο ίδιος ο κώδικας το πετά:
 *
 *   > *«Upload requires canonical fields (**companyId**, entityId, createdBy).
 *   > **Legacy upload pipeline has been removed** (ADR-293).»*
 *   > — `PhotoUploadService`, γρ. 139
 *
 * Και κάθε canonical διαδρομή του `storage.rules` ξεκινά με `/companies/{companyId}/…`
 * με έλεγχο `belongsToCompany(companyId)`. **Ο ιδιώτης της Α14 δεν έχει εταιρεία** —
 * δηλαδή δεν υπάρχει τιμή να βάλει στο πρώτο τμήμα της διαδρομής, ούτε `FileRecord`
 * να γεννηθεί μέσα σε μισθωτή που δεν υπάρχει.
 *
 * 🔑 **Άρα ΔΕΝ γράφτηκε δεύτερος αγωγός — γράφτηκε ΑΛΛΟ ΣΥΝΟΡΟ.** Ό,τι είναι
 * **ανεξάρτητο μισθωτή** επαναχρησιμοποιείται αυτούσιο: η **επικύρωση**
 * ({@link validateFile}, με το ίδιο `FILE_TYPE_CONFIG`) και η **αποθήκευση**
 * (`firebase/storage`). Ό,τι διαφέρει είναι **η διαδρομή** και **ο ιδιοκτήτης της** —
 * δηλαδή ακριβώς αυτό που το `owner_properties/{userId}/{ownerPropertyId}/` δηλώνει.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ⛔ ΤΑ ΑΡΧΕΙΑ **ΔΕΝ** ΓΙΝΟΝΤΑΙ ΠΟΤΕ `coverImage` — ΚΑΝΟΝΑΣ 31 (Α19)
 * ────────────────────────────────────────────────────────────────────────────
 *
 * *«Ο πρώτος καρές παράγεται **ΑΠΟ ΤΟ ΜΟΝΤΕΛΟ**, ποτέ από ανέβασμα χρήστη — αλλιώς
 * **μπορεί να πει ψέματα** (κανόνας 18)· και είναι **αμετάβλητος**, γιατί η ταυτότητα
 * του κτιρίου είναι σταθερή (Α11).»*
 *
 * Άρα η ανάγνωση στο Storage είναι **μόνο του κατόχου**, και το `PublicListing`
 * κρατά `coverImage: null`. Τα αρχεία υπηρετούν τη **δική του** οθόνη, την **είσοδο**
 * του μελλοντικού παραγωγού της Α19 και το **τεκμήριο** της Α17.
 */

import { useCallback, useState } from 'react';
import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';

import { storage } from '@/lib/firebase';
import { nowISO } from '@/lib/date-local';
import { createModuleLogger } from '@/lib/telemetry';
import { validateFile } from '@/utils/file-validation';
import type { OwnerPropertyMedia } from '@/types/owner-property';

const logger = createModuleLogger('useOwnerPropertyMedia');

/**
 * Η ρίζα των αρχείων του ιδιοκτήτη — **γραμμένη μία φορά**, ίδια με τον κανόνα.
 *
 * ⚠️ Το `{userId}` μπαίνει **πριν** το `{ownerPropertyId}` ώστε ο κανόνας να απαντά
 * *«ποιανού είναι;»* **χωρίς καμία ανάγνωση Firestore** — ακριβώς οι cross-service
 * helpers που αφαιρέθηκαν από το `storage.rules` το 2026-07-26 για latency.
 */
export function ownerPropertyMediaPath(
  ownerUserId: string,
  ownerPropertyId: string,
  fileName: string,
): string {
  return `owner_properties/${ownerUserId}/${ownerPropertyId}/${fileName}`;
}

/**
 * Τι έγινε με **ένα** αρχείο. Ρητές καταστάσεις, ποτέ `boolean` + `string`.
 *
 * 🔑 **Το `rejected` είναι ΞΕΧΩΡΙΣΤΟ από το `failed`**: το πρώτο σημαίνει *«αυτό το
 * αρχείο δεν το δεχόμαστε»* (μέγεθος/τύπος) — ο άνθρωπος πρέπει να **διαλέξει άλλο**·
 * το δεύτερο *«δεν φτάσαμε»* — πρέπει να **ξαναδοκιμάσει το ίδιο**. Ένα κοινό μήνυμα
 * θα τον έστελνε να ψάξει λάθος πράγμα.
 */
export type MediaUploadState =
  | { readonly state: 'idle' }
  | { readonly state: 'uploading'; readonly fileName: string; readonly percent: number }
  | { readonly state: 'rejected'; readonly fileName: string; readonly reason: string }
  | { readonly state: 'failed'; readonly fileName: string; readonly message: string };

export interface OwnerPropertyMediaActions {
  readonly state: MediaUploadState;
  /** Ανεβάζει **ένα** αρχείο· επιστρέφει την εγγραφή του, ή `null` σε αστοχία. */
  readonly upload: (file: File) => Promise<OwnerPropertyMedia | null>;
  readonly clear: () => void;
}

/**
 * **Το ανέβασμα, δεμένο σε συγκεκριμένη αγγελία και κάτοχο.**
 *
 * ⚠️ **Η ταυτότητα της αγγελίας απαιτείται ΠΡΙΝ υπάρξει το έγγραφο** — γι' αυτό τη
 * γεννά ο πελάτης (`newOwnerPropertyId()`), μία φορά, όταν ανοίγει η φόρμα. Μια
 * ταυτότητα που αλλάζει σε κάθε απόδοση θα σκόρπιζε τα αρχεία σε φακέλους που κανείς
 * δεν θα ξαναβρεί.
 *
 * ⚠️ **`fileType: 'any'` με ρητό όριο μεγέθους**, και είναι απόφαση: ο ιδιοκτήτης
 * ανεβάζει *«φωτογραφίες, κατόψεις, **ό,τι έχει**»* — δηλαδή εικόνες **και** PDF.
 * Ένας κατάλογος MIME εδώ θα ήταν **τέταρτη** λίστα δίπλα στο `FILE_TYPE_CONFIG`, στο
 * `isAllowedContentType()` του Storage και στο `accept` του `<input>`. Ο **κανόνας
 * του Storage** μένει η αυθεντία για το τι προσγειώνεται.
 */
export function useOwnerPropertyMedia(
  ownerUserId: string | null,
  ownerPropertyId: string,
): OwnerPropertyMediaActions {
  const [state, setState] = useState<MediaUploadState>({ state: 'idle' });

  const clear = useCallback(() => setState({ state: 'idle' }), []);

  const upload = useCallback(
    async (file: File): Promise<OwnerPropertyMedia | null> => {
      if (ownerUserId === null) {
        setState({ state: 'failed', fileName: file.name, message: 'NO_IDENTITY' });
        return null;
      }

      // 🔑 Η **υπάρχουσα** επικύρωση, με το **υπάρχον** `FILE_TYPE_CONFIG` — καμία
      // δεύτερη μηχανή ορίων.
      const verdict = validateFile(file, { fileType: 'any', maxSize: MAX_MEDIA_BYTES });
      if (!verdict.isValid) {
        setState({
          state: 'rejected',
          fileName: file.name,
          reason: verdict.error ?? 'INVALID_FILE',
        });
        return null;
      }

      const storagePath = ownerPropertyMediaPath(
        ownerUserId,
        ownerPropertyId,
        safeFileName(file.name),
      );

      setState({ state: 'uploading', fileName: file.name, percent: 0 });

      try {
        const task = uploadBytesResumable(ref(storage, storagePath), file, {
          contentType: file.type,
        });

        await new Promise<void>((resolve, reject) => {
          task.on(
            'state_changed',
            (snapshot) => {
              const percent =
                snapshot.totalBytes === 0
                  ? 0
                  : Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
              setState({ state: 'uploading', fileName: file.name, percent });
            },
            reject,
            resolve,
          );
        });

        // ⚠️ Ζητείται ρητά ώστε μια αποτυχία **δικαιωμάτων ανάγνωσης** να φανεί
        // **τώρα** και όχι όταν ο άνθρωπος πάει να δει το αρχείο του αύριο.
        await getDownloadURL(task.snapshot.ref);

        setState({ state: 'idle' });
        return {
          storagePath,
          fileName: file.name,
          sizeBytes: file.size,
          uploadedAt: nowISO(),
        };
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : String(cause);
        logger.error('Το αρχείο δεν ανέβηκε', {
          data: { ownerPropertyId, storagePath },
          error: message,
        });
        setState({ state: 'failed', fileName: file.name, message });
        return null;
      }
    },
    [ownerUserId, ownerPropertyId],
  );

  return { state, upload, clear };
}

/**
 * Το ανώτατο μέγεθος ανά αρχείο.
 *
 * ⚠️ **Κάτω από το όριο του Storage (50 MB)**, και επίτηδες: ο κανόνας είναι ο
 * τελευταίος φρουρός, όχι ο πρώτος. Ένα αρχείο που περνά εδώ και κόβεται εκεί θα
 * ανέβαινε **ολόκληρο** πριν απορριφθεί — ο άνθρωπος θα έβλεπε 100% και μετά σφάλμα.
 */
const MAX_MEDIA_BYTES = 20 * 1024 * 1024;

/**
 * Καθαρίζει το όνομα αρχείου για διαδρομή αποθήκευσης.
 *
 * ⚠️ **Το `/` είναι ο διαχωριστής της διαδρομής**: ένα όνομα αρχείου που το περιέχει
 * θα δημιουργούσε **υποφάκελο**, δηλαδή διαδρομή με **τέσσερα** τμήματα — και ο
 * κανόνας `match /owner_properties/{userId}/{ownerPropertyId}/{fileName}` **δεν
 * ταιριάζει** σε τέσσερα ⇒ το ανέβασμα θα αποτύγχανε με «άρνηση δικαιωμάτων», για
 * λόγο που δεν έχει καμία σχέση με δικαιώματα.
 *
 * ⚠️ **Και προσθέτει χρονική σφραγίδα**: δύο «katopsi.pdf» της ίδιας αγγελίας είναι
 * **δύο αρχεία** του ανθρώπου, όχι ένα διορθωμένο. Χωρίς αυτό, το δεύτερο θα
 * αντικαθιστούσε το πρώτο **σιωπηλά**.
 */
function safeFileName(original: string): string {
  const cleaned = original.replace(/[/\\#?]/g, '-').trim();
  // ⚠️ Η σφραγίδα από το **SSoT** `nowISO()` (CHECK 3.7 `date-local`), όχι από ωμό
  // `Date.now()`: μία αρχή χρόνου σε όλο το έργο, ακόμη κι όταν καταλήγει σε όνομα
  // αρχείου. Τα `:` και `.` του ISO δεν είναι έγκυρα σε κάθε σύστημα αρχείων που θα
  // κατεβάσει ο άνθρωπος, οπότε γίνονται `-`.
  const stamp = nowISO().replace(/[:.]/g, '-');
  return `${stamp}-${cleaned === '' ? 'file' : cleaned}`;
}
