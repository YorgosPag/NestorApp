/**
 * @fileoverview **Ο ΣΥΝΔΕΣΜΟΣ ΕΠΙΒΕΒΑΙΩΣΗΣ EMAIL ΤΗΣ ΚΑΡΤΑΣ** — μυστικό, κωδικοποίηση, αποκωδικοποίηση (ADR-841 §7 Α21.18).
 * @related lib/tokens/signed-token.ts (η γραμματική — **5ος** καταναλωτής) ·
 *   services/mandate/showcase-email-confirmation.service.ts (έκδοση) ·
 *   services/mandate/showcase-email-confirmation-decision.ts (εξαργύρωση)
 * @module services/mandate/showcase-email-confirmation-token
 *
 * 🔑 **Ένα αρχείο κρατά το μυστικό**, γιατί το χρειάζονται **δύο** πλευρές (έκδοση · απόφαση). Δύο
 * αναγνώσεις του ονόματος της μεταβλητής θα ήταν δύο σημεία όπου μπορεί να γραφτεί λάθος — και το
 * λάθος θα φαινόταν μόνο ως «κάθε σύνδεσμος άκυρος».
 *
 * ⚠️ **Δικό του μυστικό, ΠΟΤΕ κοινό** (δόγμα του `signed-token.ts`): τα πεδία ενός συνδέσμου είναι
 * απλό κείμενο και η υπογραφή δεν ξέρει σε ποια πύλη ανήκει.
 */

import 'server-only';

import {
  decodeSignedToken,
  encodeSignedToken,
  newTokenNonce,
  requireTokenSecret,
} from '@/lib/tokens/signed-token';

const SECRET_ENV = 'SHOWCASE_EMAIL_CONFIRMATION_SECRET';

/** Ό,τι κουβαλά ο σύνδεσμος — **χιλιοστά**, ποτέ ISO (το `:` χωρίζει τα πεδία, §8.33). */
export interface ConfirmationLinkFields {
  readonly id: string;
  readonly nonce: string;
}

/** Το μυστικό, ή `null` αν λείπει **από εμάς** — ο καλών το λέει ως «μη διαθέσιμο», ποτέ ως «άκυρος σύνδεσμος». */
export function confirmationSecret(): string | null {
  try {
    return requireTokenSecret(SECRET_ENV);
  } catch {
    return null;
  }
}

/** **Νέος σύνδεσμος** για ένα αίτημα — επιστρέφει και το `nonce` που θα αποθηκευτεί. */
export function newConfirmationLink(
  secret: string,
  id: string,
  expiresAtISO: string,
): { readonly token: string; readonly nonce: string } {
  const nonce = newTokenNonce();
  return { token: encodeSignedToken(secret, [id, nonce, String(Date.parse(expiresAtISO))]), nonce };
}

/**
 * **Σύνδεσμος → πεδία**, αφού αποδειχθεί η υπογραφή — ή `null`. Καμία επαφή με βάση: πλαστός
 * σύνδεσμος δεν μας κοστίζει ούτε μία ανάγνωση.
 *
 * ⚠️ Η λήξη **δεν** κρίνεται εδώ: κρίνεται πάνω στο **αποθηκευμένο** `expiresAt`, το ίδιο που βλέπει
 * η σελίδα — δύο ρολόγια για το ίδιο «έληξε;» θα μπορούσαν να διαφωνήσουν στο όριο.
 */
export function readConfirmationLink(secret: string, token: string): ConfirmationLinkFields | null {
  const verdict = decodeSignedToken(secret, token, 3);
  if (!verdict.ok || verdict.fields.length !== 3) return null;
  const [id, nonce, expiresAtMs] = verdict.fields as [string, string, string];
  return Number.isFinite(Number(expiresAtMs)) ? { id, nonce } : null;
}
