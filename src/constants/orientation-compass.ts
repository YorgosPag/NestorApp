/**
 * @fileoverview **ΔΙΑΤΑΞΗ ΤΗΣ ΠΥΞΙΔΑΣ 3×3** — πού κάθεται κάθε προσανατολισμός στο πλέγμα (Βορράς πάνω).
 * @related ADR-937 · ADR-287 · components/properties/shared/OrientationCompassGrid (επεξεργασία) ·
 *   components/listing-detail/ListingSunExposure (ανάγνωση στη δημόσια αγγελία)
 * @module constants/orientation-compass
 *
 * 🔑 Μόνο η **χωρική** πληροφορία ζει εδώ — οι τιμές έρχονται από το `Orientation` (η ρίζα του λεξιλογίου).
 *    Δύο πυξίδες (φόρμα + αγγελία) διαβάζουν την ίδια διάταξη, ώστε να μη μπορούν να διαφωνήσουν.
 */

import { Orientation, type OrientationType } from '@/constants/property-features-enterprise';

/** Γραμμή-γραμμή, Βορράς πάνω. `null` = το κέντρο (το σύμβολο της πυξίδας, όχι κατεύθυνση). */
export const COMPASS_GRID_LAYOUT: readonly (OrientationType | null)[] = [
  Orientation.NW, Orientation.N, Orientation.NE,
  Orientation.W, null, Orientation.E,
  Orientation.SW, Orientation.S, Orientation.SE,
];
