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

import {
  ALL_EMAILS,
  parseScopeField,
  scopeField,
  type EmailSubscriptionScope,
} from '@/lib/notifications/email-subscription-scope';
import { createModuleLogger } from '@/lib/telemetry';
import { decodeSignedToken, encodeSignedToken, requireTokenSecret } from '@/lib/tokens/signed-token';

const logger = createModuleLogger('EmailSubscriptionToken');

/** Το μυστικό — **δικό του**, ποτέ κοινό (βλ. κεφαλίδα, απόφαση 1). */
export const EMAIL_SUBSCRIPTION_SECRET_ENV = 'NOTIFICATION_EMAIL_SECRET';

/** Ο σκοπός και η έκδοση του σχήματος — **μέσα** στην υπογραφή. */
const PURPOSE = 'email-sub';
/** ADR-848 — `[σκοπός, v1, uid]`. Γίνεται δεκτό **για πάντα**, ως εμβέλεια «όλα». */
const SCHEMA_V1 = 'v1';
/**
 * ADR-849 Α2 — `[σκοπός, v2, uid, εμβέλεια]`. 🔑 Η εμβέλεια είναι **μέσα στην υπογραφή**:
 * ένα token «μόνο ταιριάσματα» δεν γίνεται «όλα» αλλάζοντας ένα πεδίο — θα έσπαγε η υπογραφή.
 */
const SCHEMA_V2 = 'v2';

/** Γιατί δεν δεχτήκαμε το token. `server-config` = λείπει το μυστικό **από εμάς**. */
export type SubscriptionTokenRejection = 'invalid' | 'server-config';

export type SubscriptionTokenVerdict =
  | { readonly ok: true; readonly uid: string; readonly scope: EmailSubscriptionScope }
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
export function issueEmailSubscriptionToken(
  uid: string,
  scope: EmailSubscriptionScope = ALL_EMAILS,
): string | null {
  const secret = secretOrNull();
  if (secret === null || uid.length === 0) return null;
  try {
    return encodeSignedToken(secret, [PURPOSE, SCHEMA_V2, uid, scopeField(scope)]);
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

  const [purpose, version, uid, field] = verdict.fields;
  if (purpose !== PURPOSE || !uid) return { ok: false, reason: 'invalid' };

  // ADR-848 — παλιό email: η διαγραφή του πρέπει να δουλεύει όσο ζει το email (χωρίς λήξη).
  if (version === SCHEMA_V1 && verdict.fields.length === 3) {
    return { ok: true, uid, scope: ALL_EMAILS };
  }

  // ADR-849 — άγνωστος ή υποχρεωτικός τύπος στην εμβέλεια ⇒ άκυρο, ποτέ «όλα» κατά μαντεψιά.
  const scope = version === SCHEMA_V2 && verdict.fields.length === 4 && field ? parseScopeField(field) : null;
  return scope === null ? { ok: false, reason: 'invalid' } : { ok: true, uid, scope };
}
