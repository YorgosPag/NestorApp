/**
 * Static ΑΤΟΕ fallback — ο κατάλογος κατηγοριών όταν η Firestore δεν δίνει
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΓΙΑΤΙ ΚΕΝΤΡΙΚΟΠΟΙΗΘΗΚΕ (N.0.2, ADR-734 Φάση 3)
 * ─────────────────────────────────────────────────────────────────────────────
 * Η ίδια αντιστοίχιση `ATOE_MASTER_CATEGORIES → BOQCategory[]` ήταν γραμμένη
 * **δύο φορές μέσα στο ίδιο** `boq-repository.ts` (μία για «κενή συλλογή», μία
 * για «σφάλμα ανάγνωσης»), και το admin-SDK μονοπάτι του πράκτορα θα ήταν το
 * τρίτο αντίγραφο. Τρία αντίγραφα μιας αντιστοίχισης 13 πεδίων = βεβαιότητα
 * απόκλισης.
 *
 * ⚠️ **ΣΗΜΑΣΙΟΛΟΓΙΚΗ ΠΡΟΕΙΔΟΠΟΙΗΣΗ — διαβάζεται πριν χρησιμοποιηθεί.**
 * Το `getCategories()` επιστρέφει αυτόν τον κατάλογο **και όταν πετύχει με κενή
 * συλλογή, και όταν αποτύχει η ανάγνωση**. Δηλαδή μη κενό αποτέλεσμα **δεν
 * αποδεικνύει** ότι η Firestore απάντησε. Για πράκτορα που παρουσιάζει αριθμούς
 * προς υπογραφή η διάκριση μετράει (ADR-734 §7.2 #2, ίδια κατηγορία αστοχίας με
 * το διπλό νόημα του `null` στο `getBuildingSummary`).
 *
 * Τα `id` έχουν πρόθεμα `static_` **ακριβώς** γι' αυτόν τον λόγο: είναι το
 * ορατό σήμα ότι η γραμμή δεν προέρχεται από έγγραφο.
 *
 * @module services/measurements/boq-atoe-fallback
 * @see ADR-175 (BOQ) · ADR-734 §8.3
 */

import { ATOE_MASTER_CATEGORIES } from '@/config/boq-categories';
import { nowISO } from '@/lib/date-local';
import type { BOQCategory } from '@/types/boq';

/** Πρόθεμα id που δηλώνει «δεν προήλθε από έγγραφο Firestore». */
export const STATIC_CATEGORY_ID_PREFIX = 'static_';

/** Ο master κατάλογος ΑΤΟΕ ως `BOQCategory[]` για τον δοσμένο tenant. */
export function buildStaticAtoeCategories(companyId: string): BOQCategory[] {
  const now = nowISO();
  return ATOE_MASTER_CATEGORIES.map((category) => ({
    id: `${STATIC_CATEGORY_ID_PREFIX}${category.code}`,
    companyId,
    code: category.code,
    nameEL: category.nameEL,
    nameEN: category.nameEN,
    description: category.description,
    level: category.level,
    parentId: null,
    sortOrder: category.sortOrder,
    defaultWasteFactor: category.defaultWasteFactor,
    allowedUnits: [...category.allowedUnits],
    isActive: true,
    createdAt: now,
    updatedAt: now,
  }));
}
