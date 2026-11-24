import { useCallback, useEffect, useState } from 'react';
import type { Contact } from '@/types/contacts';
import type { ContactFormData } from '@/types/ContactFormTypes';
import { ContactsService } from '@/services/contacts.service';
import { useContactNotifications } from '@/hooks/notifications/useContactNotifications';
import { validateContactField } from '@/utils/contactForm/contact-validation';
import type { SettledGuardOutcome } from '@/hooks/impact-guard/guard-result';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('ContactDetails');

/** «Καταχώριση»: η νέα εικόνα της φόρμας (για τους φρουρούς) και **μόνο** ό,τι άλλαξε (για την εγγραφή). */
export type RegisterFormData = (next: ContactFormData, changes: Partial<ContactFormData>) => Promise<void>;

interface UseEvidenceRegisterParams {
  contact: Contact | null | undefined;
  isEditing: boolean;
  /** Ο ΕΝΑΣ φραγμός «μία αποθήκευση τη φορά» της καρτέλας (ADR-332 D27 Ζ5) — κοινός με την «Αποθήκευση». */
  runSave: (action: () => Promise<void>) => Promise<void>;
  runExistingContactPartialFormUpdate: (
    mergedData: ContactFormData,
    dirtyData: Partial<ContactFormData>,
    label: string,
    action?: () => Promise<void>,
  ) => Promise<SettledGuardOutcome>;
  onContactUpdated?: () => void;
}

interface UseEvidenceRegisterResult {
  /** Ό,τι καταχωρίστηκε και ο δίσκος δεν έχει δείξει ακόμη — η προβολή το διαβάζει **πάνω** από την επαφή. */
  registeredChanges: Partial<ContactFormData> | null;
  /** `undefined` σε επεξεργασία: εκεί η τιμή μπαίνει στη φόρμα («Αποδοχή») και γράφεται με την «Αποθήκευση». */
  handleRegister: RegisterFormData | undefined;
}

/**
 * **«ΚΑΤΑΧΩΡΙΣΗ» ΜΕ ΕΝΑ ΠΑΤΗΜΑ, ΑΠΟ ΤΗΝ ΠΡΟΒΟΛΗ** (ADR-950 §9).
 *
 * 🔑 **Κανένας δεύτερος δρόμος εγγραφής**: η ίδια φυλαγμένη ενημέρωση με την «Αποθήκευση» και τον διακόπτη ιδιότητας
 *    (`runExistingContactPartialFormUpdate` — 4 φρουροί ADR-249/277/278/280 + φύλακας ταυτότητας + Ιστορικό ADR-195).
 *    Φρουρός που ανοίγει διάλογο ⇒ η καταχώριση ολοκληρώνεται με την επιβεβαίωση του ανθρώπου (η πράξη φέρει μόνη της
 *    ό,τι ακολουθεί την εγγραφή).
 * 🔑 **Έλεγχος εγκυρότητας μόνο για ό,τι γράφεται** (απόφαση Giorgio 2026-11-24): ένα άσχετο παλιό κενό της επαφής δεν
 *    μπλοκάρει την καταχώριση ενός ελεγμένου πεδίου — ίδια συμπεριφορά με τον διακόπτη ιδιότητας.
 * 🔑 **Καμία αισιόδοξη εικόνα πριν από την εγγραφή**: η τιμή φαίνεται ως «της επαφής» **αφού** γραφτεί· μένει ορατή
 *    μέχρι να φέρει ο δίσκος τη νέα επαφή, ώστε η γραμμή να μη ξαναγίνει «Λείπει» (και να μη ξαναπατηθεί).
 */
export function useEvidenceRegister({
  contact,
  isEditing,
  runSave,
  runExistingContactPartialFormUpdate,
  onContactUpdated,
}: UseEvidenceRegisterParams): UseEvidenceRegisterResult {
  const contactNotifications = useContactNotifications();
  const [registeredChanges, setRegisteredChanges] = useState<Partial<ContactFormData> | null>(null);

  // Ο δίσκος έφερε νέα εικόνα της επαφής (ή άλλαξε η επαφή) ⇒ εκείνη είναι πλέον η αλήθεια.
  useEffect(() => {
    setRegisteredChanges(null);
  }, [contact]);

  const register = useCallback(async (next: ContactFormData, changes: Partial<ContactFormData>): Promise<void> => {
    const fields = Object.keys(changes);
    if (!contact?.id || fields.length === 0) return;

    const firstErrorKey = fields.map((field) => validateContactField(next, field)).find((key) => key !== undefined);
    if (firstErrorKey !== undefined) {
      contactNotifications.validationReviewFieldsWithHint(firstErrorKey);
      return;
    }

    try {
      await runExistingContactPartialFormUpdate(next, changes, 'EVIDENCE REGISTER', async () => {
        await ContactsService.updateExistingContactFromForm(contact, changes);
        setRegisteredChanges((previous) => ({ ...previous, ...changes }));
        logger.info('Document evidence registered on contact', { contactId: contact.id, fields });
        contactNotifications.updateSuccess();
        onContactUpdated?.();
      });
    } catch (error) {
      logger.error('Failed to register document evidence', error instanceof Error ? error : { error });
      contactNotifications.updateError();
    }
  }, [contact, contactNotifications, onContactUpdated, runExistingContactPartialFormUpdate]);

  const handleRegister = useCallback<RegisterFormData>(
    (next, changes) => runSave(() => register(next, changes)),
    [register, runSave],
  );

  return { registeredChanges, handleRegister: isEditing ? undefined : handleRegister };
}
