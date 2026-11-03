import { ApiClientError } from '@/lib/api/api-client-types';

/**
 * Μια άρνηση του server που η φόρμα ξέρει να ονομάσει, στη γλώσσα του χρήστη (ADR-923 §5.11 «3γ»).
 *
 * Ο server στέλνει σταθερό `errorCode` και το μήνυμά του μένει για το log: χωρίς αυτή τη μετάφραση ο
 * χρήστης θα έβλεπε το αγγλικό κείμενο του server μέσα στη φόρμα. Ό,τι δεν έχει κωδικό εδώ περνά
 * αυτούσιο, και το δείχνει ο `useFormSubmission` όπως πριν.
 *
 * @param messages κωδικός → **ήδη μεταφρασμένο** μήνυμα
 */
export async function explainProcurementError<T>(
  save: () => Promise<T>,
  messages: Readonly<Record<string, string>>,
): Promise<T> {
  try {
    return await save();
  } catch (caught) {
    const explained = caught instanceof ApiClientError && caught.errorCode ? messages[caught.errorCode] : undefined;
    if (explained) throw new Error(explained);
    throw caught;
  }
}
