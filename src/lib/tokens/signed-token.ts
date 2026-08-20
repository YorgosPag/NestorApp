/**
 * @fileoverview **Ο ΥΠΟΓΕΓΡΑΜΜΕΝΟΣ ΣΥΝΔΕΣΜΟΣ** — μία μηχανή για κάθε άνθρωπο χωρίς λογαριασμό.
 * @related ADR-777 §8.33 · ADR-170 (QR παρουσιών) · ADR-327 §7 (πύλη προμηθευτή)
 * @module lib/tokens/signed-token
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΕΞΗΧΘΗ — **ΔΥΟ ΥΛΟΠΟΙΗΣΕΙΣ, ΚΑΙ Η ΤΡΙΤΗ ΗΤΑΝ ΕΤΟΙΜΗ ΝΑ ΓΡΑΦΤΕΙ**
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Μετρημένο πριν γραφτεί γραμμή (§8.33): το `services/attendance/qr-token-service.ts`
 * (ADR-170) και το `services/vendor-portal/vendor-portal-token-service.ts` (ADR-327)
 * κουβαλούσαν **τις ίδιες τέσσερις βοηθητικές** (`getSigningSecret` · `computeHmac` ·
 * `toBase64Url` · `fromBase64Url`) και **το ίδιο εικοσάγραμμο** σκέλος επαλήθευσης
 * υπογραφής, γραμμένο δύο φορές. Το ίδιο το δεύτερο αρχείο το **παραδέχεται** στην
 * κεφαλίδα του: *«Mirrors the pattern of `qr-token-service.ts`»*.
 *
 * Η εντολή του μεσίτη χρειάζεται **ακριβώς το ίδιο**: σύνδεσμο που πηγαίνει σε
 * άνθρωπο **χωρίς λογαριασμό**, δεν πλαστογραφείται, λήγει, και ανακαλείται. Μια
 * τρίτη αντιγραφή θα ήταν, κατά γράμμα, το σχήμα του **ADR-749** — τρεις αλήθειες για
 * το «τι είναι έγκυρη υπογραφή», που θα απέκλιναν στην πρώτη αλλαγή κρυπτογραφίας.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΤΙ ΕΙΝΑΙ ΚΑΙ ΤΙ **ΔΕΝ** ΕΙΝΑΙ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * **Είναι** η γραμματική του συνδέσμου: πακετάρισμα πεδίων, υπογραφή, χρονικά ασφαλής
 * σύγκριση, ξεπακετάρισμα με **ρητή ετυμηγορία**.
 *
 * **ΔΕΝ είναι** η πολιτική: ούτε τι σημαίνουν τα πεδία, ούτε πόσο ζει ο σύνδεσμος,
 * ούτε αν καίγεται μετά τη χρήση. Αυτά ζουν στον καθένα από τους τρεις καταναλωτές,
 * γιατί **διαφέρουν πραγματικά**: το QR λήγει στο τέλος της ημέρας, ο προμηθευτής σε
 * 7 μέρες με μία χρήση, η εντολή του μεσίτη ζει όσο του ζητήσουμε να απαντήσει.
 *
 * ⚠️ **Καμία πρόσβαση σε Firestore εδώ, επίτηδες.** Η λίστα ακυρωμένων είναι
 * **πολιτική** και ζει σε άλλη συλλογή για κάθε καταναλωτή· ένα κοινό «μητρώο
 * nonce» θα ένωνε τρεις άσχετους κύκλους ζωής σε ένα έγγραφο.
 *
 * **Layering**: leaf — `crypto` και τίποτε άλλο. Δοκιμάσιμο χωρίς δίκτυο.
 */

import 'server-only';

import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

// =============================================================================
// 1. ΤΟ ΜΥΣΤΙΚΟ
// =============================================================================

/**
 * Διαβάζει το μυστικό υπογραφής, **ή πετά με το όνομα της μεταβλητής μέσα**.
 *
 * ⚠️ **Το όνομα στο μήνυμα δεν είναι ευγένεια — είναι η διαφορά ανάμεσα σε λεπτά και
 * ώρες** όταν κάποιος αναπτύσσει σε νέο περιβάλλον: κάθε καταναλωτής έχει **δικό του**
 * μυστικό, οπότε ένα γενικό «λείπει το μυστικό» δεν λέει **ποιο**.
 */
export function requireTokenSecret(envVar: string): string {
  const secret = process.env[envVar]?.trim();
  if (!secret) {
    throw new Error(`${envVar} environment variable is required for signed link operations`);
  }
  return secret;
}

// =============================================================================
// 2. ΚΩΔΙΚΟΠΟΙΗΣΗ
// =============================================================================

function toBase64Url(input: string): string {
  return Buffer.from(input, 'utf-8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function fromBase64Url(input: string): string {
  const padded = input + '==='.slice(0, (4 - (input.length % 4)) % 4);
  return Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8');
}

/** Τυχαίο nonce σε δεκαεξαδικό — η ταυτότητα **αυτού** του συνδέσμου. */
export function newTokenNonce(): string {
  return randomBytes(16).toString('hex');
}

// =============================================================================
// 3. ΥΠΟΓΡΑΦΗ
// =============================================================================

/**
 * **Πεδία → σύνδεσμος.** Τα πεδία ενώνονται με `:` και υπογράφονται όλα μαζί.
 *
 * ⚠️ **ΚΑΝΕΝΑ πεδίο δεν επιτρέπεται να περιέχει `:`** — αλλιώς δύο διαφορετικά σύνολα
 * πεδίων παράγουν το **ίδιο** υπογεγραμμένο κείμενο, και η υπογραφή παύει να
 * προσδιορίζει τι υπογράφτηκε. Ελέγχεται εδώ, γιατί ένας καταναλωτής που το ξεχνά
 * παράγει σύνδεσμο που «δουλεύει» μέχρι την ημέρα που δεν δουλεύει.
 */
export function encodeSignedToken(
  secret: string,
  fields: readonly string[],
): string {
  for (const field of fields) {
    if (field.includes(':')) {
      throw new Error('signed token fields must not contain ":"');
    }
  }
  const payload = fields.join(':');
  const hmac = createHmac('sha256', secret).update(payload).digest('hex');
  return toBase64Url(`${payload}:${hmac}`);
}

// =============================================================================
// 4. ΕΠΑΛΗΘΕΥΣΗ — ρητή ετυμηγορία, ποτέ `boolean`
// =============================================================================

/**
 * Γιατί απορρίφθηκε ο σύνδεσμος.
 *
 * 🔑 **Ονομασμένοι λόγοι και όχι `false`**, γιατί οι καταναλωτές τους **δείχνουν σε
 * ανθρώπους**: «ο σύνδεσμος έληξε» και «ο σύνδεσμος δεν είναι έγκυρος» στέλνουν τον
 * παραλήπτη σε **εντελώς διαφορετική** ενέργεια. Ένα κοινό «άκυρο» θα του έλεγε ότι
 * κάποιος τον εξαπατά ενώ απλώς άργησε τρεις μέρες.
 *
 * ⚠️ Το `server-config` **δεν είναι** σφάλμα του παραλήπτη: σημαίνει ότι λείπει το
 * μυστικό **από εμάς**. Ξεχωριστό, ώστε να μη λέμε σε αθώο άνθρωπο ότι ο σύνδεσμός
 * του είναι πλαστός επειδή ξεχάσαμε μια μεταβλητή περιβάλλοντος.
 */
export type SignedTokenRejection =
  | 'malformed'
  | 'invalid-format'
  | 'invalid-signature'
  | 'server-config';

export type SignedTokenVerdict =
  | { readonly ok: true; readonly fields: readonly string[] }
  | { readonly ok: false; readonly reason: SignedTokenRejection };

/**
 * **Σύνδεσμος → πεδία**, αφού αποδειχθεί η υπογραφή. **Καμία επαφή με βάση.**
 *
 * 🔑 **Ο έλεγχος υπογραφής προηγείται ΠΑΝΤΑ κάθε ανάγνωσης**, και είναι η φθηνή
 * διαδρομή: πλαστός σύνδεσμος απορρίπτεται **χωρίς κανένα αίτημα** στη βάση, οπότε
 * ένας επιτιθέμενος δεν μπορεί να μας κοστίσει τίποτα στέλνοντας σκουπίδια.
 *
 * @param minFields — πόσα πεδία **τουλάχιστον** περιμένει ο καταναλωτής (χωρίς την
 *   υπογραφή). Κρίνεται εδώ ώστε ένας σύνδεσμος με λιγότερα να μη φτάσει ποτέ σε
 *   κώδικα που τα διαβάζει με δείκτη.
 */
export function decodeSignedToken(
  secret: string,
  token: string,
  minFields: number,
): SignedTokenVerdict {
  let decoded: string;
  try {
    decoded = fromBase64Url(token);
  } catch {
    return { ok: false, reason: 'malformed' };
  }

  const parts = decoded.split(':');
  if (parts.length < minFields + 1) return { ok: false, reason: 'invalid-format' };

  const signature = parts[parts.length - 1];
  const fields = parts.slice(0, -1);
  if (signature === undefined || signature === '' || fields.some((f) => f === '')) {
    return { ok: false, reason: 'invalid-format' };
  }

  let expected: string;
  try {
    expected = createHmac('sha256', secret).update(fields.join(':')).digest('hex');
  } catch {
    return { ok: false, reason: 'server-config' };
  }

  if (!equalsInConstantTime(signature, expected)) {
    return { ok: false, reason: 'invalid-signature' };
  }

  return { ok: true, fields };
}

/**
 * Σύγκριση **σταθερού χρόνου** — και οι τρεις έλεγχοι μήκους είναι απαραίτητοι.
 *
 * ⚠️ Το `timingSafeEqual` **πετά** σε buffers διαφορετικού μήκους· και το
 * `Buffer.from(x, 'hex')` σε μη-δεκαεξαδικό κείμενο **σιωπηλά κόβει**, οπότε δύο
 * άσχετες συμβολοσειρές μπορούν να δώσουν buffers **ίδιου** μήκους. Γι' αυτό
 * ελέγχεται και το μήκος του **κειμένου**, όχι μόνο των buffers.
 */
function equalsInConstantTime(actual: string, expected: string): boolean {
  if (actual.length !== expected.length) return false;
  const a = Buffer.from(actual, 'hex');
  const b = Buffer.from(expected, 'hex');
  if (a.length !== b.length || a.length === 0) return false;
  return timingSafeEqual(a, b);
}
