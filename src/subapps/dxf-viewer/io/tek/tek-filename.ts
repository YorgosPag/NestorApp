/**
 * ADR-526 — pure Tekton filename predicate (SSoT).
 *
 * Εξαγμένο από το `tek-import.ts` ώστε καταναλωτές που χρειάζονται ΜΟΝΟ τον έλεγχο
 * ονόματος (π.χ. ο generic `useFloorplanUpload` / το upload-wizard validation) να ΜΗΝ
 * σέρνουν τον βαρύ tek importer (`parseTekScene`/`buildSceneFromTekScene`) στο bundle τους.
 * Το `tek-import.ts` κάνει re-export → μηδέν διπλότυπο, τα υπάρχοντα import sites αμετάβλητα.
 */

/** Αναγνωρίζει `.tek` / `.tek.txt` ονόματα αρχείων (case-insensitive). */
export function isTekFileName(name: string): boolean {
  return /\.tek(\.txt)?$/i.test(name.trim());
}
