/**
 * @fileoverview **Η ΔΙΕΥΘΥΝΣΗ ΤΩΝ ΜΕΣΩΝ ΜΙΑΣ ΠΕΡΙΗΓΗΣΗΣ** — από τμήματα URL σε αντικείμενο του ιδιωτικού κάδου (ADR-884 Κ3β).
 * @related `app/api/spatial-tours/[kind]/[subjectId]/media/[...path]` (ο αναγνώστης) · ο ψήστης της Φ2 (ο γραφέας) ·
 *   `lib/storage/storage-path-custody.ts` (`tour-tiles` = server-only)
 * @module lib/spatial-tour/tour-media-path
 *
 * 🔒 **Λίστα επιτρεπτών, όχι λίστα απαγορεύσεων**: κάθε τμήμα είναι `[A-Za-z0-9._-]`, δεν ξεκινά με τελεία και έχει
 * όριο μήκους/βάθους. Το `..`, το `%2e%2e`, το `\`, κενά και χαρακτήρες ελέγχου **δεν μπορούν** να σχηματιστούν — η
 * διαδρομή δεν βγαίνει ποτέ από το `tour-tiles/{tourId}/`, όποιο κι αν είναι το URL.
 *
 * 🔑 Το `tourId` **δεν** έρχεται από το URL: παράγεται από τη ρίζα (ντετερμινιστικό) — ο πελάτης δεν διαλέγει ποτέ
 * σε ποια περιήγηση διαβάζει.
 *
 * **Layering**: leaf — καθαρή.
 */

/** Η ρίζα των πλακιδίων στον ιδιωτικό κάδο — μία δήλωση (τη διαβάζει και ο κριτής φύλαξης). */
export const TOUR_TILES_ROOT = 'tour-tiles';

const SEGMENT = /^[A-Za-z0-9_-][A-Za-z0-9._-]{0,127}$/;
const MAX_DEPTH = 8;

/** Τμήματα → αντικείμενο, ή `null` όταν **οποιοδήποτε** τμήμα δεν είναι στη λίστα επιτρεπτών. */
export function tourMediaObjectPath(tourId: string, segments: readonly string[]): string | null {
  if (segments.length === 0 || segments.length > MAX_DEPTH) return null;
  if (!SEGMENT.test(tourId) || !segments.every((segment) => SEGMENT.test(segment))) return null;
  return `${TOUR_TILES_ROOT}/${tourId}/${segments.join('/')}`;
}
