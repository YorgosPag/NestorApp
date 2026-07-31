/**
 * =============================================================================
 * resolveProcurementErrorStatus — SSoT for procurement error→HTTP-status mapping
 * =============================================================================
 *
 * The procurement mutation routes (materials + framework-agreements, and their
 * `[id]` detail routes) each re-implemented the SAME `errorStatus` heuristic:
 * map a thrown service error to an HTTP status by its `name` (conflict /
 * validation) plus message substrings, with a route-family-specific fallback.
 *
 * This is that logic, once. It preserves the two DISTINCT behaviours the routes
 * had (byte-identical), selected via `mode`:
 *
 *  - `create`   (list-route POST): conflict→409, validation→400, else→**500**.
 *               Does NOT inspect the message. A bad-JSON `SyntaxError` → 500.
 *  - `mutation` (detail PATCH/DELETE): conflict→409, validation→400,
 *               message `not found`→404, `Forbidden`→403, else→**400**.
 *
 * `conflictName`/`validationName` are OPTIONAL: the RFQ-line and sourcing-event
 * mutation routes have no named conflict/validation error — they map purely on
 * message (`not found`→404, `Forbidden`→403, else→400), which is byte-identical
 * to their previous local `errorStatus` helper. When a name is `undefined` the
 * `error.name === name` guard is `false`, so the check is safely skipped
 * (backward-compatible with the material/framework-agreement callers).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠️ ΚΛΗΡΟΝΟΜΗΜΕΝΗ ΕΥΡΕΤΙΚΗ — ΔΕΝ ΕΙΝΑΙ ΠΛΕΟΝ Η ΠΡΩΤΗ ΛΕΞΗ (ADR-742 Ομάδα 2)
 * ─────────────────────────────────────────────────────────────────────────────
 * Το `msg.includes('Forbidden')` **ήταν έλεγχος πρόσβασης γραμμένος σε πεζά
 * γράμματα**: μια αθώα αλλαγή διατύπωσης σε μήνυμα υπηρεσίας θα μετέτρεπε
 * σιωπηλά την άρνηση ασφαλείας σε `400` — το ίδιο σφάλμα που εξάλειψε η Φάση Β
 * στο DXF (ADR-742 §7.4). Οι επτά υπηρεσίες προμηθειών ρίχνουν πλέον
 * **τυποποιημένα** σφάλματα (`ProcurementCrossTenantError` /
 * `ProcurementNotFoundError`) και τα πιάνει με `instanceof` το
 * `resolveProcurementErrorOutcome` — **πριν** φτάσει εδώ.
 *
 * Αυτή η συνάρτηση μένει για τα σφάλματα **άλλων** υπηρεσιών που περνούν από τα
 * ίδια routes (comparison, vendor-invite, PO) και εξακολουθούν να ρίχνουν σκέτα
 * `Error`. Είναι **fallback, όχι πολιτική**. Όταν μεταναστεύσουν και αυτές, ο
 * κλάδος `Forbidden` φεύγει· ο κλάδος `not found` είναι ακίνδυνος (το `404`
 * είναι η σιωπηλή απάντηση, δεν μαρτυρά τίποτα).
 *
 * @module app/api/procurement/_shared/error-status
 * @see ADR-603 API Route-Handler Factory SSoT · ADR-742 §7.4 (το string-matching ως έλεγχος πρόσβασης)
 */

export interface ProcurementErrorStatusOptions {
  /** `error.name` that maps to 409 Conflict (e.g. `MaterialCodeConflictError`). */
  conflictName?: string;
  /** `error.name` that maps to 400 Bad Request (e.g. `MaterialValidationError`). */
  validationName?: string;
  /** Route family — decides message-inspection + fallback. */
  mode: 'create' | 'mutation';
}

export function resolveProcurementErrorStatus(
  error: unknown,
  { conflictName, validationName, mode }: ProcurementErrorStatusOptions,
): number {
  if (error instanceof Error) {
    if (error.name === conflictName) return 409;
    if (error.name === validationName) return 400;
    if (mode === 'mutation') {
      // 🔴 Ο κλάδος `msg.includes('Forbidden') → 403` **αφαιρέθηκε** (ADR-742,
      // Ομάδα 2). Μετά τη μετανάστευση των επτά υπηρεσιών, ο κώδικας έχει
      // **μηδέν** παραγωγούς σκέτου `throw new Error('Forbidden')` — ο κλάδος
      // ήταν νεκρός **και** επικίνδυνος: όποιος έγραφε ξανά τη λέξη σε
      // οποιοδήποτε μήνυμα θα έπαιρνε ρητό 403 και θα ξανάνοιγε το μαντείο
      // ύπαρξης, παρακάμπτοντας τον κανόνα αποκάλυψης (§7.4).
      //
      // Ο κλάδος «not found» μένει: το 404 **είναι** η σιωπηλή απάντηση, δεν
      // μαρτυρά τίποτα, και τον χρειάζονται ακόμη οι υπηρεσίες που δεν έχουν
      // μεταναστεύσει (comparison / vendor-invite / PO).
      if (error.message.includes('not found')) return 404;
    }
  }
  return mode === 'mutation' ? 400 : 500;
}
