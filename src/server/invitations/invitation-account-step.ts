import 'server-only';

/**
 * @fileoverview **ΤΟ ΒΗΜΑ ΛΟΓΑΡΙΑΣΜΟΥ ΤΗΣ ΠΡΟΣΚΛΗΣΗΣ** — «έχει ήδη λογαριασμό ο παραλήπτης;» (ADR-915 §39, 2026-11-14).
 * @related `lib/invitations/invitation-respond.ts` (ο τύπος) · `server/auth/auth-action-mail.ts` (ίδιο ιδίωμα αναζήτησης)
 * @module server/invitations/invitation-account-step
 *
 * 🔴 **Γιατί γεννήθηκε (μετρημένο ζωντανά)**: ο επαγγελματίας **χωρίς** λογαριασμό άνοιξε τον σύνδεσμο, πήγε στη
 * «Σύνδεση», πήρε «Μη έγκυρα στοιχεία» και δεν έμαθε ποτέ ότι έπρεπε να κάνει **Εγγραφή** — ούτε **με ποιο** email.
 *
 * 🔑 **Γιατί δεν είναι μαντείο απαρίθμησης**: καλείται **μόνο** αφού ο σύνδεσμος πέρασε `readInvitationByToken`
 * (υπογραφή + έγγραφο). Ο σύνδεσμος έφτασε στο **κουτί** του παραλήπτη ⇒ το «υπάρχει λογαριασμός;» για **αυτή** τη
 * διεύθυνση το μαθαίνει μόνο όποιος ήδη κρατά το κουτί. Τυχαίο email δεν μπορεί να ρωτηθεί. Η διεύθυνση επιστρέφεται
 * **μόνο καλυμμένη** (`maskEmail`).
 *
 * ⚠️ **Υπόδειξη, όχι απόφαση**: η δέσμευση παραλήπτη κρίνεται ξανά στην εξαργύρωση. Σφάλμα του Firebase ⇒ `sign-in`
 * (ασφαλής προεπιλογή — η φόρμα έχει ούτως ή άλλως «Εγγραφή»)· **ποτέ δεν πετά** — η σελίδα δεν πέφτει για μια υπόδειξη.
 */

import { isAuthUserNotFound } from '@/lib/auth/firebase-auth-errors';
import { maskEmail, normaliseChannelEmail } from '@/lib/contact/channel-email';
import { getErrorMessage } from '@/lib/error-utils';
import { getAdminAuth } from '@/lib/firebaseAdmin';
import type { InvitationAccountStep } from '@/lib/invitations/invitation-respond';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('invitation-account-step');

/** Τα domain της Google για προσωπικούς λογαριασμούς — εκεί το «Συνέχεια με Google» είναι ένα κλικ. */
const GOOGLE_MAIL_DOMAINS: readonly string[] = ['gmail.com', 'googlemail.com'];
const GOOGLE_PROVIDER_ID = 'google.com';

function isGoogleMailbox(email: string): boolean {
  return GOOGLE_MAIL_DOMAINS.includes(email.slice(email.lastIndexOf('@') + 1));
}

/**
 * Ό,τι δίνει **κάθε** αναγνώστης preview είδους με παραλήπτη (υπόθεση · χώρος · φωτογράφος · αγοραστής · προμηθευτής):
 * η υπόδειξη «απευθύνεται στον θεατή;» και το βήμα ως **κλείσιμο** — η διεύθυνση μένει στον διακομιστή.
 * ⚠️ Ο ανοιχτός σύνδεσμος αιτήματος προμήθειας (`/supply-request`) **δεν** έχει παραλήπτη, άρα ούτε βήμα.
 */
export interface InvitationAccountStepSource {
  readonly addressedToViewer: boolean | null;
  readonly accountStep: () => Promise<InvitationAccountStep>;
}

/**
 * **Χρειάζεται βήμα λογαριασμού αυτή η σελίδα;** — μόνο όταν ο θεατής **δεν** είναι (ακόμη) ο παραλήπτης: ανώνυμος ή
 * άλλος λογαριασμός. Ο παραλήπτης που είναι ήδη μέσα δεν χρειάζεται ούτε να ρωτηθεί το Firebase. `null` ⇒ δεν υπάρχει
 * όψη (άρνηση/μη διαθέσιμο). Η **μία** απάντηση για όλες τις σελίδες πρόσκλησης.
 */
export function pageAccountStepOf(source: InvitationAccountStepSource | null): Promise<InvitationAccountStep | undefined> {
  if (source === null || source.addressedToViewer === true) return Promise.resolve(undefined);
  return source.accountStep();
}

/** **Το βήμα για τη διεύθυνση του παραλήπτη.** Καλείται μόνο για έγκυρο σύνδεσμο (δες την κεφαλίδα). */
export async function invitationAccountStepOf(inviteeEmail: string): Promise<InvitationAccountStep> {
  const email = normaliseChannelEmail(inviteeEmail);
  const maskedEmail = maskEmail(email);
  try {
    const account = await getAdminAuth().getUserByEmail(email);
    const viaGoogle = account.providerData.some((provider) => provider.providerId === GOOGLE_PROVIDER_ID);
    return { kind: 'sign-in', maskedEmail, googleSuggested: viaGoogle };
  } catch (error: unknown) {
    if (isAuthUserNotFound(error)) return { kind: 'create', maskedEmail, googleSuggested: isGoogleMailbox(email) };
    logger.warn('Δεν κρίθηκε αν υπάρχει λογαριασμός για την πρόσκληση — προεπιλογή «Σύνδεση»', { error: getErrorMessage(error) });
    return { kind: 'sign-in', maskedEmail, googleSuggested: isGoogleMailbox(email) };
  }
}
