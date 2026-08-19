/**
 * @fileoverview **Η ΑΝΑΓΝΩΣΗ ΤΩΝ ΖΩΝΤΑΝΩΝ ΖΗΤΗΣΕΩΝ** — μία, για κάθε επίπεδο Γ.
 * @related ADR-777 §7 (Α9 · Α12) · SPEC-777A §14.2 · CLAUDE.md N.18 (jscpd) · N.0.2
 * @module services/demand/live-demands.reader
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ΓΙΑΤΙ ΥΠΑΡΧΕΙ — **εξήχθη πριν γραφτεί δεύτερη φορά, όχι μετά**
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το επίπεδο Γ έχει **δύο** καταναλωτές, και ρωτούν την **ίδια** ερώτηση από
 * **αντίθετη** μεριά:
 *
 * | Καταναλωτής | Υποκείμενο | Ακροατήριο |
 * |---|---|---|
 * | `/api/demand/competition` | ο **ζητών** — «πόσοι άλλοι ζητούν το ίδιο» | `area-market` |
 * | `/api/demand/interest` | ο **ιδιοκτήτης** — «πόσοι ζητούν το δικό μου» | `place-owner` |
 *
 * Και οι δύο χρειάζονται **τις ίδιες υποψήφιες**: όλες τις ζωντανές ζητήσεις, πάνω από
 * κάθε μισθωτή, με **όριο**. Γραμμένο δύο φορές, το ζευγάρι θα ήταν sibling clone —
 * ακριβώς το σχήμα που η **N.18** υπάρχει για να πιάσει, και το χειρότερο σημείο για
 * απόκλιση: αν η μία μεριά ξεχνούσε το `limit` ή το φίλτρο `lifecycle`, οι δύο αριθμοί
 * θα ήταν **ασύμβατοι** χωρίς κανείς να το δει.
 *
 * **Layering**: service — Admin SDK μόνο. Η **κρίση** ζει στο `lib/demand/`.
 */

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';
import { LIVE_DEMAND_LIFECYCLES, type PropertyDemand } from '@/types/property-demand';

const logger = createModuleLogger('demand/live-demands');

/**
 * 🔴 **Το ανώτατο πλήθος εγγράφων που διαβάζονται σε μία απάντηση.**
 *
 * Το ταίριασμα είναι **τομή ευρών**, δηλαδή δεν εκφράζεται ως ερώτημα Firestore:
 * απαιτεί ανάγνωση των υποψηφίων και κρίση στη μνήμη. Ένα ανοιχτό `.get()` θα ήταν
 * σωστό στις σημερινές δεκάδες ζητήσεις και **δομικά λάθος** στις δεκάδες χιλιάδες —
 * η **Α0** δεσμεύει *«μοντέλο για την τελική κλίμακα»*.
 */
export const MAX_DEMAND_CANDIDATES = 2_000;

/** Τι διαβάστηκε, **και αν ο αριθμός είναι πλήρης ή κάτω φράγμα**. */
export interface LiveDemandPool {
  readonly demands: readonly PropertyDemand[];
  /**
   * `true` όταν αγγίχθηκε το όριο ⇒ **κάθε πλήθος που προκύπτει είναι κάτω φράγμα**.
   *
   * ⚠️ **Ταξιδεύει, δεν μένει στο ημερολόγιο.** Ένα σιωπηλό κόψιμο δίνει αριθμό που
   * *φαίνεται* απάντηση και είναι **δείγμα** — το σχήμα «0 = κανείς δεν κοίταξε» με
   * άλλο νούμερο. Ο καλών οφείλει να αποφασίσει τι λέει στον άνθρωπο.
   */
  readonly truncated: boolean;
}

/**
 * **Όλες οι ζωντανές ζητήσεις, πάνω από κάθε μισθωτή.**
 *
 * @param label — ποιος ρωτά· μπαίνει στο ημερολόγιο ώστε ένα αγγιγμένο όριο να
 *   αποδίδεται στη διαδρομή που το αγγίζει
 */
export async function readLiveDemands(
  db: AdminFirestore,
  label: string,
): Promise<LiveDemandPool> {
  // tenant-scope-exempt: ΑΥΤΗ ΕΙΝΑΙ Η ΠΡΟΘΕΣΗ. Το επίπεδο Γ (SPEC-777A §14.2) ορίζεται
  // ως «ανώνυμο άθροισμα ΠΑΝΩ ΑΠΟ ΟΛΟΥΣ τους μισθωτές» — ένα ερώτημα φιλτραρισμένο
  // στον αιτούντα θα μετρούσε πάντα τους ΔΙΚΟΥΣ ΤΟΥ ανθρώπους, δηλαδή θα ήταν φρουρός
  // που ακυρώνει το χαρακτηριστικό. Η προστασία δεν είναι το φίλτρο μισθωτή· είναι
  // (α) το k-κατώφλι του ακροατηρίου, που εφαρμόζεται ΠΡΙΝ φύγει αριθμός, και
  // (β) ότι επιστρέφεται ΜΟΝΟ πλήθος — καμία ταυτότητα, κανένα κριτήριο (§12.7α).
  const snapshot = await db
    .collection(COLLECTIONS.PROPERTY_DEMANDS)
    // Στενεύει στα ζωντανά **στον διακομιστή**: οι υπόλοιπες δεν μετράνε ποτέ στο
    // άθροισμα (`demandExclusionReason` → `not-live`), οπότε το να ταξιδέψουν θα ήταν
    // ανάγνωση χωρίς καταναλωτή.
    .where('lifecycle', 'in', [...LIVE_DEMAND_LIFECYCLES])
    .limit(MAX_DEMAND_CANDIDATES)
    .get();

  const demands = snapshot.docs.map((entry) => entry.data() as PropertyDemand);
  const truncated = demands.length === MAX_DEMAND_CANDIDATES;

  if (truncated) {
    logger.warn('Το όριο υποψηφίων αγγίχθηκε — ο αριθμός είναι κάτω φράγμα', {
      data: { limit: String(MAX_DEMAND_CANDIDATES), caller: label },
    });
  }

  return { demands, truncated };
}
