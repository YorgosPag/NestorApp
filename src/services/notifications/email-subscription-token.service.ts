/**
 * =============================================================================
 * ΤΟ ΕΙΣΙΤΗΡΙΟ ΤΗΣ ΔΙΑΓΡΑΦΗΣ ΑΠΟ ΤΑ EMAIL — ADR-848 (RFC 8058)
 * =============================================================================
 *
 * Υπογεγραμμένο HMAC πάνω στο **SSoT** `lib/tokens/signed-token.ts` — κανένα
 * τέταρτο αντίγραφο κρυπτογραφίας.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΤΡΕΙΣ ΑΠΟΦΑΣΕΙΣ, ΚΑΙ ΚΑΘΕ ΜΙΑ ΜΕ ΛΟΓΟ
 * ────────────────────────────────────────────────────────────────────────────
 * 1. **Δικό του μυστικό** (`NOTIFICATION_EMAIL_SECRET`). Κοινό μυστικό με τη
 *    συγκατάθεση εντολής θα σήμαινε ότι ένα token με τα σωστά πεδία περνά για
 *    **άλλη** πύλη — η υπογραφή δεν ξέρει «σε ποια πύλη» ανήκει.
 * 2. **Χωρίς λήξη.** Μια διαγραφή που αποτυγχάνει επειδή το email είναι τριών
 *    μηνών είναι **χειρότερη** από ένα παλιό token: ο άνθρωπος συνεχίζει να παίρνει
 *    email που ζήτησε να σταματήσουν, και η Google μετρά την αναφορά του ως spam.
 *    Η ζημιά ενός διαρρεύσαντος token είναι «κάποιος μου έκλεισε τα email» — ορατή
 *    στις ρυθμίσεις και αναστρέψιμη με ένα κλικ.
 * 3. **Το πεδίο «σκοπός» μέσα στην υπογραφή** (`email-sub`). Αν αύριο το ίδιο
 *    μυστικό υπογράψει και άλλη πράξη, ένα token διαγραφής δεν θα περνά γι' αυτήν.
 *
 * ⚠️ **Χωρίς μυστικό ΔΕΝ πετά στην έκδοση** — επιστρέφει `null`, και το email φεύγει
 * χωρίς σύνδεσμο διαγραφής. Ένα email ειδοποίησης που **δεν φεύγει** επειδή λείπει
 * μεταβλητή περιβάλλοντος θα ήταν δυσανάλογη τιμωρία (βαθμίδα `feature` του
 * `environment-contract.ts`, όχι `fatal`).
 *
 * @module services/notifications/email-subscription-token
 */

import 'server-only';

import { createModuleLogger } from '@/lib/telemetry';
import { decodeSignedToken, encodeSignedToken, requireTokenSecret } from '@/lib/tokens/signed-token';

const logger = createModuleLogger('EmailSubscriptionToken');

/** Το μυστικό — **δικό του**, ποτέ κοινό (βλ. κεφαλίδα, απόφαση 1). */
export const EMAIL_SUBSCRIPTION_SECRET_ENV = 'NOTIFICATION_EMAIL_SECRET';

/** Ο σκοπός και η έκδοση του σχήματος — **μέσα** στην υπογραφή. */
const PURPOSE = 'email-sub';
const SCHEMA_VERSION = 'v1';

/** Γιατί δεν δεχτήκαμε το token. `server-config` = λείπει το μυστικό **από εμάς**. */
export type SubscriptionTokenRejection = 'invalid' | 'server-config';

export type SubscriptionTokenVerdict =
  | { readonly ok: true; readonly uid: string }
  | { readonly ok: false; readonly reason: SubscriptionTokenRejection };

/** Μία προειδοποίηση ανά διεργασία — ο αγωγός τρέχει κάθε 5′ και θα γέμιζε τα ίχνη. */
let warnedMissingSecret = false;

/** Το μυστικό, ή `null` — χωρίς να πετά στον δρόμο της **έκδοσης**. */
function secretOrNull(): string | null {
  try {
    return requireTokenSecret(EMAIL_SUBSCRIPTION_SECRET_ENV);
  } catch {
    if (!warnedMissingSecret) {
      warnedMissingSecret = true;
      logger.warn(
        `${EMAIL_SUBSCRIPTION_SECRET_ENV} λείπει — τα email φεύγουν ΧΩΡΙΣ σύνδεσμο διαγραφής (RFC 8058)`,
      );
    }
    return null;
  }
}

/**
 * **Νέο εισιτήριο διαγραφής** για τον χρήστη — ή `null` αν δεν μπορεί να εκδοθεί.
 *
 * `null` και όταν η ταυτότητα περιέχει `:` (το `encodeSignedToken` αρνείται): ένα
 * token που δεν μπορεί να υπογραφεί σωστά δεν εκδίδεται **καθόλου**.
 */
export function issueEmailSubscriptionToken(uid: string): string | null {
  const secret = secretOrNull();
  if (secret === null || uid.length === 0) return null;
  try {
    return encodeSignedToken(secret, [PURPOSE, SCHEMA_VERSION, uid]);
  } catch {
    logger.error('Αδύνατη η υπογραφή εισιτηρίου διαγραφής', { data: { uid } });
    return null;
  }
}

/**
 * **Εισιτήριο → χρήστης**, αφού αποδειχθεί η υπογραφή. **Καμία επαφή με βάση.**
 *
 * ⚠️ Όλες οι αρνήσεις εκτός του `server-config` γίνονται **ένα** `invalid`: ο
 * άνθρωπος απέναντι δεν χρειάζεται να μάθει *γιατί* ένα token είναι πλαστό, και ο
 * επιτιθέμενος δεν πρέπει να μάθει *πόσο κοντά* έφτασε.
 */
export function readEmailSubscriptionToken(token: string): SubscriptionTokenVerdict {
  let secret: string;
  try {
    secret = requireTokenSecret(EMAIL_SUBSCRIPTION_SECRET_ENV);
  } catch {
    return { ok: false, reason: 'server-config' };
  }

  const verdict = decodeSignedToken(secret, token, 3);
  if (!verdict.ok) {
    return { ok: false, reason: verdict.reason === 'server-config' ? 'server-config' : 'invalid' };
  }

  const [purpose, version, uid] = verdict.fields;
  if (purpose !== PURPOSE || version !== SCHEMA_VERSION || !uid || verdict.fields.length !== 3) {
    return { ok: false, reason: 'invalid' };
  }
  return { ok: true, uid };
}
