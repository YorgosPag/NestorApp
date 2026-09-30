/**
 * @fileoverview **Ο ΕΝΑΣ ΑΝΑΓΝΩΣΤΗΣ ΤΟΥ CLAIM `revokedSignIns`** — ADR-894 §10.7 (Φ2-Ο1).
 * @related lib/auth/revoked-sign-ins (η λίστα-πηγή, server) · lib/auth/set-claims-with-mirror (ο ΕΝΑΣ γραφέας
 *   που την προβάλλει) · `firestore.rules` / `storage.rules` → `signInIsLive()` · CHECK 3.96
 * @module lib/auth/revoked-sign-ins-claim
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΚΕΝΟ ΠΟΥ ΚΛΕΙΝΕΙ
 * ─────────────────────────────────────────────────────────────────────────────
 * Η λίστα `users/{uid}/security/revoked_sign_ins` αρνείται μια ανακλημένη σύνδεση **στο σύνορο του server**. Οι
 * κανόνες Firestore/Storage όμως **δεν τη βλέπουν**: ένας κακόβουλος client με το refresh token της ανακλημένης
 * συσκευής συνέχιζε να διαβάζει **απευθείας**. Το `get()` της λίστας στους κανόνες θα χρέωνε **μία ανάγνωση σε κάθε
 * αίτημα client** (και σε κάθε ενημέρωση listener) και δεν θα κάλυπτε το Storage.
 *
 * 🔑 **Η λίστα γίνεται ΠΡΟΒΟΛΗ σε custom claim**: κάθε ID token που κόβεται μετά την ανάκληση κουβαλά τα ανακλημένα
 * `auth_time` του λογαριασμού ⇒ οι κανόνες ρωτούν `auth_time in revokedSignIns` με **0 αναγνώσεις**, σε Firestore
 * **και** Storage. Το token ζει ≤ 1 ώρα ⇒ ο κακόβουλος client κόβεται σε ≤ 1 ώρα — **η ίδια** εγγύηση που δίνει η
 * Firebase για την ανάκληση **όλων** (`revokeRefreshTokens`: οι κανόνες δεν ελέγχουν ανάκληση).
 *
 * 🔑 **Ισομορφικό** (όπως το `claim-permissions.ts`): το ίδιο ερώτημα απαντά ο browser («ανακλήθηκε η **δική μου**
 * σύνδεση;» ⇒ αποσύνδεση) και ο server (προβολή). Ένας κανόνας ανάγνωσης, όχι δύο που αποκλίνουν.
 * ⛔ Κανένα `server-only`, κανένα logger, καμία Firestore.
 */

/** Το **ένα** όνομα. ⚠️ Το ίδιο literal ζει στο `signInIsLive()` των δύο αρχείων κανόνων — το φυλά το CHECK 3.96. */
export const REVOKED_SIGN_INS_CLAIM = 'revokedSignIns';

/** Όριο της Firebase για όλο το σύνολο custom claims (`setCustomUserClaims` ρίχνει πάνω από αυτό). */
export const CLAIMS_LIMIT_BYTES = 1000;

/**
 * Ο χώρος που **κρατά** η λίστα μέσα στα 1000 bytes. Μετρημένο 2026-09-30 (13 λογαριασμοί παραγωγής): τα υπόλοιπα
 * claims πιάνουν **≤ 176 bytes** ⇒ μένουν ~420 για να μεγαλώσουν (`permissions`) πριν αγγίξουν τη λίστα.
 */
export const REVOKED_SIGN_INS_CLAIM_BUDGET_BYTES = 400;

/** `auth_time` σε δευτερόλεπτα: 10 ψηφία ως το έτος 2286 + το κόμμα του πίνακα. */
const BYTES_PER_ENTRY = 11;

/** `"revokedSignIns":[]` + το κόμμα που το χωρίζει από το προηγούμενο claim. */
const CLAIM_OVERHEAD_BYTES = REVOKED_SIGN_INS_CLAIM.length + 6;

/**
 * **Πόσες μεμονωμένες ανακλήσεις χωρούν** — παράγεται από τον προϋπολογισμό, ποτέ χειρόγραφο. Πάνω από αυτό ο
 * καλών **κλιμακώνει** σε ανάκληση όλων (`revokeRefreshTokens`): ποτέ σιωπηλή απώλεια, ποτέ claim που δεν χωρά.
 */
export const MAX_CLAIMED_REVOKED_SIGN_INS = Math.floor(
  (REVOKED_SIGN_INS_CLAIM_BUDGET_BYTES - CLAIM_OVERHEAD_BYTES) / BYTES_PER_ENTRY,
);

/** Έγκυρο `auth_time` (δευτερόλεπτα, θετικός ακέραιος) — ο ΕΝΑΣ έλεγχος, κοινός με τη λίστα-πηγή. */
export function isAuthTime(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

/** Ανεκτική ανάγνωση: ό,τι δεν είναι `auth_time` πετιέται· απουσία ⇒ κενή λίστα. Ταξινομημένη, χωρίς διπλά. */
export function readRevokedSignInsClaim(value: unknown): readonly number[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter(isAuthTime))].sort((a, b) => a - b);
}

/** Ίδια λίστα; — ώστε ο γραφέας να μη γράφει claims (και να μην ξυπνά κάθε browser) χωρίς λόγο. */
export function sameRevokedSignIns(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

/**
 * **Η προβολή** — το σύνολο claims με τη λίστα της **πηγής**, ό,τι κι αν έστειλε ο καλών για το πεδίο (το claim
 * είναι αντίγραφο, όχι είσοδος). Κενή λίστα ⇒ το πεδίο **λείπει** (κανένα byte για «τίποτα»).
 */
export function withRevokedSignInsClaim(
  claims: Readonly<Record<string, unknown>>,
  revoked: readonly number[],
): Record<string, unknown> {
  const rest: Record<string, unknown> = { ...claims };
  delete rest[REVOKED_SIGN_INS_CLAIM];
  const list = readRevokedSignInsClaim(revoked);
  return list.length > 0 ? { ...rest, [REVOKED_SIGN_INS_CLAIM]: list } : rest;
}

/**
 * «**Ανακλήθηκε η σύνδεση αυτού του token;**» — το `auth_time` του μέσα στη λίστα που κουβαλά. Χωρίς `auth_time`
 * (δεν συμβαίνει σε token της Firebase) ⇒ `false`: ο κριτής «ζει;» παραμένει το σύνορο του server.
 */
export function isOwnSignInRevoked(claims: Readonly<Record<string, unknown>>): boolean {
  const authTime = claims.auth_time;
  return isAuthTime(authTime) && readRevokedSignInsClaim(claims[REVOKED_SIGN_INS_CLAIM]).includes(authTime);
}
