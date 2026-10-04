/**
 * @fileoverview **Η ΕΤΙΚΕΤΑ ΣΥΝΔΕΣΗΣ ΑΡΧΕΙΟΥ** — `{entityType}:{entityId}` (`files.linkedTo[]`).
 * @module lib/files/file-link-tag
 *
 * Ένας κατασκευαστής για το λεξιλόγιο που μοιράζονται: ο γραφέας συνδέσεων (`services/file-record-links`),
 * ο συλλέκτης τεκμηρίων της υπόθεσης (`conveyance-evidence.server`) και το ευρετήριο εξαρτήσεων της
 * υπόθεσης (ADR-905 §6). Ζούσε inline σε τέσσερα σημεία — μια αλλαγή μορφής σε ένα θα έκοβε σιωπηλά
 * τη σύνδεση στα άλλα (κανένα ερώτημα δεν «αποτυγχάνει», απλώς δεν βρίσκει τίποτα).
 *
 * **Layering**: leaf — καμία εισαγωγή.
 */

/** Η ετικέτα μιας οντότητας στο `linkedTo` ενός αρχείου. */
export function fileLinkTag(entityType: string, entityId: string): string {
  return `${entityType}:${entityId}`;
}
