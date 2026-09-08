/**
 * @fileoverview 🏆 **ΞΑΝΑΦΤΙΑΞΕ ΟΛΑ ΤΑ ΣΗΜΑΤΑ** — η βελτίωση φτάνει σε όλους, χωρίς να
 *   ενοχληθεί κανείς (ADR-841 §7 Α21.12).
 * @related ADR-841 §7 Α21.12 · Α21.10 · services/mandate/showcase-mark-source ·
 *   services/listings/rebuild-public-listings.service *(το αδελφό ιδίωμα)*
 * @module services/mandate/rebuild-showcase-marks.service
 *
 * ════════════════════════════════════════════════════════════════════════════
 * 🔴 ΓΙΑΤΙ ΧΡΕΙΑΖΕΤΑΙ ΚΑΝ — ΤΟ ΠΡΟΒΛΗΜΑ ΠΟΥ ΜΕΤΡΗΘΗΚΕ
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Η **Α21.10** άλλαξε τον τρόπο παραγωγής των σημάτων. Τα ήδη δημοσιευμένα **δεν
 * μπορούσαν να την πάρουν**: ο γραφέας ξαναδιαβάζει το πρωτότυπο, και το μονοπάτι του
 * δεν το κρατούσε κανείς. Ο μόνος δρόμος ήταν *«ξαναδιάλεξε το αρχείο σου»* — **N
 * άνθρωποι για N σήματα**.
 *
 * Με τη σημείωση της **Α21.12** ο δρόμος γίνεται **ένα κουμπί**.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * 🔴 ΚΑΙ ΤΟ ΚΡΙΣΙΜΟ: **ΞΑΝΑΠΕΡΝΑΕΙ ΑΠΟ ΤΟΝ ΦΡΟΥΡΟ, ΔΕΝ ΤΟΝ ΠΡΟΣΠΕΡΝΑ**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Καλεί το {@link publishShowcaseMark} — **την ίδια** δημόσια είσοδο που χρησιμοποιεί το
 * αίτημα του ανθρώπου. Άρα ο `markSourceForCompany` κρίνει **ξανά** ότι το μονοπάτι
 * ανήκει σε **αυτήν** την εταιρεία, ο καθαριστής τρέχει **ξανά**, και το κλειδί
 * παραμένει το sha256 της **σημερινής** εξόδου.
 *
 * ⛔ **Η «γρήγορη» εναλλακτική απορρίφθηκε**: να διαβαστεί το πρωτότυπο και να γραφτεί
 * κατευθείαν στο ράφι. Θα ήταν **δεύτερη διαδρομή δημοσίευσης**, με δικούς της φρουρούς
 * — δηλαδή ένα σημείο όπου ξένο μονοπάτι θα μπορούσε να γίνει δημόσιο σήμα χωρίς να το
 * κρίνει κανείς. Μία μηχανή, μία κρίση.
 *
 * 🔑 **Ιδεμποτεντικό δωρεάν**: αν τα bytes δεν αλλάξουν, το ράφι είναι
 * content-addressed ⇒ **ίδιο κλειδί ⇒ καμία εγγραφή**. Δεύτερη εκτέλεση δεν κοστίζει
 * τίποτα και δεν αλλάζει τίποτα.
 *
 * ⚠️ **SERVER-ONLY**: σέρνει `sharp` + Admin SDK μέσω του γραφέα.
 */

import 'server-only';

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { createModuleLogger } from '@/lib/telemetry';
import { listShowcaseMarkSources } from '@/services/mandate/showcase-mark-source';
import { publishShowcaseMark } from '@/services/mandate/showcase-mark-publication';

const logger = createModuleLogger('rebuild-showcase-marks');

/** Τι απέγινε κάθε καταγεγραμμένη προέλευση — **ονομαστικά**, ποτέ σιωπηλά. */
export interface RebuildShowcaseMarksReport {
  /** Πόσες σημειώσεις βρέθηκαν συνολικά. */
  readonly found: number;
  /** Πόσα σήματα ξαναδημοσιεύτηκαν *(ή επιβεβαιώθηκαν ως ήδη σωστά)*. */
  readonly republished: number;
  /**
   * Πόσα **απορρίφθηκαν** — και ο λόγος ζει στο ημερολόγιο.
   *
   * ⚠️ Δεν είναι σφάλμα του εργαλείου: το πιο πιθανό είναι ότι το πρωτότυπο **σβήστηκε**
   * από τον ιδιωτικό κάδο μετά τη δημοσίευση. Το δημοσιευμένο σήμα **μένει** ως έχει.
   */
  readonly refused: number;
  /** Στεγνή εκτέλεση: μετρήθηκαν, **δεν** γράφτηκε τίποτα. */
  readonly dryRun: boolean;
}

/**
 * **Ξαναδημοσίευσε κάθε σήμα που ξέρουμε από πού ήρθε.**
 *
 * ⚠️ **ΣΕΙΡΙΑΚΑ, επίτηδες.** Κάθε επανάληψη κατεβάζει ένα πρωτότυπο και τρέχει `sharp`
 * σε **τέσσερα** πλάτη. Παράλληλα σε ολόκληρη τη βάση, αυτό είναι ο πιο σίγουρος τρόπος
 * να γονατίσει ο διακομιστής για μια εργασία που **δεν βιάζεται καθόλου**. Το αδελφό
 * `rebuildAllPublicListings` κάνει το ίδιο, για τον ίδιο λόγο.
 *
 * ⚠️ **Μία αποτυχία δεν σταματά τη σάρωση**: το `publishShowcaseMark` **δεν πετά ποτέ**
 * — επιστρέφει **ονομασμένη** άρνηση. Ένα σβησμένο πρωτότυπο δεν επιτρέπεται να αφήσει
 * τα υπόλοιπα 199 σήματα στην παλιά ποιότητα.
 */
export async function rebuildAllShowcaseMarks(
  adminDb: AdminFirestore,
  dryRun: boolean,
): Promise<RebuildShowcaseMarksReport> {
  const sources = await listShowcaseMarkSources(adminDb);

  if (dryRun) {
    // 🔑 Η στεγνή εκτέλεση ρωτά **«πόσα ξέρουμε από πού ήρθαν;»** και τίποτε άλλο. Δεν
    //    κατεβάζει bytes: η απάντηση στο «θα ξαναδημοσιευόταν;» είναι **ναι για όλα**,
    //    οπότε μια «ρεαλιστικότερη» στεγνή εκτέλεση θα πλήρωνε ολόκληρο το κόστος για
    //    να μάθει κάτι που ήδη ξέρει.
    return { found: sources.length, republished: 0, refused: 0, dryRun: true };
  }

  let republished = 0;
  let refused = 0;

  for (const source of sources) {
    const outcome = await publishShowcaseMark(source.companyId, {
      kind: source.kind,
      privateStoragePath: source.privateStoragePath,
    });

    if (outcome.kind === 'published') {
      republished += 1;
      continue;
    }

    refused += 1;
    logger.warn('Σήμα ΔΕΝ ξαναδημοσιεύτηκε — το παλιό μένει ως έχει', {
      companyId: source.companyId,
      outcome: outcome.kind,
      reason: outcome.kind === 'refused' ? outcome.reason : null,
      recordedAt: source.recordedAt,
    });
  }

  logger.info('Μαζική αναπαραγωγή σημάτων', { found: sources.length, republished, refused });

  return { found: sources.length, republished, refused, dryRun: false };
}
