/**
 * Centralized error message extraction utility.
 * Replaces scattered `err instanceof Error ? err.message : '...'` patterns.
 *
 * @see ADR-221 — Error Message Extraction Centralization
 */

/**
 * Extract a human-readable message from an unknown catch parameter.
 *
 * Handles: string errors, Error instances, plain objects with `.message` or `.error`,
 * and falls back to a configurable default.
 */
export function getErrorMessage(error: unknown, fallback = 'Unknown error'): string {
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;

  if (error !== null && typeof error === 'object') {
    const obj = error as Record<string, unknown>;
    if (typeof obj.message === 'string') return obj.message;
    if (typeof obj.error === 'string') return obj.error;
  }

  return fallback;
}

/**
 * Did Firestore refuse this operation because the **rules** said no?
 *
 * 🔴 **Γιατί χρειάζεται να ρωτηθεί καθόλου.** Ένα `permission-denied` δεν είναι βλάβη —
 * είναι **απάντηση**. Οι κανόνες δεν φιλτράρουν, απορρίπτουν: μια ανάγνωση εγγράφου που
 * ανήκει σε άλλον μισθωτή, ή εγγράφου που **δεν υπάρχει** (όπου το `resource.data` είναι
 * `null` και ο κανόνας βγάζει evaluation error), φτάνει στον καλούντα ως **εξαίρεση**, όχι
 * ως `null`. Κώδικας που περιμένει `null` — δηλαδή κάθε κώδικας γραμμένος με mocks, που
 * γράφουν σε μνήμη χωρίς κανόνες — πέφτει στο catch-all του και αναφέρει γενικό σφάλμα
 * εκεί όπου η σωστή απάντηση ήταν «δεν υπάρχει, για σένα».
 *
 * Μετρημένο (ADR-759 §Θ.1, emulator): η έγκριση σε ξένη/ανύπαρκτη εγγραφή τοπογραφικού
 * επέστρεφε `SURVEY_RECORD_UPDATE_FAILED` αντί για `SURVEY_RECORD_MISSING`, και ο φύλακας
 * `ownedOrNull` **δεν εκτελούνταν ποτέ** — τα 3.113 πράσινα tests δεν μπορούσαν να το δουν.
 *
 * ⚠️ **Ο έλεγχος γίνεται στον ΚΩΔΙΚΟ, ποτέ στο μήνυμα.** Το μήνυμα του emulator είναι
 * `"false for 'get' @ L21, evaluation error at L113:22 …"` — αριθμοί γραμμών του
 * `firestore.rules`, που αλλάζουν σε κάθε επεξεργασία του αρχείου. Ένα `includes('permission')`
 * θα ήταν φύλακας δεμένος στη μορφοποίηση ενός εργαλείου.
 */
export function isPermissionDeniedError(error: unknown): boolean {
  if (error === null || typeof error !== 'object') return false;
  return (error as { code?: unknown }).code === 'permission-denied';
}
