/**
 * @fileoverview **ΑΠΟ ΠΟΤΕ ΕΛΕΥΘΕΡΩΝΕΤΑΙ;** — ο ορίζοντας μιας άρνησης, ως ημερομηνία.
 * @related ADR-832 §4 · ADR-835 §4.5 · lib/occupancy/occupancy-conflict.ts ·
 *   lib/mandate/mandate-occupancy-notice.ts · lib/stay/stay-availability.ts
 * @module lib/occupancy/occupancy-horizon
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΜΕΤΑΚΟΜΙΣΕ ΕΔΩ (ADR-835 Φ3) — ΗΤΑΝ ΓΕΝΙΚΟΣ ΚΑΝΟΝΑΣ ΣΕ ΕΝΑ ΣΠΙΤΙ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το {@link earliestFreeStart} ζούσε στο `lib/mandate/mandate-occupancy-notice.ts`.
 * Δεν διάβαζε **τίποτα** από τον τομέα των εντολών: διάβαζε `conflict.reason` και
 * `conflict.with.expiresAt` — **δύο πεδία του ίδιου του κριτή**. Δεμένο σε έναν τομέα
 * μόνο από τον **τύπο** του, δηλαδή δεμένο **κατά λάθος**.
 *
 * Ο δεύτερος καταναλωτής το ζήτησε **αυτούσιο**: ο επισκέπτης που ρωτά «*10–17/08*»
 * και βρίσκει κράτηση 12–14/08 δικαιούται να μάθει «*ελεύθερο από 14/08*» — ίδιο
 * ερώτημα, ίδιος υπολογισμός, άλλη πηγή. Μια δεύτερη γραφή εκεί θα ήταν **δίδυμο** που
 * το `ssot:discover` (name-based) **δεν βλέπει** και το jscpd θα κατήγγειλε αργότερα.
 *
 * ⚠️ **ΜΕΤΑΚΟΜΙΣΗ, ΟΧΙ ΑΝΤΙΓΡΑΦΗ** (κανόνας 19: *μετακινούμε καταναλωτές, όχι
 * αρχεία*): το `mandate-occupancy-notice.ts` **εισάγει και επανεξάγει** — καμία
 * υπάρχουσα εισαγωγή δεν σπάει, καμία υπάρχουσα άγκυρα δεν αλλάζει.
 *
 * **Layering**: leaf — καθαρές συναρτήσεις, μηδέν I/O, μηδέν ρολόι.
 */

import {
  EXISTING_IS_EXCLUSIVE,
  type OccupancyConflict,
} from './occupancy-conflict';

/**
 * 🏆 **ΑΠΟ ΠΟΤΕ ΕΙΝΑΙ ΕΛΕΥΘΕΡΟΣ Ο ΠΟΡΟΣ;** — `null` όταν η αναμονή δεν βοηθά.
 *
 * ⚠️ **Μόνο οι συγκρούσεις τύπου {@link EXISTING_IS_EXCLUSIVE} έχουν ημερομηνία.**
 * Όταν ο **υποψήφιος** είναι ο αποκλειστικός (`candidate-is-exclusive`), το εμπόδιο
 * δεν είναι ο χρόνος αλλά η **αξίωση**: ο άνθρωπος λύνει το πρόβλημα ζητώντας
 * **απλή** εντολή, ή αποσύροντας τις υπάρχουσες — και μια ημερομηνία εκεί θα του
 * έλεγε να **περιμένει άδικα**.
 *
 * ⚠️ **`Infinity` μέσω `null`**: κατάληψη **ανοιχτής** διάρκειας δεν ελευθερώνεται
 * ποτέ, άρα καταπίνει το μέγιστο. Ένα `?? 0` εδώ θα έβγαζε ημερομηνία στο παρελθόν —
 * δηλαδή θα υποσχόταν διαθεσιμότητα που δεν υπάρχει.
 *
 * 🔑 **Γενικό σε `TSource`, όπως ο κριτής**: δεν ρωτά **τι** είναι η κατάληψη, μόνο
 * **ως πότε** κρατά. Στις **κρατήσεις** παράγεται πάντα ο πρώτος λόγος (και οι δύο
 * πλευρές `exclusive`), άρα εκεί η ημερομηνία υπάρχει σχεδόν πάντα· στις **εντολές**
 * μπορεί να λείπει, και η απουσία είναι **πληροφορία**.
 */
export function earliestFreeStart<TSource>(
  conflicts: readonly OccupancyConflict<TSource>[],
): string | null {
  const waitable = conflicts.filter((conflict) => conflict.reason === EXISTING_IS_EXCLUSIVE);
  if (waitable.length === 0) return null;

  let latest: string | null = null;
  for (const conflict of waitable) {
    const until = conflict.with.expiresAt;
    // 🔴 Ανοιχτή διάρκεια ⇒ **καμία** ημερομηνία, και τερματίζουμε: κανένα άλλο
    //    σκέλος δεν μπορεί να τη φέρει πίσω.
    if (until === null) return null;
    if (Number.isNaN(Date.parse(until))) return null;
    if (latest === null || Date.parse(until) > Date.parse(latest)) latest = until;
  }
  return latest;
}
