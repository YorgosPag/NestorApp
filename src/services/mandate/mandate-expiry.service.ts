/**
 * @fileoverview **Η ΕΝΤΟΛΗ ΠΟΥ ΕΛΗΞΕ** — η αγγελία φεύγει από τον χάρτη, ΤΙΠΟΤΑ δεν σβήνει.
 * @related ADR-777 §8.33 · types/owner-property-mandate.ts
 * @module services/mandate/mandate-expiry.service
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΠΙΟ ΣΗΜΑΝΤΙΚΟ ΠΟΥ ΚΑΝΕΙ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ ΕΙΝΑΙ **ΤΟ ΛΙΓΟ ΠΟΥ ΚΑΝΕΙ**
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η λήξη **δεν χρειάστηκε μηχανισμό εξαφάνισης**, γιατί είναι ήδη γραμμένη στη γλώσσα
 * της **Α20**: μια αγγελία με ληγμένη εντολή δεν έχει **καμία διάθεση στην αγορά**
 * ({@link isOwnerPropertyOnTheMarket}) ⇒ ο υπάρχων γραφέας βγάζει `unavailable` + `[]`
 * ⇒ το `buildPublicListing` επιστρέφει `null` ⇒ η προβολή **σβήνεται**.
 *
 * Άρα εδώ δεν κρίνεται τίποτα. Εδώ **σκανδαλίζεται η επανασύνθεση** για τις αγγελίες
 * που κανείς δεν άγγιξε — γιατί ένα έγγραφο που δεν ξαναγράφτηκε ποτέ **δεν ξέρει ότι
 * πέρασε η ώρα του**.
 *
 * ⚠️ **Ένας σαρωτής που ΕΓΡΑΦΕ «withdrawn» θα ήταν λάθος**, και το λάθος θα ήταν
 * σιωπηλό: το `withdrawn` σημαίνει *«ο κάτοχος απέσυρε»*. Μια εντολή που έληξε **δεν**
 * αποσύρθηκε από κανέναν — απλώς τελείωσε ο χρόνος της. Το RESO κρατά τρεις
 * ξεχωριστές καταστάσεις (`Expired` · `Withdrawn` · `Canceled`) ακριβώς γι' αυτό, και
 * η ένωσή τους θα έλεγε ψέματα για το τι έγινε στον ίδιο τον κατάλογο του γραφείου.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΤΟ ΕΡΩΤΗΜΑ ΧΩΡΑΕΙ ΣΕ **ΜΙΑ** ΑΝΙΣΟΤΗΤΑ — ΚΑΙ ΓΙ' ΑΥΤΟ ΔΕΝ ΘΕΛΕΙ ΕΥΡΕΤΗΡΙΟ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το `mandate.expiresAt` **υπάρχει μόνο στο σκέλος `brokered`** — το `self` δεν έχει
 * καν το πεδίο. Και το Firestore **αποκλείει από ερώτημα ανισότητας κάθε έγγραφο που
 * δεν έχει το πεδίο**. Άρα ένα σκέτο `where('mandate.expiresAt', '<=', now)` επιστρέφει
 * **ακριβώς** τις εντολές μεσιτών που έληξαν, χωρίς δεύτερο φίλτρο και χωρίς σύνθετο
 * ευρετήριο.
 *
 * ⚠️ **Δεν είναι τύχη — είναι το σχήμα του τύπου που το κάνει δυνατό.** Αν η λήξη ήταν
 * πεδίο του `OwnerProperty` με `null` για τον ιδιώτη, **κάθε** αγγελία ιδιώτη θα
 * γυρνούσε στο ερώτημα (το `null` δεν αποκλείεται) και θα χρειαζόταν δεύτερο φίλτρο,
 * σύνθετο ευρετήριο, και μια σάρωση που μεγαλώνει με ακίνητα που **δεν λήγουν ποτέ**.
 */

import 'server-only';

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { nowISO } from '@/lib/date-local';
import { createModuleLogger } from '@/lib/telemetry';
import { republishOwnerProperty } from '@/services/owner-property/owner-property-publication.service';
import { isOwnerPropertyOnTheMarket, type OwnerProperty } from '@/types/owner-property';
import { nextMandateExpiry } from '@/types/owner-property-mandate';
import { mandatesOf } from '@/types/owner-property-mandate';

const logger = createModuleLogger('mandate-expiry.service');

/**
 * Πόσες αγγελίες κοιτάζει ένα πέρασμα.
 *
 * ⚠️ **Το όριο λέγεται στην αναφορά όταν χτυπηθεί** (`truncated`), ποτέ σιωπηλά: μια
 * σάρωση που έκοψε στα 200 και ανέφερε «200 εξετάστηκαν» διαβάζεται ως «αυτά ήταν
 * όλα». Ίδιο συμβόλαιο με τον σαρωτή του §8.23.
 */
const SCAN_LIMIT = 200;

export interface MandateExpiryReport {
  /** Πόσες ληγμένες εντολές εξετάστηκαν. */
  readonly considered: number;
  /** Πόσες αγγελίες **έφυγαν πραγματικά** από τον χάρτη σε αυτό το πέρασμα. */
  readonly retired: number;
  /** Ήδη εκτός χάρτη — η επανασύνθεση δεν είχε τι να αλλάξει. */
  readonly alreadyOff: number;
  /** Δεν γράφτηκαν. */
  readonly failed: number;
  readonly truncated: boolean;
}

/**
 * **Ένα πέρασμα**: για κάθε ληγμένη εντολή, ξαναγράψε την προβολή.
 *
 * 🔑 **Idempotent εξ ορισμού.** Η επανασύνθεση μιας ήδη κατεβασμένης αγγελίας δεν
 * κάνει τίποτα ορατό — γι' αυτό δεν χρειάζεται σημαία «το έκανα ήδη», που θα ήταν
 * δεύτερη αλήθεια για κάτι που το σύστημα **ήδη ξέρει** (ADR-749).
 *
 * ⚠️ **Δεν πιάνει σφάλματα σάρωσης**, σκόπιμα: ο dispatcher τα καταγράφει στο Sentry
 * monitor του slug. Ένα `try/catch` γύρω από όλα θα έκανε μια αποτυχημένη σάρωση να
 * **φαίνεται επιτυχημένη**.
 */
export async function retireExpiredMandates(
  adminDb: AdminFirestore,
): Promise<MandateExpiryReport> {
  const at = nowISO();

  // tenant-scope-exempt: καθολική σάρωση συντήρησης από cron (Admin SDK). Η λήξη μιας
  // εντολής δεν ανήκει σε μισθωτή — είναι γεγονός του ρολογιού, και το πέρασμα οφείλει
  // να δει ΚΑΘΕ ληγμένη εντολή ανεξάρτητα από γραφείο. Καμία απάντηση δεν φεύγει προς
  // πελάτη: το μόνο αποτέλεσμα είναι ότι δημόσιες προβολές ΚΑΤΕΒΑΙΝΟΥΝ.
  const snapshot = await adminDb
    .collection(COLLECTIONS.OWNER_PROPERTIES)
    // 🔴 **ΤΟ ΠΕΔΙΟ-ΕΥΡΕΤΗΡΙΟ, ΚΑΙ ΟΧΙ ΠΙΑ `mandate.expiresAt`** (ADR-832). Οι εντολές
    //    είναι πλέον **πίνακας**, και το Firestore ΔΕΝ κάνει ανισότητα σε πεδίο μέσα
    //    σε πίνακα αντικειμένων: το παλιό ερώτημα δεν θα έσπαγε με σφάλμα, θα
    //    επέστρεφε **τίποτα** — δηλαδή οι ληγμένες αγγελίες θα έμεναν στον χάρτη για
    //    πάντα, σιωπηλά. Το `mandatesExpireAt` παράγεται από το `nextMandateExpiry`
    //    και γράφεται από τον **ίδιο** γραφέα με τις εντολές.
    .where('mandatesExpireAt', '<=', at)
    .limit(SCAN_LIMIT + 1)
    .get();

  const docs = snapshot.docs.slice(0, SCAN_LIMIT);
  let retired = 0;
  let alreadyOff = 0;
  let failed = 0;

  for (const doc of docs) {
    const property = doc.data() as OwnerProperty;

    // 🔴 **Ο ΚΡΙΤΗΣ ΕΙΝΑΙ Ο ΙΔΙΟΣ ΠΟΥ ΚΡΙΝΕΙ Η ΠΡΟΒΟΛΗ.** Δεν ξαναρωτιέται εδώ «έληξε;»
    // με δεύτερη σύγκριση ημερομηνιών — θα ήταν δεύτερος κριτής για το ίδιο ερώτημα,
    // και θα διαφωνούσε την ημέρα που θα άλλαζε ο κανόνας (π.χ. περίοδος χάριτος).
    if (!isOwnerPropertyOnTheMarket(property, at)) {
      // Ήταν ήδη εκτός· η επανασύνθεση γίνεται **έτσι κι αλλιώς**, γιατί μπορεί η
      // προβολή να έχει μείνει πίσω από προηγούμενη αποτυχία γραφής.
      alreadyOff += 1;
    }

    // 🔑 **ΑΝΑΔΗΜΟΣΙΕΥΣΗ, ΚΑΙ ΟΧΙ ΠΙΑ ΓΡΑΦΗ ΕΝΤΟΛΗΣ** (ADR-832). Ως τις 2026-08-30 ο
    //    σαρωτής καλούσε `setOwnerPropertyMandate(…, property.mandate)` — ξανάγραφε
    //    δηλαδή την **ίδια** εντολή, με μόνο σκοπό να πυροδοτήσει την επανασύνθεση
    //    της προβολής. Ήταν παράκαμψη, και κόστιζε: ο γραφέας της εντολής **κρίνει**,
    //    οπότε ο σαρωτής χρειαζόταν ρητή εξαίρεση για να μην κοκκινίζει στο
    //    `mandate-expiry-past` πάνω σε ληγμένες — που είναι ακριβώς ό,τι σαρώνει.
    //
    // ⚠️ Τώρα ζητά **αυτό που θέλει**: ξαναχτίσιμο της δημόσιας προβολής. Καμία
    //    εγγραφή στην εντολή, καμία κρίση να παρακαμφθεί, κανένα πεδίο σε κίνδυνο.
    const result = await republishOwnerProperty(adminDb, property);
    if (result.publish === 'failed') {
      failed += 1;
      continue;
    }
    retired += 1;

    // 🔴 **ΤΟ ΕΥΡΕΤΗΡΙΟ ΠΡΟΧΩΡΑ, ΑΛΛΙΩΣ Ο ΣΑΡΩΤΗΣ ΔΕΝ ΤΕΡΜΑΤΙΖΕΙ.** Η ληγμένη εντολή
    //    μένει στο έγγραφο (τίποτα δεν σβήνεται, δες την κεφαλίδα), άρα χωρίς αυτή τη
    //    γραφή το ίδιο έγγραφο θα ξαναγυρνούσε σε **κάθε** πέρασμα, για πάντα.
    //
    // ⚠️ Γράφεται **μόνο** το πεδίο-ευρετήριο, με `update` και όχι `set`: καμία
    //    εντολή δεν αγγίζεται, κανένας κριτής δεν παρακάμπτεται.
    const nextAt = nextMandateExpiry(mandatesOf(property), at);
    try {
      await adminDb
        .collection(COLLECTIONS.OWNER_PROPERTIES)
        .doc(doc.id)
        .update({ mandatesExpireAt: nextAt });
    } catch (error) {
      logger.error('Το ευρετήριο λήξης δεν προχώρησε', {
        data: { ownerPropertyId: doc.id },
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const report: MandateExpiryReport = {
    considered: docs.length,
    retired,
    alreadyOff,
    failed,
    truncated: snapshot.docs.length > SCAN_LIMIT,
  };

  logger.info('Πέρασμα ληγμένων εντολών', { data: { ...report } });
  return report;
}
