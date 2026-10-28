/**
 * @fileoverview **Το σύνορο ενός εγγράφου-σήματος όψης: μόνο ο αριθμός** (ADR-901 §14.8 · ADR-905 §2).
 * @related services/realtime/hooks/use-server-view-signal.ts (ο καταναλωτής — `revisionOf`)
 * @module services/realtime/view-signal-revision
 *
 * 🔑 **Ένας ορισμός για κάθε τομέα με σήματα όψεων** (υποθέσεις μεταβίβασης · τιμές καταλόγου): ό,τι άλλο κι αν έγραφε
 *    κάποτε το έγγραφο, δεν διαβάζεται — το σήμα δίνει **χρονισμό**, ποτέ περιεχόμενο. Ως το ADR-923 «3δ» ζούσε στο
 *    `lib/conveyance`, και ο δεύτερος τομέας θα το αντέγραφε.
 */

/** Ο αριθμός αναθεώρησης του σήματος, ή `null` αν το έγγραφο δεν έχει έγκυρο αριθμό. */
export function viewSignalRevisionOf(raw: unknown): number | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const revision = (raw as { readonly revision?: unknown }).revision;
  return typeof revision === 'number' && Number.isFinite(revision) ? revision : null;
}
