/**
 * =============================================================================
 * SHARE TOKEN — γέννηση και αποτύπωμα του διακριτικού κοινοποίησης (ADR-884 Φ0.12 · ADR-315)
 * =============================================================================
 *
 * 🔑 **Ο σύνδεσμος φέρει το ωμό διακριτικό· η βάση φέρει ΜΟΝΟ το αποτύπωμά του.**
 * Πρότυπο OWASP (Cryptographic Storage) και ίδιο με το `nonceHash` του ADR-853: για
 * διακριτικό **υψηλής εντροπίας** αρκεί SHA-256 — **όχι** KDF. Ο KDF (scrypt/Argon2)
 * χρειάζεται για μυστικά **χαμηλής** εντροπίας που διαλέγει άνθρωπος (κωδικοί →
 * `server/sharing/share-password.ts`)· εδώ 256 τυχαία bit κάνουν την ωμή δύναμη
 * άσκοπη, οπότε ένα αργό hash θα κόστιζε μόνο χρόνο ανά αίτημα χωρίς όφελος.
 *
 * 🔴 **Γιατί υπάρχει**: μέχρι το Κ4 το διακριτικό αποθηκευόταν **σε καθαρό κείμενο** και
 * η συλλογή ήταν `allow read: if true` — δηλαδή ό,τι έλεγε «190 bit εντροπίας» δεν
 * προστάτευε τίποτα, αφού το διακριτικό **διαβαζόταν** αντί να μαντεύεται. Με μόνο το
 * αποτύπωμα στη βάση, ούτε διαρροή της βάσης δεν δίνει σύνδεσμο που ανοίγει.
 *
 * ⚠️ **ΔΕΝ είναι `server-only`, επίτηδες**: το εισάγει και το script μετάπτωσης
 * (`scripts/migrate-share-token-hash.ts`), που τρέχει έξω από το Next. Δεν κρατά
 * κανένα μυστικό — μόνο τη γραμματική.
 *
 * @module lib/sharing/share-token
 * @see docs/centralized-systems/reference/adrs/ADR-884-spatial-tour-panorama-bim.md §8.1 Φ0.12
 */

import { sha256HexOfText } from '@/lib/hash/sha256';

/** 32 bytes = 256 bit — ίδιο μέγεθος με ένα κλειδί AES-256. */
export const SHARE_TOKEN_BYTES = 32;

/**
 * Όρια σχήματος ενός διακριτικού που **μπορεί** να είναι δικό μας.
 *
 * Δύο γενιές συνυπάρχουν: τα παλιά (32 αλφαριθμητικά, πριν το Κ4) και τα νέα
 * (43 χαρακτήρες base64url). Το αλφάβητο base64url περιέχει και τα δύο.
 */
const TOKEN_SHAPE = /^[A-Za-z0-9_-]{24,128}$/;

/**
 * Νέο διακριτικό: 32 τυχαία bytes σε base64url (43 χαρακτήρες, χωρίς `=`).
 *
 * Αντικαθιστά το παλιό `byte % 62`, που είχε **modulo bias** (οι 8 πρώτοι
 * χαρακτήρες εμφανίζονταν συχνότερα) και ~190 αντί για 256 bit.
 */
export function generateShareToken(): string {
  const bytes = new Uint8Array(SHARE_TOKEN_BYTES);
  globalThis.crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString('base64url');
}

/** Αποτύπωμα του διακριτικού — το **μόνο** που αποθηκεύεται (`tokenHash`). */
export function hashShareToken(token: string): Promise<string> {
  return sha256HexOfText(token);
}

/**
 * Φθηνή απόρριψη **πριν** από κάθε ανάγνωση: κάτι που δεν έχει σχήμα διακριτικού
 * δεν φτάνει ποτέ στη βάση — ο επιτιθέμενος που στέλνει σκουπίδια δεν μας κοστίζει.
 */
export function isPlausibleShareToken(token: unknown): token is string {
  return typeof token === 'string' && TOKEN_SHAPE.test(token);
}
