/**
 * @fileoverview **Ο ΡΥΘΜΟΣ ΤΟΥ ΞΑΝΑΨΗΣΙΜΑΤΟΣ ΜΕΤΑ ΑΠΟ ΑΛΛΑΓΗ ΣΥΝΤΑΓΗΣ** — καθαρό, χωρίς I/O (ADR-920 §14.9 Γ · ADR-845 §7.17 Α5).
 * @related services/listings/listing-media-reconciliation.service (ο μόνος καλών)
 * @module lib/listings/listing-recipe-backfill
 *
 * 🔑 Μια αλλαγή συνταγής (νέα αναθεώρηση builder, νέα ποιότητα εικόνας …) κάνει «παλιές» **όλες** τις αγγελίες με τέτοιο
 * υλικό την **ίδια** νύχτα. Είναι αναμενόμενη, όχι «πόρτα που ξέφυγε», και δεν χρειάζεται να διορθωθεί σε ένα πέρασμα.
 * Η πρακτική των μεγάλων είναι backfill σε **παρτίδες με ρυθμό** (GitLab batched background migrations · Mapbox MTS
 * incremental publish), όχι μονορούφι που κρατά τη CPU του server μία ολόκληρη νύχτα.
 *
 * 🏆 **Πέρα από το σκέτο «τα πρώτα Ν»: παράθυρο που ΚΥΛΑ.** Με σταθερό «τα πρώτα Ν», αγγελίες που αποτυγχάνουν **μόνιμα**
 * (π.χ. χαλασμένη πηγή) θα έπιαναν τις ίδιες θέσεις κάθε βράδυ και θα σταματούσαν όλες τις άλλες (head-of-line
 * blocking). Το παράθυρο ξεκινά κάθε πέρασμα σε άλλη θέση (`runIndex × όριο`, κυκλικά), άρα κάθε υποψήφια περνά
 * σε πεπερασμένο αριθμό νυχτών, ό,τι κι αν αποτυγχάνει. Οι επιτυχημένες γίνονται `current` και φεύγουν από τη λίστα.
 */

/**
 * **Πόσες αγγελίες ξαναψήνονται ανά πέρασμα λόγω ΜΟΝΟ αλλαγής συνταγής.** Οι αποκλίσεις υλικού («πόρτα που ξέφυγε»,
 * αγγελία που λείπει) **δεν** μετρούν εδώ: αυτές διορθώνονται πάντα, όλες. 25 ⇒ ως ~750 αγγελίες τον μήνα, με σειριακή
 * επαναπροβολή (ίδια πολιτική κόστους με την επανασύνθεση).
 */
export const LISTING_RECIPE_BACKFILL_PER_RUN = 25;

/** Μία μέρα σε ms — το βραδινό πέρασμα τρέχει μία φορά τη μέρα, άρα η μέρα είναι ο αριθμός του περάσματος. */
const DAY_MS = 86_400_000;

/** Ο αριθμός του περάσματος για αυτή τη στιγμή: ο αύξων αριθμός της μέρας (UTC). */
export function recipeBackfillRunIndex(nowMs: number): number {
  return Math.floor(nowMs / DAY_MS);
}

/**
 * **Ποιες από τις υποψήφιες ξαναψήνονται σε ΑΥΤΟ το πέρασμα** — ως `limit`, συνεχόμενες κυκλικά από τη θέση
 * `runIndex × limit`. Ντετερμινιστικό: ίδια είσοδος ⇒ ίδιο παράθυρο. Λιγότερες από το όριο ⇒ όλες.
 */
export function recipeBackfillWindow<T>(candidates: readonly T[], limit: number, runIndex: number): readonly T[] {
  const count = candidates.length;
  if (count <= limit) return candidates;
  if (!(limit > 0)) return [];
  const start = (((runIndex * limit) % count) + count) % count;
  return Array.from({ length: limit }, (_, offset) => candidates[(start + offset) % count]);
}
