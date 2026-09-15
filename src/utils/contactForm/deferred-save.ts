/**
 * @fileoverview **Η ΑΝΑΒΑΛΛΟΜΕΝΗ ΑΠΟΘΗΚΕΥΣΗ ΕΠΑΦΗΣ** — «τελείωσαν οι μεταφορτώσεις; τότε στείλε».
 * @module utils/contactForm/deferred-save
 *
 * 🔑 N.18 (CHECK 3.28): η ίδια κρίση ήταν γραμμένη **δύο φορές** — στη φόρμα δημιουργίας/επεξεργασίας
 * (`useContactSubmission`) και στη σελίδα λεπτομερειών (`useContactDetailsController`). Εδώ ζει **μία**:
 * αποτυχημένη μεταφόρτωση ⇒ ακύρωση + ειδοποίηση · όλες έτοιμες ⇒ αποστολή · αλλιώς ⇒ αναμονή.
 */

import { createModuleLogger } from '@/lib/telemetry';
import type { ContactFormData } from '@/types/ContactFormTypes';
import { validateUploadState } from '@/utils/contactForm/validators/upload-state';

const logger = createModuleLogger('ContactDeferredSave');

/** Τι απέγινε η αναβαλλόμενη αποθήκευση σε αυτόν τον έλεγχο. Ονομασμένο, ποτέ boolean. */
export type DeferredSaveVerdict = 'uploads-failed' | 'submitted' | 'waiting';

export interface DeferredSaveHandlers {
  /** Σβήνει τη σημαία «περιμένω μεταφορτώσεις». */
  readonly cancelPending: () => void;
  readonly notifyUploadsFailed: () => void;
  readonly submit: () => void;
}

export function settleDeferredSave(formData: ContactFormData, handlers: DeferredSaveHandlers): DeferredSaveVerdict {
  const uploads = validateUploadState(formData);

  if (uploads.failedUploads > 0) {
    logger.info('DEFERRED SAVE: Cancelled — failed uploads detected');
    handlers.cancelPending();
    handlers.notifyUploadsFailed();
    return 'uploads-failed';
  }

  if (!uploads.isValid) return 'waiting';

  logger.info('DEFERRED SAVE: All uploads complete — auto-submitting');
  handlers.cancelPending();
  handlers.submit();
  return 'submitted';
}
