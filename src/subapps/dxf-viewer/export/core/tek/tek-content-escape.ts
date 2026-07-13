/**
 * TEK content escaping — Tekton-safe κωδικοποίηση περιεχομένου χρήστη (`<s>` κείμενα, tags,
 * ονόματα τοίχων/ανοιγμάτων) στο `.tek` export (ADR-648 Στάδιο Γ).
 *
 * ⚠️ Ο parser του Τέκτονα **ΔΕΝ αποκωδικοποιεί XML entities**: ένα `&apos;`/`&amp;` μέσα σε
 * `<s>...</s>` τον κάνει να **ΚΟΛΛΑΕΙ** στο άνοιγμα (verified 2026-07-13: το 46.tek κόλλαγε λόγω
 * text records `A&apos;`/`B&apos;`/`&amp;`· container-isolation → ένοχος τα `<text>`· content-swap
 * → άνοιγε· ground-truth: native `EYOT705.tek` έχει **raw `'`** στα κείμενα και ανοίγει, καμία
 * native έξοδος δεν έχει `&amp;`). Άρα το generic `escapeXml` (που παράγει τα 5 entities) ΔΕΝ κάνει.
 *
 * Στρατηγική — κρατάμε το αρχείο **έγκυρο XML ΧΩΡΙΣ entities**:
 *  - `'` και `"` → **ΣΚΕΤΑ** (νόμιμα μέσα σε XML text content, ο Τέκτων τα διαβάζει verbatim).
 *  - `&`, `<`, `>` (τα μόνα που θα απαιτούσαν entity) → **ασφαλής ορατή αντικατάσταση**, ώστε ούτε
 *    το XML να σπάει ούτε ο Τέκτων να δει entity. `&`→`+` (raw `&` επίσης κολλάει — verified).
 */

/** Ασφαλείς αντικαταστάσεις των δομικών XML χαρακτήρων (τα μόνα που θα χρειάζονταν entity). */
const TEK_UNSAFE = /[&<>]/g;
const TEK_SUBSTITUTE: Readonly<Record<string, string>> = { '&': '+', '<': '(', '>': ')' };

/**
 * Κωδικοποιεί περιεχόμενο για ασφαλή εγγραφή σε `.tek` element content. Αφήνει `'`/`"` ΣΚΕΤΑ
 * (Tekton-readable) και αντικαθιστά μόνο τα `&`/`<`/`>` (που θα έσπαγαν το XML ή θα κόλλαγαν τον
 * Τέκτονα ως entity). ΔΕΝ παράγει ΠΟΤΕ `&amp;`/`&apos;`/`&lt;`/`&gt;`/`&quot;`.
 */
export function escapeTektonText(s: string): string {
  return s.replace(TEK_UNSAFE, (ch) => TEK_SUBSTITUTE[ch]);
}
