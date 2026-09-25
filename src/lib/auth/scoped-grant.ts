/**
 * @fileoverview **ΠΕΡΙΟΡΙΣΜΕΝΗ, ΧΡΟΝΙΚΑ ΟΡΙΟΘΕΤΗΜΕΝΗ ΑΔΕΙΑ** — ο **ένας** έλεγχος «ισχύει ακόμη;».
 * @related ADR-884 Φ0.5 · `PropertyGrant` (lib/auth/types) · `checkPermission` (lib/auth/permissions)
 * @module lib/auth/scoped-grant
 *
 * Δύο πράγματα δίνουν σε κάποιον **λίγα** δικαιώματα για **λίγο**: το grant ακινήτου σε εξωτερικό
 * χρήστη, και η άδεια λήψης του φωτογράφου σε μία περιήγηση (ADR-884 Φ0.5). Το ερώτημα είναι **ένα** —
 * *«έληξε; ανακλήθηκε; καλύπτει αυτό που ζητά;»* — άρα ο έλεγχος είναι **ένας**. Δεύτερο αντίγραφο του
 * ελέγχου λήξης = απαγορεύεται.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΒΓΗΚΕ ΑΠΟ ΤΟ `checkPermission` — ΤΟ ΣΦΑΛΜΑ ΠΟΥ ΕΚΡΥΒΕ (μετρημένο 2026-09-25)
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο παλιός κώδικας έγραφε `expiresAt instanceof Date ? expiresAt : new Date(expiresAt)`. Το Admin SDK
 * όμως επιστρέφει **`Timestamp`**, και `new Date(Timestamp)` = `Invalid Date`· `Invalid Date < now` =
 * **`false`** ⇒ το grant **δεν έληγε ποτέ**. Ίδια μοίρα για κάθε άκυρο string. Η σύγκριση με NaN είναι
 * πάντα ψευδής, άρα κάθε έλεγχος γραμμένος ως «αρνήσου αν έληξε» **ανοίγει** όταν δεν διαβάζει.
 *
 * ⇒ Εδώ η στιγμή διαβάζεται από το **SSoT** `normalizeToMillisOrNull` (Timestamp · Date · ISO ·
 * σειριοποιημένο `{_seconds}`), και ό,τι **δεν** διαβάζεται είναι **άρνηση** (`unreadable-expiry`) —
 * fail-closed, με δικό του όνομα ώστε να μη μοιάζει με κανονική λήξη.
 *
 * 🔑 **Ανάκληση πριν από λήξη** — η σειρά του `oauth-token-store`: η ανάκληση είναι **πράξη ανθρώπου**,
 * η λήξη **περάσματος χρόνου**· όταν ισχύουν και οι δύο, λέμε αυτό που **έκανε** κάποιος.
 *
 * **Layering**: leaf (μόνο `lib/date-local`) — καθαρή συνάρτηση, κανένα Firestore SDK.
 */

import { normalizeToMillisOrNull } from '@/lib/date-local';

/**
 * Το σχήμα κάθε περιορισμένης άδειας. Οι χρόνοι είναι `unknown` **επίτηδες**: έρχονται από έγγραφο
 * (Timestamp, ISO, Date) και τους ερμηνεύει **μόνο** ο κριτής παρακάτω.
 */
export interface ScopedGrant<S extends string> {
  readonly scopes: readonly S[];
  /** Υποχρεωτικό — άδεια χωρίς λήξη δεν υπάρχει σε αυτό το σχήμα. */
  readonly expiresAt: unknown;
  /** Παρόν (οποιαδήποτε τιμή) ⇒ ανακλήθηκε. */
  readonly revokedAt?: unknown;
}

/** Η ετυμηγορία — ονομασμένη, **ποτέ** boolean: κάθε άρνηση έχει άλλη θεραπεία για τον άνθρωπο. */
export type ScopedGrantVerdict =
  | 'granted'
  | 'revoked'
  | 'expired'
  | 'unreadable-expiry'
  | 'scope-missing';

/**
 * **Ισχύει αυτή η άδεια για αυτό το εύρος, τώρα;**
 *
 * @param nowMs η στιγμή της κρίσης — παράμετρος, ώστε ο καλών να κρίνει όλα τα grants μιας πράξης
 *              στην **ίδια** στιγμή και τα tests να μην εξαρτώνται από το ρολόι.
 */
export function evaluateScopedGrant<S extends string>(
  grant: ScopedGrant<S>,
  scope: S,
  nowMs: number,
): ScopedGrantVerdict {
  if (grant.revokedAt !== undefined && grant.revokedAt !== null) return 'revoked';
  const expiresAtMs = normalizeToMillisOrNull(grant.expiresAt);
  if (expiresAtMs === null) return 'unreadable-expiry';
  if (expiresAtMs <= nowMs) return 'expired';
  return grant.scopes.includes(scope) ? 'granted' : 'scope-missing';
}
