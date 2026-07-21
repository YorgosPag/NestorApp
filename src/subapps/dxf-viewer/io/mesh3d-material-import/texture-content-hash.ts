/**
 * texture-content-hash — ADR-678 Βήμα 3. SHA-256 (hex) των bytes μιας εικόνας-υφής,
 * για **content-hash dedup** των υλικών που δημιουργούνται αυτόματα κατά το round-trip
 * import ξένων υφών (C4D `<library_images>` → νέο `bmat_*`).
 *
 * Ίδια φωτογραφία-υφή (ίδια bytes) → ίδιο hash → reuse του υπάρχοντος `bmat_*` αντί για
 * διπλότυπο (Maxon «Save Project with Assets» / Revit appearance-asset dedup). Το hash
 * αποθηκεύεται στο `pbrTextures.albedoHash` του υλικού· ο import ελέγχει το live library
 * snapshot πριν φτιάξει νέο.
 *
 * **Native `crypto.subtle` — μηδέν dependency (N.5):** ο browser έχει Web Crypto· καμία
 * βιβλιοθήκη hashing. Επιστρέφει lowercase hex ώστε η σύγκριση να είναι case-insensitive
 * by construction.
 *
 * ⚠️ Boy-Scout (N.0.2): ~6 σημεία στο repo επαναλαμβάνουν το ίδιο
 * `crypto.subtle.digest('SHA-256', …)` → hex χωρίς κοινό SSoT (two-factor, sharing,
 * session-device, obligations, file-share, session-id-generator). Cross-cutting sweep →
 * flagged στο `.claude-rules/pending-ratchet-work.md` (global `sha256Hex` σε shared util).
 * Εδώ μένει ο dxf-viewer-scoped helper για το Βήμα 3.
 *
 * @see ./import-foreign-textures — ο καταναλωτής (dedup πριν το save)
 * @see docs/centralized-systems/reference/adrs/ADR-678-c4d-obj-material-roundtrip-import.md §Βήμα 3
 */

/** Μετατρέπει έναν `ArrayBuffer` digest σε lowercase hex string. */
function toHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let out = '';
  for (const b of bytes) out += b.toString(16).padStart(2, '0');
  return out;
}

/**
 * SHA-256 (lowercase hex) των bytes ενός `File`/`Blob`. Async (Web Crypto). Χρησιμοποιείται
 * ως σταθερή ταυτότητα περιεχομένου μιας υφής — ανεξάρτητη από το filename (ο συνεργάτης
 * μπορεί να μετονομάσει το αρχείο· τα bytes μένουν ίδια).
 */
export async function sha256HexOfFile(file: Blob): Promise<string> {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return toHex(digest);
}
