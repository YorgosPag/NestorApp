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
import { setOwnerPropertyMandate } from '@/services/owner-property/owner-property-write.service';
import { isOwnerPropertyOnTheMarket, type OwnerProperty } from '@/types/owner-property';

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
    .where('mandate.expiresAt', '<=', at)
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

    const result = await setOwnerPropertyMandate(adminDb, property.id, property.mandate);
    if (result.kind === 'saved') retired += 1;
    else failed += 1;
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
