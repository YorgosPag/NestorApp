/**
 * SSoT — το κλειδί της ανάγνωσης κάτοψης (ADR-929 Δ11): «έχει ήδη διαβαστεί αυτή η εικόνα, με αυτό το
 * μοντέλο και αυτό το σχήμα;»
 *
 * 🔑 Το κλειδί **είναι** η ταυτότητα του εγγράφου ανάγνωσης: ο σπόρος του
 * `generateDeterministicPlanReadingId(companyId, key)`. Ίδιο κλειδί ⇒ ίδιο έγγραφο ⇒ η επανεκτέλεση
 * διαβάζει την κρυφή μνήμη αντί να πληρώσει νέα κλήση VLM (Δ16 #1: καταγράφεται με κόστος 0). Μία
 * σύνθεση, εδώ. Αν ο πελάτης και ο διακομιστής το συνέθεταν χωριστά, η πρώτη διαφορά (π.χ. σειρά πεδίων)
 * θα πλήρωνε κάθε ανάγνωση δύο φορές χωρίς να το δει κανείς.
 *
 * ⚠️ **Τα μέρη κωδικοποιούνται** (`encodeURIComponent`) πριν ενωθούν. Το όνομα μοντέλου ή ένα hash που
 * περιέχει τον διαχωριστή δεν μπορεί ποτέ να κάνει δύο διαφορετικές αναγνώσεις να συμπέσουν σε ένα
 * κλειδί.
 *
 * @module subapps/dxf-viewer/bim/plan-recognition/plan-reading-key
 */

export interface PlanReadingKeyParts {
  readonly fileId: string;
  /** Σελίδα PDF με αρίθμηση από 1· για εικόνα πάντα 1. */
  readonly pageNumber: number;
  /**
   * Hash του **τι στάλθηκε πραγματικά**: τα bytes της όψης (μετά την αποκοπή πινακίδας, Δ15 #4-5) **και** ο πίνακας
   * τμημάτων. Η ίδια εικόνα με άλλα τμήματα της Φ2 είναι άλλη ερώτηση: η παλιά απάντηση θα έδειχνε σε IDs που δεν
   * υπάρχουν πια. Το υπολογίζει ο διακομιστής από ό,τι έλαβε (`plan-reading-input-hash`), ποτέ ο πελάτης.
   */
  readonly inputHash: string;
  /** Το μοντέλο της OpenAI (§9.1). */
  readonly model: string;
  /** Έκδοση prompt + σχήματος JSON (Δ5). */
  readonly schemaVersion: number;
}

const SEPARATOR = '|';

function assertPart(name: string, value: string): void {
  if (value.trim() === '') throw new Error(`planReadingKey: empty ${name}`);
}

function assertPositiveInteger(name: string, value: number): void {
  if (!Number.isInteger(value) || value < 1) throw new Error(`planReadingKey: ${name} must be an integer ≥ 1`);
}

/**
 * Το κλειδί, ή **σφάλμα**: ένα κενό μέρος θα έκανε όλες τις αναγνώσεις χωρίς αυτό το μέρος να μοιράζονται
 * ένα έγγραφο. Ο καλών είναι κώδικας του έργου, όχι είσοδος χρήστη, άρα ένα κενό εδώ είναι σφάλμα
 * προγραμματισμού και πρέπει να φανεί αμέσως.
 */
export function planReadingKey(parts: PlanReadingKeyParts): string {
  assertPart('fileId', parts.fileId);
  assertPart('inputHash', parts.inputHash);
  assertPart('model', parts.model);
  assertPositiveInteger('pageNumber', parts.pageNumber);
  assertPositiveInteger('schemaVersion', parts.schemaVersion);
  return [parts.fileId, parts.pageNumber, parts.inputHash, parts.model, parts.schemaVersion]
    .map((p) => encodeURIComponent(String(p)))
    .join(SEPARATOR);
}
