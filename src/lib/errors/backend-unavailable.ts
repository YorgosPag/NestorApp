/**
 * =============================================================================
 * «ΔΕΝ ΜΠΟΡΕΣΑ ΝΑ ΡΩΤΗΣΩ» — Η ΜΙΑ ΔΗΛΩΣΗ ΑΔΥΝΑΜΙΑΣ BACKEND ΣΤΟ ΣΥΝΟΡΟ ΑΠΟΔΟΣΗΣ
 * =============================================================================
 *
 * Σελίδες και layouts που **πρέπει** να ρωτήσουν τη βάση πριν αποδοθούν (ψευδώνυμο
 * χώρου, βιτρίνα γραφείου) έχουν τρεις απαντήσεις: *βρέθηκε* · *δεν υπάρχει* (404) ·
 * *δεν μπόρεσα να ρωτήσω*. Η τρίτη **ΠΟΤΕ** δεν φοράει τη στολή της δεύτερης: ένα
 * 404 για γραφείο που υπάρχει, επειδή η βάση δεν απάντησε, είναι ψέμα (N.12).
 *
 * 🔑 **ΓΙΑΤΙ ΡΙΧΝΟΥΜΕ (5xx) ΚΑΙ ΟΧΙ ΟΘΟΝΗ ΜΕ 200** — ερευνημένο 2026-09-22 στην
 * τεκμηρίωση της Google Search: *«5xx … prompt Google's crawlers to temporarily slow
 * down»* και διατηρούν τα ήδη ευρετηριασμένα URL, ενώ μια σελίδα 200 με μήνυμα
 * σφάλματος καταγράφεται ως **soft 404**. Για δημόσια σελίδα (βιτρίνα `/pro`) το 200
 * θα έβγαζε το γραφείο από την αναζήτηση σε κάθε σύντομη βλάβη. ⚠️ Το 500 και το
 * 503 αντιμετωπίζονται **ίδια** από την Google, και ένα Server Component δεν ορίζει
 * κωδικό κατάστασης — γι' αυτό το 500 του framework είναι αποδεκτό, όχι συμβιβασμός.
 *
 * 🏆 **ΤΟ `digest` ΕΙΝΑΙ Η ΑΠΟΔΕΙΞΗ, ΟΧΙ ΔΙΑΚΟΣΜΗΣΗ**: το Next.js **σέβεται** ένα
 * `digest` που ορίζει ο κώδικας (`create-error-handler.js`: *«If the error already
 * has a digest, respect the original digest»*) και το ταξιδεύει ως έχει στον πελάτη
 * — ενώ το `message` το σβήνει στην παραγωγή. Άρα:
 *   • το error boundary ξέρει **ΤΙ** συνέβη και δείχνει «προσωρινά μη διαθέσιμο»,
 *     όχι το εσωτερικό «ειδοποίησε τον διαχειριστή»·
 *   • ο χρησμός (CHECK 3.51 Χ) ξεχωρίζει **δηλωμένη** αδυναμία από **crash**: 5xx
 *     με αυτό το digest στο HTML = «ο κώδικας είπε ότι δεν μπόρεσε να ρωτήσει»·
 *     5xx χωρίς αυτό = ⛔ όπως πάντα. fail-closed.
 *
 * ⛔ **ΜΗΝ** ξαναγράψεις `throw new Error('X_UNAVAILABLE')` σε σύνορο απόδοσης: το
 * `message` χάνεται στην παραγωγή, και μαζί του κάθε δυνατότητα να ξεχωρίσει ο
 * άνθρωπος — ή η πύλη — τη βλάβη της βάσης από ένα σφάλμα του κώδικα.
 *
 * @related ADR-781 (χρησμός) · ADR-787 §5.3 ια (φρουρός χώρου) · ADR-827 §9.6 #2 (βιτρίνα)
 * @module lib/errors/backend-unavailable
 */

/** Το πρόθεμα του `digest` — **το ΙΔΙΟ** διαβάζουν boundary και χρησμός. */
export const BACKEND_UNAVAILABLE_DIGEST_PREFIX = 'NESTOR_BACKEND_UNAVAILABLE';

/** Ποια ερώτηση προς τη βάση δεν απαντήθηκε — κλειστό σύνολο, ένα όνομα ανά εξάρτηση. */
export const BACKEND_DEPENDENCIES = ['workspace-lookup', 'agency-alias-lookup', 'agency-profile'] as const;

export type BackendDependency = (typeof BACKEND_DEPENDENCIES)[number];

/** Το σφάλμα που ρίχνει ένα σύνορο απόδοσης όταν **δεν μπόρεσε να ρωτήσει**. */
export class BackendUnavailableError extends Error {
  readonly digest: string;
  readonly dependency: BackendDependency;

  constructor(dependency: BackendDependency) {
    super(`${BACKEND_UNAVAILABLE_DIGEST_PREFIX}:${dependency}`);
    this.name = 'BackendUnavailableError';
    this.dependency = dependency;
    this.digest = `${BACKEND_UNAVAILABLE_DIGEST_PREFIX}:${dependency}`;
  }
}

/** Ρίχνει τη δήλωση. `never` ⇒ ο έλεγχος τύπων ξέρει ότι ο κλάδος τελειώνει εδώ. */
export function throwBackendUnavailable(dependency: BackendDependency): never {
  throw new BackendUnavailableError(dependency);
}

/**
 * Είναι αυτό το `digest` δηλωμένη αδυναμία backend; — για το error boundary.
 * ⚠️ `startsWith` και όχι ισότητα: το Next μπορεί να κολλήσει κωδικό σφάλματος
 * μετά από `@` (`createDigestWithErrorCode`) — το πρόθεμα μένει αναλλοίωτο.
 */
export function isBackendUnavailableDigest(digest: string | undefined): boolean {
  return typeof digest === 'string' && digest.startsWith(`${BACKEND_UNAVAILABLE_DIGEST_PREFIX}:`);
}
