/**
 * @module lib/api/idempotency/idempotency-contract
 * @description **Το συμβόλαιο του συνόρου ιδεμποτίας** — ΜΙΑ πηγή για πελάτη **και** διακομιστή
 * (ADR-853 Ε3 Φάση 2 · ADR-826 §8α).
 *
 * 🔑 Πρότυπο: Stripe `Idempotency-Key` + IETF `draft-ietf-httpapi-idempotency-key-header-07`. Ο πελάτης
 * γεννά **ένα** κλειδί ανά λογική πράξη και το στέλνει **ίδιο** σε κάθε επανάληψη· ο διακομιστής εκτελεί
 * **μία** φορά και σε κάθε επανάληψη επιστρέφει την **αποθηκευμένη** απάντηση.
 *
 * ⚠️ Χωρίς `server-only`, επίτηδες: ο πελάτης διαβάζει από εδώ ποιοι κωδικοί ξαναστέλνονται. Δύο αντίγραφα
 * του «ποιοι κωδικοί υπάρχουν» θα ήταν δύο αλήθειες που αποκλίνουν σιωπηλά.
 */

/** Η κεφαλίδα του αιτήματος (IETF · Stripe). */
export const IDEMPOTENCY_KEY_HEADER = 'Idempotency-Key';

/** Η κεφαλίδα της απάντησης που **αναπαράγεται** αντί να εκτελεστεί (όνομα της Stripe). */
export const IDEMPOTENT_REPLAYED_HEADER = 'Idempotent-Replayed';

/** Όριο μήκους κλειδιού — της Stripe. */
export const IDEMPOTENCY_KEY_MAX_LENGTH = 255;

/** Πόσο ζει η μνήμη ενός κλειδιού (Stripe: «at least 24 hours»). */
export const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Πόσο θεωρείται «σε εξέλιξη» ένα κλείδωμα. **Διπλάσιο** της προθεσμίας του πελάτη (60s): πριν από αυτό η
 * επανάληψη περιμένει· μετά, η διεργασία που το κράτησε **δεν υπάρχει πια** και η έκβαση είναι **άγνωστη**.
 */
export const IDEMPOTENCY_LEASE_MS = 120_000;

/** Πόσα δευτερόλεπτα να περιμένει ο πελάτης όταν η ίδια πράξη τρέχει ακόμη (`Retry-After`). */
export const IDEMPOTENCY_IN_FLIGHT_RETRY_AFTER_S = 2;

/** Μέγιστο αποθηκευμένο σώμα — πολύ κάτω από το 1 MiB εγγράφου Firestore. */
export const IDEMPOTENCY_MAX_STORED_BODY_CHARS = 256 * 1024;

/**
 * Οι απαντήσεις του **ίδιου** του συνόρου — ποτέ του handler.
 *
 * | Κωδικός | HTTP | Ξαναστέλνεται; |
 * |---|---|---|
 * | `IDEMPOTENCY_IN_FLIGHT` | 409 | ✅ με το **ίδιο** κλειδί (IETF: «still being processed») |
 * | `IDEMPOTENCY_STORE_UNAVAILABLE` | 503 | ✅ — τίποτα δεν εκτελέστηκε |
 * | `IDEMPOTENCY_KEY_REUSED` | 422 | ❌ ίδιο κλειδί, **άλλο** περιεχόμενο — σφάλμα του πελάτη |
 * | `IDEMPOTENCY_KEY_INVALID` | 400 | ❌ |
 * | `IDEMPOTENCY_OUTCOME_UNKNOWN` | 409 | ❌ 🏆 η διεργασία χάθηκε στη μέση: **ποτέ** σιωπηλή δεύτερη εκτέλεση |
 * | `IDEMPOTENCY_REPLAY_UNAVAILABLE` | 409 | ❌ έγινε, αλλά η απάντηση δεν αναπαράγεται (μη-JSON ή μεγάλη) |
 */
export const IDEMPOTENCY_ERROR = {
  IN_FLIGHT: 'IDEMPOTENCY_IN_FLIGHT',
  STORE_UNAVAILABLE: 'IDEMPOTENCY_STORE_UNAVAILABLE',
  KEY_REUSED: 'IDEMPOTENCY_KEY_REUSED',
  KEY_INVALID: 'IDEMPOTENCY_KEY_INVALID',
  OUTCOME_UNKNOWN: 'IDEMPOTENCY_OUTCOME_UNKNOWN',
  REPLAY_UNAVAILABLE: 'IDEMPOTENCY_REPLAY_UNAVAILABLE',
} as const;

export type IdempotencyErrorCode = (typeof IDEMPOTENCY_ERROR)[keyof typeof IDEMPOTENCY_ERROR];

/** Οι απαντήσεις του συνόρου που **επιτρέπουν** επανάληψη με το ίδιο κλειδί — ο πελάτης διαβάζει αυτό. */
export const IDEMPOTENCY_RETRYABLE_CODES: ReadonlySet<string> = new Set<string>([
  IDEMPOTENCY_ERROR.IN_FLIGHT,
  IDEMPOTENCY_ERROR.STORE_UNAVAILABLE,
]);

/**
 * 🔑 **Η ΜΟΝΗ ΕΞΑΙΡΕΣΗ ανά route** — ιδεμποτικό **εκ κατασκευής** (π.χ. `set` boolean, «διάβασα ως εδώ»), και
 * συχνό: η αποθήκη θα ήταν κόστος χωρίς όφελος. Ο **λόγος** είναι υποχρεωτικός (CHECK 3.92 Κ1): «natural»
 * χωρίς απόδειξη στον handler είναι ακριβώς η διπλή πράξη που κλείνει αυτό το σύνορο.
 */
export interface NaturalIdempotency {
  readonly mode: 'natural';
  readonly why: string;
}

export type IdempotencyPolicy = NaturalIdempotency;

/** Έγκυρο κλειδί: 1…255 ορατοί ASCII χαρακτήρες (κεφαλίδα HTTP, χωρίς κενά). */
export function isValidIdempotencyKey(key: string): boolean {
  return key.length > 0 && key.length <= IDEMPOTENCY_KEY_MAX_LENGTH && /^[\x21-\x7E]+$/.test(key);
}
