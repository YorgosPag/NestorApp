/**
 * 📜 Η θέση μιας διεύθυνσης, **όπως γράφεται στο ιστορικό** — ADR-195 · ADR-332 D29
 *
 * 🔑 **ΕΝΑ σημείο** για άνθρωπο και μηχανή: το σύρσιμο της πινέζας (PATCH έργου/κτιρίου) και η
 * ολοκλήρωση θέσης της μηχανής (`address-position-completion.ts`) περνούν **και τα δύο** από τη
 * μηχανή διαφορών, και αυτή ρωτά **εδώ** πώς λέγεται μια θέση. Δεύτερος μορφοποιητής θα έκανε την
 * ίδια θέση να διαβάζεται αλλιώς ανάλογα με το ποιος την έγραψε — και η σύμπτυξη συνεδρίας
 * (`coalesce-edit-sessions.ts`) θα έβλεπε «αλλαγή» εκεί όπου δεν υπάρχει.
 *
 * @module lib/audit/audit-coordinates
 */

import type { AuditSubFieldProjector } from './tracked-field-def';

/** Δεκαδικά της συντεταγμένης στο ιστορικό: 5 ≈ 1 μ. — όσο χρειάζεται άνθρωπος για να τη συγκρίνει. */
const AUDIT_COORDINATE_DECIMALS = 5;

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** `"40.64030, 22.94440"` — ή `null` όταν το στοιχείο δεν έχει (πλήρη) θέση. */
export const formatAuditCoordinates: AuditSubFieldProjector = (item) => {
  const coordinates = item.coordinates;
  if (typeof coordinates !== 'object' || coordinates === null) return null;
  const point = coordinates as Readonly<Record<string, unknown>>;
  const lat = finiteNumber(point.lat);
  const lng = finiteNumber(point.lng);
  if (lat === null || lng === null) return null;
  return `${lat.toFixed(AUDIT_COORDINATE_DECIMALS)}, ${lng.toFixed(AUDIT_COORDINATE_DECIMALS)}`;
};
