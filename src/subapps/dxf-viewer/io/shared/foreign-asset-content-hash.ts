/**
 * SSoT — **ταυτότητα ΠΕΡΙΕΧΟΜΕΝΟΥ ενός ξένου asset**: SHA-256 (hex) των bytes του.
 *
 * Κάθε μονοπάτι εισαγωγής ξένων αρχείων ρωτά το ίδιο πράγμα: «το έχω ήδη αυτό;». Η **μόνη**
 * αξιόπιστη απάντηση είναι τα bytes — όχι το όνομα (ο συνεργάτης μετονομάζει), όχι η διαδρομή
 * (ο φάκελος μετακινείται). Δύο καταναλωτές, μία απάντηση:
 *   · **ADR-678 Βήμα 3** — υφές C4D/COLLADA: ίδια εικόνα ⇒ reuse του `bmat_*` αντί για διπλότυπο.
 *   · **ADR-736 Φ3** — συνημμένα DXF: ίδιο διάταγμα ⇒ **ένα** ανέβασμα για όλο το γραφείο.
 *
 * 💡 **Γιατί περιεχόμενο και όχι διαδρομή (πιο έξυπνο από τους μεγάλους):** ο Revit ταυτοποιεί
 * έναν σύνδεσμο με τη **διαδρομή** του — γι' αυτό σπάει μόλις μετακινηθεί ο φάκελος. Με
 * ταυτότητα περιεχομένου, το ίδιο υπόβαθρο ανεβαίνει **μία φορά** και επανασυνδέεται **μόνο
 * του** σε κάθε επόμενο έργο του ίδιου τοπογράφου.
 *
 * **Native `crypto.subtle` — μηδέν dependency (N.5):** ο browser έχει Web Crypto· καμία
 * βιβλιοθήκη hashing. Επιστρέφει lowercase hex ώστε η σύγκριση να είναι case-insensitive
 * by construction.
 *
 * ⚠️ **Δεν είναι ακόμη το καθολικό SSoT του repo.** ~12 σημεία σε **δύο περιβάλλοντα**
 * επαναλαμβάνουν SHA-256 (async `crypto.subtle` σε browser, sync `createHash` σε Node).
 * Η ενοποίησή τους είναι cross-cutting sweep (>4 αρχεία, 2 domains) ⇒ **ΟΧΙ inline** (N.0.2)·
 * παραμένει καταγεγραμμένη στο `.claude-rules/pending-ratchet-work.md`. Αυτό εδώ είναι το
 * **σκόπιμα περιορισμένο** SSoT του dxf-viewer: μετακινήθηκε από το `io/mesh3d-material-import/`
 * στο `io/shared/` (ADR-736 Φ3) όταν απέκτησε **δεύτερο** καταναλωτή εκτός mesh3d — δίπλα στο
 * `foreign-asset-basename.ts`, που απαντά την **αδελφή** ερώτηση («ίδιο ΟΝΟΜΑ;»).
 *
 * @see ./foreign-asset-basename.ts — η ταυτότητα ΟΝΟΜΑΤΟΣ (το άλλο μισό της ταύτισης)
 * @see io/mesh3d-material-import/import-foreign-textures.ts — καταναλωτής (υφές)
 * @see io/dxf-external-reference-resolver.ts — καταναλωτής (συνημμένα DXF)
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
