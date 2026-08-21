/**
 * **SHA-256 → lowercase hex, ΜΙΑ ΦΟΡΑ (Web Crypto).**
 *
 * @module lib/hash/sha256
 * @related ADR-678 (Βήμα 3) · ADR-734 (Φ1) · ADR-736 (Φ3) · ADR-749 (μία μηχανή, μία αλήθεια)
 *
 * Το «κωδικοποίησε → `crypto.subtle.digest('SHA-256', …)` → hex» ήταν γραμμένο **έξι**
 * φορές, με **τρία** ιδιωτικά `bytesToHex`/`toHex` και δύο ασύμβατες συμπεριφορές όταν
 * λείπει το Web Crypto (ένα `throw`, ένα σιωπηλό fallback). Κάθε αντίγραφο έδινε το ίδιο
 * αποτέλεσμα — μέχρι τη στιγμή που κάποιο θα άλλαζε.
 *
 * ⚠️ **ΔΕΝ είναι δεύτερη αυθεντία δίπλα στο Node `createHash`** — άλλη ερώτηση, άλλο
 * περιβάλλον: `services/agent-capability/vqe/hashing.ts`, `server/lib/id-generation.ts`,
 * `lib/middleware/with-rate-limit.ts` και το `services/backup/*` είναι **σύγχρονα**
 * (`node:crypto`). Το `buildEnvelope()` είναι pure sync function· ένα `Promise` θα
 * ανάγκαζε κάθε καλούντα σε `await` για καθαρά CPU υπολογισμό. Αυτό εδώ είναι ο
 * **ασύγχρονος, browser-side** μισός — ΜΗΝ τους ενώσεις σε μία εξαγωγή.
 *
 * ⚠️ **ΔΕΝ είναι SSoT για hex χρωμάτων**: το `toString(16).padStart(2,'0')` σε
 * `config/color-math.ts` · `io/mesh3d-material-import/rgb-unit-hex.ts` · `text-engine/
 * render/run-color.ts` απαντά «τι χρώμα είναι αυτό», όχι «τι είναι αυτά τα bytes».
 * Ίδιο idiom, διαφορετική ερώτηση — η ενοποίησή τους θα ήταν ψεύτικο SSoT.
 *
 * ⚠️ **ΜΗΝ γράψεις έβδομο**: αν χρειάζεσαι SHA-256 στον browser, κάλεσε το
 * {@link sha256Hex} ή το {@link sha256HexOfText}. Το CHECK 3.28 (jscpd, token-based)
 * πιάνει το αντίγραφο ανεξάρτητα από το όνομα που θα του δώσεις.
 */

/** Λόγος αποτυχίας όταν το περιβάλλον δεν προσφέρει Web Crypto. */
export const CRYPTO_UNAVAILABLE_ERROR = 'CRYPTO_ERROR: Web Crypto API is not available';

/**
 * `true` όταν το τρέχον περιβάλλον προσφέρει `crypto.subtle`.
 *
 * Υπάρχει για τους καλούντες που έχουν **νόμιμη υποβάθμιση** αντί για σφάλμα (π.χ. η
 * ανωνυμοποίηση IP του GDPR, που προτιμά μια μασκαρισμένη διεύθυνση από μια εξαίρεση).
 * Ο έλεγχος ζει εδώ ώστε να μην τον ξαναγράψει κανείς με ελαφρώς άλλο κριτήριο.
 */
export function isWebCryptoAvailable(): boolean {
  return typeof globalThis.crypto !== 'undefined' && !!globalThis.crypto.subtle;
}

/**
 * Bytes → lowercase hex (δύο ψηφία ανά byte). Καθαρή συνάρτηση, μηδέν crypto.
 */
export function bytesToHex(bytes: Uint8Array): string {
  let out = '';
  for (const b of bytes) out += b.toString(16).padStart(2, '0');
  return out;
}

/**
 * SHA-256 των bytes → 64 χαρακτήρες lowercase hex.
 *
 * Δέχεται **οποιοδήποτε** `BufferSource`. Ένα `Uint8Array` μπορεί να είναι *προβολή* πάνω
 * σε μεγαλύτερο buffer (`byteOffset > 0`)· περνώντας ωμά το `.buffer` θα κατακερματίζαμε
 * **ολόκληρο** τον buffer και θα βγάζαμε λάθος digest σιωπηλά. Η κανονικοποίηση γίνεται
 * εδώ, μία φορά, για κάθε καλούντα.
 *
 * @throws {Error} {@link CRYPTO_UNAVAILABLE_ERROR} όταν λείπει το Web Crypto. Αν το δικό
 * σου πλαίσιο επιτρέπει υποβάθμιση αντί για σφάλμα, ρώτα πρώτα το {@link isWebCryptoAvailable}.
 */
export async function sha256Hex(data: BufferSource): Promise<string> {
  if (!isWebCryptoAvailable()) throw new Error(CRYPTO_UNAVAILABLE_ERROR);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', normalizeToBuffer(data));
  return bytesToHex(new Uint8Array(digest));
}

/**
 * SHA-256 του UTF-8 κειμένου → 64 χαρακτήρες lowercase hex. Το `TextEncoder` παράγει
 * πάντα φρέσκο buffer, οπότε δεν υπάρχει ζήτημα προβολής.
 */
export async function sha256HexOfText(text: string): Promise<string> {
  return sha256Hex(new TextEncoder().encode(text));
}

/** Προβολή `ArrayBufferView` → ο **ακριβής** buffer της· `ArrayBuffer` → ως έχει. */
function normalizeToBuffer(data: BufferSource): ArrayBuffer {
  if (!ArrayBuffer.isView(data)) return data;
  const { buffer, byteOffset, byteLength } = data;
  return byteOffset === 0 && byteLength === buffer.byteLength
    ? (buffer as ArrayBuffer)
    : (buffer.slice(byteOffset, byteOffset + byteLength) as ArrayBuffer);
}
