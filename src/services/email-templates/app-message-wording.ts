/**
 * @fileoverview **ΤΑ ΛΟΓΙΑ ΕΝΟΣ ΜΗΝΥΜΑΤΟΣ ΤΗΣ ΕΦΑΡΜΟΓΗΣ** — τύπος + έλεγχος πληρότητας (ADR-851).
 * @module services/email-templates/app-message-wording
 *
 * ⚠️ **Καθαρό, ΧΩΡΙΣ `server-only`** — επίτηδες: το φορτώνουν οι πίνακες κειμένων
 * (`auth-action-email-texts.ts` · `workspace-access-decision-email.ts`), που τους διαβάζουν
 * και καθαρές άγκυρες. Το HTML ζει στο `app-message-email.ts`, που **είναι** διακομιστή.
 */

/** Τα λόγια ενός μηνύματος της εφαρμογής, σε **μία** γλώσσα. */
export interface AppMessageWording {
  readonly subject: string;
  readonly heading: string;
  /** Το κύριο μήνυμα. Το όρισμα είναι **ήδη** ασφαλές HTML (ή placeholder της Firebase). */
  readonly intro: (addressHtml: string) => string;
  /** Το κουμπί — **περιγράφει την πράξη** (WebAIM), ποτέ «πατήστε εδώ». */
  readonly cta: string;
  readonly footnote: string;
}

/**
 * **Έχει αυτό το μήνυμα ΟΛΑ τα λόγια του;** — για άγκυρες που **εκτελούνται** (N.17: ο
 * μεταγλωττιστής δεν είναι φρουρός στη ροή του πράκτορα). Ένα email με κουμπί χωρίς
 * ετικέτα είναι χειρότερο από email χωρίς κουμπί.
 */
export function isCompleteWording(wording: AppMessageWording | undefined): boolean {
  return [wording?.subject, wording?.heading, wording?.cta, wording?.footnote, wording?.intro('x')]
    .every((text) => typeof text === 'string' && text.length > 0);
}
